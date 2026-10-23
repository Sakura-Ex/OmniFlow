"""Define the versioned, business-independent sparse LP wire contract."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


SCHEMA_VERSION = "omniflow.lp.v1"
MAX_SAFE_INTEGER = 9_007_199_254_740_991
Identifier = Annotated[str, Field(strict=True, min_length=1, max_length=200)]
Finite = Annotated[float, Field(strict=True, allow_inf_nan=False)]
Nonnegative = Annotated[Finite, Field(ge=0)]
Index = Annotated[int, Field(strict=True, ge=0, le=MAX_SAFE_INTEGER)]
Status = Literal[
    "success", "infeasible", "unbounded", "limit_reached", "invalid_model", "solver_error"
]
StageStatus = Literal["optimal", "infeasible", "unbounded", "limit_reached", "solver_error"]


class WireModel(BaseModel):
    """Reject unexpected fields and keep all output JSON numbers finite."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)


class Variable(WireModel):
    """Describe explicit bounds; null denotes an absent bound."""

    id: Identifier
    lower: Finite | None
    upper: Finite | None


class MatrixEntry(WireModel):
    """Identify one additive sparse matrix triplet."""

    row: Index
    col: Index
    value: Finite


class SparseRows(WireModel):
    """Represent A x = rhs or A x <= rhs without a dense matrix."""

    row_ids: list[Identifier] = Field(max_length=100_000)
    rhs: list[Finite] = Field(max_length=100_000)
    entries: list[MatrixEntry] = Field(max_length=1_000_000)


class Coefficient(WireModel):
    """Identify an additive objective coefficient by variable index."""

    col: Index
    value: Finite


class Objective(WireModel):
    """Minimize a normalized expression at one explicit priority."""

    id: Identifier
    priority: Index
    coefficients: list[Coefficient] = Field(max_length=1_000_000)
    normalization_scale: Annotated[Finite, Field(gt=0)]
    abs_tolerance: Nonnegative
    rel_tolerance: Nonnegative


class SolverOptions(WireModel):
    """Allocate a single budget to validation, construction and every stage."""

    time_limit_ms: Annotated[Finite, Field(gt=0, le=60_000)]


class LPRequest(WireModel):
    """Carry mathematical data and opaque caller revision identifiers."""

    schema_version: Literal["omniflow.lp.v1"]
    request_id: Identifier
    document_revision: Index
    compiler_fingerprint: Identifier
    variables: list[Variable] = Field(max_length=50_000)
    equalities: SparseRows
    inequalities: SparseRows
    objectives: list[Objective] = Field(max_length=32)
    solver_options: SolverOptions


class Diagnostic(WireModel):
    """Locate a validation or solver failure without exposing exceptions."""

    code: str
    message: str
    path: list[str | int] = Field(default_factory=list)
    row_id: str | None = None
    variable_id: str | None = None
    objective_id: str | None = None


class RowResidual(WireModel):
    """Report one original or normalized objective-lock row check."""

    row_id: str
    kind: Literal["equality", "inequality", "objective_lock"]
    activity: Finite
    rhs: Finite
    residual: Finite
    slack: Finite | None
    tolerance: Nonnegative
    violation: Nonnegative
    passed: bool

    @model_validator(mode="after")
    def validate_check(self) -> "RowResidual":
        """Require the declared row check to agree with its numerical evidence."""
        if self.passed != (self.violation <= self.tolerance):
            raise ValueError("Row check disagrees with its violation and tolerance")
        return self


class BoundSlack(WireModel):
    """Report continuous variable values and checks in their original units."""

    variable_id: str
    value: Finite
    lower_slack: Finite | None
    upper_slack: Finite | None
    tolerance: Nonnegative
    violation: Nonnegative
    passed: bool

    @model_validator(mode="after")
    def validate_check(self) -> "BoundSlack":
        """Require the declared bound check to agree with its numerical evidence."""
        if self.passed != (self.violation <= self.tolerance):
            raise ValueError("Bound check disagrees with its violation and tolerance")
        return self


class FeasibilityEvidence(WireModel):
    """Record the tolerances and all row/bound evidence used for acceptance."""

    passed: bool
    absolute_tolerance: Nonnegative
    relative_tolerance: Nonnegative
    max_violation: Nonnegative
    row_residuals: list[RowResidual]
    bound_slacks: list[BoundSlack]

    @model_validator(mode="after")
    def validate_checks(self) -> "FeasibilityEvidence":
        """Keep aggregate feasibility consistent with every individual check."""
        checks = [*self.row_residuals, *self.bound_slacks]
        if self.passed != all(item.passed for item in checks):
            raise ValueError("Aggregate feasibility disagrees with row or bound checks")
        if self.max_violation != max((item.violation for item in checks), default=0.0):
            raise ValueError("Maximum violation disagrees with individual checks")
        return self


class Solution(WireModel):
    """Expose a verified continuous solution, aligned with variable_ids."""

    variable_ids: list[str]
    values: list[Finite]
    feasibility: FeasibilityEvidence

    @model_validator(mode="after")
    def validate_alignment(self) -> "Solution":
        """Ensure identities, values and bound evidence describe the same vector."""
        if len(set(self.variable_ids)) != len(self.variable_ids):
            raise ValueError("Solution variable identities must be unique")
        if self.variable_ids != [item.variable_id for item in self.feasibility.bound_slacks]:
            raise ValueError("Bound evidence must align with solution identities")
        if self.values != [item.value for item in self.feasibility.bound_slacks]:
            raise ValueError("Bound evidence must align with solution values")
        return self


class ObjectiveResult(WireModel):
    """Keep stage optimality distinct from feasibility and later optimization."""

    objective_id: str | None
    priority: Index | None
    status: StageStatus
    proven_optimal: bool
    value: Finite | None
    normalized_value: Finite | None
    normalization_scale: Annotated[Finite, Field(gt=0)]
    abs_tolerance: Nonnegative
    rel_tolerance: Nonnegative
    lock_upper: Finite | None
    elapsed_ms: Nonnegative
    feasibility: FeasibilityEvidence | None

    @model_validator(mode="after")
    def validate_optimality(self) -> "ObjectiveResult":
        """Require a proven optimum to carry finite values and feasible evidence."""
        if self.proven_optimal != (self.status == "optimal"):
            raise ValueError("Stage status and proven optimality must agree")
        if self.proven_optimal and (
            self.value is None or self.normalized_value is None or self.lock_upper is None
            or self.feasibility is None or not self.feasibility.passed
        ):
            raise ValueError("An optimal stage requires a verified vector, value and lock")
        return self


class ModelStats(WireModel):
    """Count canonical nonzeros after additive duplicate reduction."""

    variables: Index
    equality_rows: Index
    inequality_rows: Index
    matrix_nonzeros: Index
    objective_nonzeros: Index
    objective_layers: Index


class Timings(WireModel):
    """Keep execution timing extensible to the future bounded request pool."""

    queue_ms: Nonnegative
    solve_ms: Nonnegative
    total_ms: Nonnegative


class LPResponse(WireModel):
    """Return truthful stage completion and only verified usable solutions."""

    schema_version: Literal["omniflow.lp.v1"] = SCHEMA_VERSION
    request_id: str | None
    document_revision: Index | None
    compiler_fingerprint: str | None
    status: Status
    solution: Solution | None
    objective_results: list[ObjectiveResult]
    diagnostics: list[Diagnostic]
    model_stats: ModelStats | None
    timings: Timings

    @model_validator(mode="after")
    def validate_outcome(self) -> "LPResponse":
        """Reject internally inconsistent success or unverified solution data."""
        if self.solution is not None:
            if self.status not in ("success", "limit_reached"):
                raise ValueError("Only success and limit_reached may carry a solution")
            if not self.solution.feasibility.passed:
                raise ValueError("A solution must have passed feasibility checks")
            if len(self.solution.variable_ids) != len(self.solution.values):
                raise ValueError("Solution variable identities and values must align")
        if self.status == "success":
            if self.solution is None or not self.objective_results:
                raise ValueError("Success requires a verified solution and stage evidence")
            if any(not stage.proven_optimal for stage in self.objective_results):
                raise ValueError("Success requires every stage to be proven optimal")
            if self.model_stats is None or len(self.objective_results) != max(1, self.model_stats.objective_layers):
                raise ValueError("Success requires evidence for every requested layer")
        return self
