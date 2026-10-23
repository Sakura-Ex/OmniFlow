"""Solve validated sparse linear programs with explicit lexicographic stages."""

from dataclasses import dataclass
import logging
from math import fsum, isfinite
from time import perf_counter
from typing import Any, Mapping

import numpy as np
from pydantic import ValidationError
from scipy.optimize import linprog
from scipy.sparse import coo_matrix, csr_matrix, vstack

from .schema import (
    BoundSlack, Diagnostic, FeasibilityEvidence, LPRequest, LPResponse, ModelStats,
    Objective, ObjectiveResult, RowResidual, Solution, SparseRows, Timings,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SolverLimits:
    """Set server-owned size, budget and residual tolerances."""

    max_threads: int = 1
    max_variables: int = 50_000
    max_rows: int = 100_000
    max_nonzeros: int = 1_000_000
    max_objective_layers: int = 32
    max_time_limit_ms: float = 60_000
    feasibility_absolute_tolerance: float = 1e-7
    feasibility_relative_tolerance: float = 1e-9

    def __post_init__(self) -> None:
        """Reject invalid server configuration before handling a model."""
        for value in (
            self.max_variables, self.max_rows, self.max_nonzeros, self.max_objective_layers,
        ):
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError("Model size limits must be nonnegative integers")
        for value in (
            self.max_time_limit_ms, self.feasibility_absolute_tolerance,
            self.feasibility_relative_tolerance,
        ):
            if not isfinite(value) or value < 0:
                raise ValueError("Solver time and tolerances must be finite and nonnegative")
        if isinstance(self.max_threads, bool) or not isinstance(self.max_threads, int) or self.max_threads < 1:
            raise ValueError("Native thread limit must be a positive integer")
        if self.max_time_limit_ms == 0:
            raise ValueError("The server time limit must be positive")


class InvalidModel(ValueError):
    """Carry a structured model error raised before the optimizer is called."""

    def __init__(self, diagnostic: Diagnostic):
        """Retain the diagnostic for a JSON-safe invalid_model response."""
        super().__init__(diagnostic.message)
        self.diagnostic = diagnostic


@dataclass(frozen=True)
class CompiledObjective:
    """Keep raw coefficients for reporting and normalized coefficients for solving."""

    spec: Objective | None
    raw: csr_matrix
    normalized: csr_matrix


@dataclass(frozen=True)
class ObjectiveLock:
    """Represent a previously proven objective's normalized upper bound."""

    objective_id: str
    coefficients: csr_matrix
    upper: float


@dataclass(frozen=True)
class CompiledModel:
    """Retain sparse data, explicit bounds and stable caller identities."""

    request: LPRequest
    equalities: csr_matrix
    inequalities: csr_matrix
    objectives: list[CompiledObjective]
    stats: ModelStats
    constant_conflicts: list[Diagnostic]


def _invalid(code: str, message: str, path: list[str | int]) -> None:
    """Raise a located error without entering the solver."""
    raise InvalidModel(Diagnostic(code=code, message=message, path=path))


def _unique(values: list[str | int], path: list[str | int]) -> None:
    """Reject duplicate stable identities and ambiguous objective priorities."""
    seen: set[str | int] = set()
    for index, value in enumerate(values):
        if value in seen:
            _invalid("duplicate_id", "Identities and objective priorities must be unique", [*path, index])
        seen.add(value)


def _sum_entries(entries: list[tuple[int, int, float]]) -> dict[tuple[int, int], float]:
    """Sum duplicate coordinates accurately and remove only exact zero sums."""
    groups: dict[tuple[int, int], list[float]] = {}
    for row, col, value in entries:
        groups.setdefault((row, col), []).append(value)
    result: dict[tuple[int, int], float] = {}
    for coordinate, values in groups.items():
        try:
            value = fsum(values)
        except (ValueError, OverflowError):
            _invalid("nonfinite_sum", "Duplicate coefficients overflowed", [])
        if not isfinite(value):
            _invalid("nonfinite_sum", "Duplicate coefficients must sum to a finite value", [])
        if value != 0:
            result[coordinate] = value
    return result


def _matrix(entries: list[tuple[int, int, float]], shape: tuple[int, int]) -> csr_matrix:
    """Build CSR directly from canonical triplets without a dense intermediate."""
    reduced = _sum_entries(entries)
    coordinates = sorted(reduced)
    return coo_matrix((
        [reduced[key] for key in coordinates],
        ([key[0] for key in coordinates], [key[1] for key in coordinates]),
    ), shape=shape, dtype=float).tocsr()


def _validate_rows(rows: SparseRows, columns: int, name: str) -> None:
    """Check row dimensions and every triplet index before sparse construction."""
    if len(rows.row_ids) != len(rows.rhs):
        _invalid("dimension_mismatch", "Row identities and right-hand sides must align", [name, "rhs"])
    for index, entry in enumerate(rows.entries):
        if entry.row >= len(rows.row_ids) or entry.col >= columns:
            _invalid("index_out_of_range", "Sparse coefficient index is out of range", [name, "entries", index])


def _compile(request: LPRequest, limits: SolverLimits) -> CompiledModel:
    """Validate semantic invariants and construct only sparse coefficient matrices."""
    columns = len(request.variables)
    rows = len(request.equalities.row_ids) + len(request.inequalities.row_ids)
    # Count submitted entries, including duplicates, to bound preprocessing work.
    nonzeros = len(request.equalities.entries) + len(request.inequalities.entries)
    nonzeros += sum(len(objective.coefficients) for objective in request.objectives)
    for actual, maximum, field in (
        (columns, limits.max_variables, "variables"), (rows, limits.max_rows, "equalities"),
        (nonzeros, limits.max_nonzeros, "entries"),
        (len(request.objectives), limits.max_objective_layers, "objectives"),
    ):
        if actual > maximum:
            _invalid("model_size_limit", "The model exceeds a server-owned resource limit", [field])
    if request.solver_options.time_limit_ms > limits.max_time_limit_ms:
        _invalid("time_limit_exceeded", "The requested budget exceeds the server limit", ["solver_options", "time_limit_ms"])
    _unique([variable.id for variable in request.variables], ["variables"])
    _unique(request.equalities.row_ids + request.inequalities.row_ids, ["row_ids"])
    _unique([objective.id for objective in request.objectives], ["objectives"])
    _unique([objective.priority for objective in request.objectives], ["objectives", "priority"])
    for index, variable in enumerate(request.variables):
        if variable.lower is not None and variable.upper is not None and variable.lower > variable.upper:
            _invalid("inverted_bounds", "The lower bound exceeds the upper bound", ["variables", index])
    _validate_rows(request.equalities, columns, "equalities")
    _validate_rows(request.inequalities, columns, "inequalities")
    equalities = _matrix(
        [(entry.row, entry.col, entry.value) for entry in request.equalities.entries],
        (len(request.equalities.row_ids), columns),
    )
    inequalities = _matrix(
        [(entry.row, entry.col, entry.value) for entry in request.inequalities.entries],
        (len(request.inequalities.row_ids), columns),
    )
    objectives = []
    for objective in sorted(request.objectives, key=lambda item: item.priority):
        for index, coefficient in enumerate(objective.coefficients):
            if coefficient.col >= columns:
                _invalid("index_out_of_range", "Objective coefficient index is out of range", ["objectives", objective.id, "coefficients", index])
        raw = _matrix([(0, item.col, item.value) for item in objective.coefficients], (1, columns))
        normalized = raw.copy()
        with np.errstate(over="ignore", under="ignore", invalid="ignore"):
            normalized.data = raw.data / objective.normalization_scale
        if not np.all(np.isfinite(normalized.data)) or np.any(normalized.data == 0):
            _invalid("invalid_normalization", "Objective normalization must preserve finite nonzero coefficients", ["objectives", objective.id, "normalization_scale"])
        objectives.append(CompiledObjective(objective, raw, normalized))
    stats = ModelStats(
        variables=columns, equality_rows=equalities.shape[0], inequality_rows=inequalities.shape[0],
        matrix_nonzeros=equalities.nnz + inequalities.nnz,
        objective_nonzeros=sum(item.raw.nnz for item in objectives), objective_layers=len(objectives),
    )
    if not objectives:
        zero = csr_matrix((1, columns), dtype=float)
        objectives.append(CompiledObjective(None, zero, zero))
    constant_conflicts = []
    for matrix, source, equality in (
        (equalities, request.equalities, True), (inequalities, request.inequalities, False),
    ):
        for row, count in enumerate(np.diff(matrix.indptr)):
            if count == 0 and (source.rhs[row] != 0 if equality else source.rhs[row] < 0):
                constant_conflicts.append(Diagnostic(
                    code="constant_row_infeasible", message="A zero-coefficient row has an incompatible nonzero right-hand side",
                    row_id=source.row_ids[row],
                ))
    return CompiledModel(request, equalities, inequalities, objectives, stats, constant_conflicts)


def _verify(model: CompiledModel, x: np.ndarray, locks: list[ObjectiveLock], limits: SolverLimits) -> FeasibilityEvidence:
    """Back-substitute every original row, objective lock and explicit bound."""
    abs_tol = limits.feasibility_absolute_tolerance
    rel_tol = limits.feasibility_relative_tolerance
    row_checks: list[RowResidual] = []
    bound_checks: list[BoundSlack] = []
    row_sets = [
        (model.equalities, model.request.equalities.rhs, model.request.equalities.row_ids, "equality"),
        (model.inequalities, model.request.inequalities.rhs, model.request.inequalities.row_ids, "inequality"),
    ]
    row_sets.extend((lock.coefficients, [lock.upper], [lock.objective_id], "objective_lock") for lock in locks)
    with np.errstate(over="raise", invalid="raise"):
        for matrix, rhs_values, ids, kind in row_sets:
            activities = matrix @ x
            scales = abs(matrix) @ np.abs(x)
            for row, row_id in enumerate(ids):
                activity, rhs = float(activities[row]), rhs_values[row]
                residual = activity - rhs
                tolerance = abs_tol + rel_tol * max(abs(rhs), float(scales[row]))
                violation = abs(residual) if kind == "equality" else max(0.0, residual)
                row_checks.append(RowResidual(
                    row_id=row_id, kind=kind, activity=activity, rhs=rhs, residual=residual,
                    slack=None if kind == "equality" else -residual,
                    tolerance=tolerance, violation=violation, passed=violation <= tolerance,
                ))
        for index, variable in enumerate(model.request.variables):
            value = float(x[index])
            lower_slack = None if variable.lower is None else value - variable.lower
            upper_slack = None if variable.upper is None else variable.upper - value
            scale = max(abs(value), abs(variable.lower or 0), abs(variable.upper or 0))
            tolerance = abs_tol + rel_tol * scale
            violation = max(0.0, -(lower_slack or 0), -(upper_slack or 0))
            bound_checks.append(BoundSlack(
                variable_id=variable.id, value=value, lower_slack=lower_slack, upper_slack=upper_slack,
                tolerance=tolerance, violation=violation, passed=violation <= tolerance,
            ))
    return FeasibilityEvidence(
        passed=all(item.passed for item in [*row_checks, *bound_checks]),
        absolute_tolerance=abs_tol, relative_tolerance=rel_tol,
        max_violation=max((item.violation for item in [*row_checks, *bound_checks]), default=0.0),
        row_residuals=row_checks, bound_slacks=bound_checks,
    )


def _candidate(model: CompiledModel, candidate: Any, locks: list[ObjectiveLock], limits: SolverLimits) -> tuple[np.ndarray, FeasibilityEvidence] | None:
    """Accept only finite, correctly sized vectors with complete residual evidence."""
    if candidate is None:
        return None
    try:
        x = np.asarray(candidate, dtype=float)
        if x.shape != (len(model.request.variables),) or not np.all(np.isfinite(x)):
            return None
        evidence = _verify(model, x, locks, limits)
        return (x, evidence) if evidence.passed else None
    except (ValueError, TypeError, OverflowError, FloatingPointError, ValidationError):
        return None


def _values(objective: CompiledObjective, x: np.ndarray) -> tuple[float, float]:
    """Evaluate both reported and normalized objective values with finite checks."""
    with np.errstate(over="raise", invalid="raise"):
        raw = float((objective.raw @ x)[0])
        normalized = float((objective.normalized @ x)[0])
    if not isfinite(raw) or not isfinite(normalized):
        raise ValueError("Nonfinite objective value")
    return raw, normalized


def solve_lp(payload: LPRequest | Mapping[str, Any], *, limits: SolverLimits | None = None) -> LPResponse:
    """Solve generic sparse LP stages within one shared wall-clock budget.

    Args:
        payload: Versioned request or untrusted JSON-compatible mapping.
        limits: Server-owned caps and numerical feasibility tolerances.

    Returns:
        Structured outcome; only success or limit_reached may contain a verified solution.
    """
    started = perf_counter()
    server_limits = limits or SolverLimits()
    request: LPRequest | None = None
    model: CompiledModel | None = None
    stages: list[ObjectiveResult] = []
    diagnostics: list[Diagnostic] = []
    retained: tuple[np.ndarray, FeasibilityEvidence] | None = None
    solve_ms = 0.0

    def response(status: str) -> LPResponse:
        """Assemble a finite response without echoing invalid untrusted metadata."""
        solution = None
        if retained is not None and status in ("success", "limit_reached"):
            solution = Solution(
                variable_ids=[variable.id for variable in request.variables],
                values=retained[0].tolist(), feasibility=retained[1],
            )
        return LPResponse(
            request_id=request.request_id if request else None,
            document_revision=request.document_revision if request else None,
            compiler_fingerprint=request.compiler_fingerprint if request else None,
            status=status, solution=solution, objective_results=stages, diagnostics=diagnostics,
            model_stats=model.stats if model else None,
            timings=Timings(queue_ms=0, solve_ms=solve_ms, total_ms=max(0, (perf_counter() - started) * 1000)),
        )

    try:
        # Revalidate even constructed Pydantic objects; callers cannot bypass wire invariants.
        data = payload.model_dump() if isinstance(payload, LPRequest) else payload
        request = LPRequest.model_validate(data)
        model = _compile(request, server_limits)
    except ValidationError as error:
        diagnostics.extend(Diagnostic(
            code=item["type"], message=item["msg"], path=list(item["loc"]),
        ) for item in error.errors(include_input=False, include_context=False, include_url=False))
        return response("invalid_model")
    except InvalidModel as error:
        diagnostics.append(error.diagnostic)
        return response("invalid_model")

    deadline = started + request.solver_options.time_limit_ms / 1000
    locks: list[ObjectiveLock] = []
    for objective in model.objectives:
        remaining = deadline - perf_counter()
        if remaining <= 0:
            diagnostics.append(Diagnostic(code="time_budget_exhausted", message="The total request budget expired before the next stage", objective_id=objective.spec.id if objective.spec else None))
            return response("limit_reached")
        stage_started = perf_counter()
        spec = objective.spec
        stage_status = "solver_error"
        candidate = None
        try:
            if model.constant_conflicts:
                diagnostics.extend(model.constant_conflicts)
                stage_status = "infeasible"
            elif not request.variables:
                # SciPy rejects zero variables; the same residual verifier handles constants.
                candidate = _candidate(model, [], locks, server_limits)
                stage_status = "optimal" if candidate is not None else "infeasible"
            else:
                inequality_matrix = model.inequalities
                rhs = list(request.inequalities.rhs)
                if locks:
                    inequality_matrix = vstack([inequality_matrix, *(lock.coefficients for lock in locks)], format="csr")
                    rhs.extend(lock.upper for lock in locks)
                # The optimizer requires a dense objective VECTOR, never a dense matrix.
                c = np.zeros(len(request.variables), dtype=float)
                c[objective.normalized.indices] = objective.normalized.data
                remaining = deadline - perf_counter()
                if remaining <= 0:
                    stage_status = "limit_reached"
                else:
                    optimizer_started = perf_counter()
                    try:
                        result = linprog(
                            c, A_eq=model.equalities if model.equalities.shape[0] else None,
                            b_eq=np.asarray(request.equalities.rhs) if model.equalities.shape[0] else None,
                            A_ub=inequality_matrix if inequality_matrix.shape[0] else None,
                            b_ub=np.asarray(rhs) if inequality_matrix.shape[0] else None,
                            bounds=[(variable.lower, variable.upper) for variable in request.variables],
                            method="highs", options={"time_limit": remaining, "threads": server_limits.max_threads},
                        )
                    finally:
                        solve_ms += max(0, (perf_counter() - optimizer_started) * 1000)
                    stage_status = {0: "optimal", 1: "limit_reached", 2: "infeasible", 3: "unbounded"}.get(result.status, "solver_error")
                    if stage_status == "optimal" and not result.success:
                        stage_status = "solver_error"
                    if stage_status in ("optimal", "limit_reached"):
                        candidate = _candidate(model, result.x, locks, server_limits)
                        if stage_status == "optimal" and candidate is None:
                            stage_status = "solver_error"
                            diagnostics.append(Diagnostic(code="invalid_solution", message="The optimizer's solution failed finite, residual or bound validation", objective_id=spec.id if spec else None))
        except Exception:
            logger.exception("Optimizer stage failed request_id=%s objective_id=%s", request.request_id, spec.id if spec else None)
            diagnostics.append(Diagnostic(code="solver_exception", message="The optimizer failed to execute or returned malformed data", objective_id=spec.id if spec else None))
            stage_status = "solver_error"

        raw_value = normalized_value = lock_upper = None
        if candidate is not None:
            try:
                raw_value, normalized_value = _values(objective, candidate[0])
                if stage_status == "optimal":
                    tolerance = spec.abs_tolerance + spec.rel_tolerance * abs(normalized_value) if spec else 0.0
                    lock_upper = normalized_value + tolerance
                    if not isfinite(lock_upper):
                        raise ValueError("Objective lock overflow")
                if retained is None or stage_status == "optimal" or normalized_value <= _values(objective, retained[0])[1]:
                    retained = candidate
            except (ValueError, OverflowError, FloatingPointError):
                stage_status = "solver_error"
                raw_value = normalized_value = lock_upper = None
                candidate = None
                diagnostics.append(Diagnostic(code="nonfinite_objective", message="The objective value or lock could not be represented finitely", objective_id=spec.id if spec else None))
        if stage_status == "infeasible" and locks:
            stage_status = "solver_error"
            diagnostics.append(Diagnostic(code="objective_lock_infeasible", message="A later stage contradicted an already verified feasible solution", objective_id=spec.id if spec else None))
        stages.append(ObjectiveResult(
            objective_id=spec.id if spec else None, priority=spec.priority if spec else None,
            status=stage_status, proven_optimal=stage_status == "optimal",
            value=raw_value, normalized_value=normalized_value,
            normalization_scale=spec.normalization_scale if spec else 1.0,
            abs_tolerance=spec.abs_tolerance if spec else 0.0,
            rel_tolerance=spec.rel_tolerance if spec else 0.0,
            lock_upper=lock_upper, elapsed_ms=max(0, (perf_counter() - stage_started) * 1000),
            feasibility=candidate[1] if candidate else None,
        ))
        if stage_status != "optimal":
            if not diagnostics or diagnostics[-1].objective_id != (spec.id if spec else None):
                diagnostics.append(Diagnostic(code=stage_status, message=f"Optimization stopped with {stage_status}", objective_id=spec.id if spec else None))
            if stage_status == "limit_reached" and retained is not None:
                # Reverify the retained vector against all locks active in the interrupted stage.
                retained = _candidate(model, retained[0], locks, server_limits)
            return response(stage_status)
        if spec:
            locks.append(ObjectiveLock(spec.id, objective.normalized, lock_upper))
        retained = _candidate(model, retained[0], locks, server_limits)
        if retained is None:
            diagnostics.append(Diagnostic(code="invalid_objective_lock", message="The verified optimum did not satisfy its objective lock", objective_id=spec.id if spec else None))
            return response("solver_error")
    if perf_counter() > deadline:
        diagnostics.append(Diagnostic(code="time_budget_exhausted", message="The total request budget expired during final validation"))
        return response("limit_reached")
    return response("success")
