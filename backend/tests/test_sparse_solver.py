"""Function-level PR-05 regressions; no second calculation route is introduced."""

from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from pydantic import ValidationError
from scipy.sparse import issparse

from backend.solver import LPRequest, LPResponse, SolverLimits, solve_lp
from backend.solver import service


FIXTURES = json.loads((Path(__file__).resolve().parents[2] / "fixtures/lp/models.json").read_text())
RESPONSE_FIXTURES = json.loads((Path(__file__).resolve().parents[2] / "fixtures/lp/responses.json").read_text())


def request_fixture(index=0):
    """Return an independent copy of a shared Python/TypeScript math fixture."""
    return deepcopy(FIXTURES[index]["request"])


@pytest.mark.parametrize("case", FIXTURES, ids=lambda case: case["id"])
def test_cross_language_models(case):
    """Verify T09, T16, continuous variables, signed bounds and constant rows."""
    result = solve_lp(case["request"])
    expected = case["expected"]
    assert result.status == expected["status"], result.model_dump()
    assert [stage.objective_id for stage in result.objective_results] == expected["objective_ids"]
    if expected["values"] is None:
        assert result.solution is None
    else:
        assert result.solution.values == pytest.approx(expected["values"])
        assert result.solution.feasibility.passed
        assert all(row.passed for row in result.solution.feasibility.row_residuals)
        assert all(bound.passed for bound in result.solution.feasibility.bound_slacks)
        assert all(stage.proven_optimal for stage in result.objective_results)
    assert result.request_id == case["request"]["request_id"]
    assert result.document_revision == case["request"]["document_revision"]
    assert result.compiler_fingerprint == case["request"]["compiler_fingerprint"]
    # JSON must never contain NaN/Infinity, including for unbounded models.
    assert LPResponse.model_validate_json(result.model_dump_json()).status == result.status


@pytest.mark.parametrize("factor", [1e-6, 1e3, 1e9])
def test_unit_scaling_preserves_priority_and_tolerance(factor):
    """Changing an objective's display unit and scale preserves its normalized LP."""
    original = request_fixture()
    original["objectives"][1]["abs_tolerance"] = 1e-5
    original["objectives"][1]["rel_tolerance"] = 1e-6
    scaled = deepcopy(original)
    scaled["objectives"][1]["coefficients"][0]["value"] *= factor
    scaled["objectives"][1]["normalization_scale"] *= factor
    baseline, result = solve_lp(original), solve_lp(scaled)
    assert result.status == baseline.status == "success"
    assert result.solution.values == pytest.approx(baseline.solution.values)
    assert result.objective_results[0].normalized_value == pytest.approx(baseline.objective_results[0].normalized_value)
    assert result.objective_results[0].lock_upper == pytest.approx(-1 + 1e-5 + 1e-6)
    assert result.objective_results[0].value == pytest.approx(-factor)
    assert result.solution.values[1] == pytest.approx(1 - 1.1e-5)


def test_sparse_matrices_and_additive_duplicates(monkeypatch):
    """Keep every coefficient matrix sparse and merge duplicate matrix/objective terms."""
    actual = service.linprog
    calls = []

    def inspect(*args, **kwargs):
        """Observe the real optimizer inputs without replacing the optimization."""
        for name in ("A_eq", "A_ub"):
            assert kwargs[name] is None or issparse(kwargs[name])
        calls.append((args, kwargs))
        return actual(*args, **kwargs)

    monkeypatch.setattr(service, "linprog", inspect)
    result = solve_lp(request_fixture(1))
    assert result.status == "success"
    assert result.solution.values == pytest.approx([0.25, -0.5])
    assert result.model_stats.matrix_nonzeros == 2
    assert result.model_stats.objective_nonzeros == 1
    assert calls[0][1]["A_eq"][0, 0] == 2
    assert calls[0][0][0].tolist() == [1, 0]
    assert calls[0][1]["bounds"] == [(0, None), (None, None)]


def test_repeated_coefficients_use_accurate_sum():
    """Do not lose a small nonzero constraint to cancellation of large duplicates."""
    request = request_fixture(1)
    request["equalities"]["entries"][:3] = [
        {"row": 0, "col": 0, "value": value} for value in [1e16, 1, -1e16]
    ]
    result = solve_lp(request)
    assert result.status == "success"
    assert result.solution.values[0] == pytest.approx(0.5)


def test_cancelling_row_with_nonzero_rhs_is_not_removed():
    """Only exact zero rows with zero right-hand sides can be redundant."""
    request = request_fixture(1)
    request["equalities"]["entries"][:3] = [
        {"row": 0, "col": 0, "value": value} for value in [2, -2]
    ]
    assert solve_lp(request).status == "infeasible"


def test_feasibility_without_objectives():
    """A zero objective still runs the full residual and bound validator."""
    request = request_fixture(1)
    request["objectives"] = []
    result = solve_lp(request)
    assert result.status == "success"
    assert result.solution.values == pytest.approx([0.25, -0.5])
    assert result.model_stats.objective_layers == 0
    assert result.objective_results[0].objective_id is None


@pytest.mark.parametrize("kind,rhs", [("equalities", 1e-20), ("inequalities", -1e-20)])
def test_tiny_constant_contradiction_is_never_dropped(monkeypatch, kind, rhs):
    """Exact zero rows with nonzero contradictions remain infeasible at any scale."""
    request = request_fixture(1)
    request[kind] = {"row_ids": ["constant"], "rhs": [rhs], "entries": []}
    optimizer = Mock()
    monkeypatch.setattr(service, "linprog", optimizer)
    result = solve_lp(request)
    assert result.status == "infeasible"
    assert result.solution is None
    assert any(item.row_id == "constant" for item in result.diagnostics)
    optimizer.assert_not_called()


@pytest.mark.parametrize("mutate", [
    lambda r: r["variables"].append(deepcopy(r["variables"][0])),
    lambda r: r["equalities"]["row_ids"].__setitem__(0, "bottleneck"),
    lambda r: r["objectives"][0].__setitem__("id", "delivery-first"),
    lambda r: r["objectives"][0].__setitem__("priority", 10),
    lambda r: r["equalities"]["rhs"].append(0),
    lambda r: r["equalities"]["entries"][0].__setitem__("row", 1),
    lambda r: r["equalities"]["entries"][0].__setitem__("col", 2),
    lambda r: r["equalities"]["entries"][0].__setitem__("col", -1),
    lambda r: r["equalities"]["entries"][0].__setitem__("col", 0.5),
    lambda r: r["equalities"]["entries"][0].__setitem__("row", True),
    lambda r: r["objectives"][0]["coefficients"][0].__setitem__("col", 2),
    lambda r: r["variables"][0].update(lower=2, upper=1),
    lambda r: r["variables"][0].update(upper=float("inf")),
    lambda r: r["equalities"]["rhs"].__setitem__(0, float("nan")),
    lambda r: r["inequalities"]["entries"][0].__setitem__("value", float("-inf")),
    lambda r: r["objectives"][0]["coefficients"][0].__setitem__("value", "1"),
    lambda r: r["variables"][0].__setitem__("lower", True),
    lambda r: r["objectives"][0].__setitem__("normalization_scale", 0),
    lambda r: r["objectives"][0].__setitem__("abs_tolerance", -1),
    lambda r: r["objectives"][0].__setitem__("rel_tolerance", float("nan")),
    lambda r: r["objectives"][0].__setitem__("priority", -1),
    lambda r: r["solver_options"].__setitem__("time_limit_ms", 0),
    lambda r: r["solver_options"].__setitem__("time_limit_ms", 60001),
    lambda r: r.__setitem__("schema_version", "unknown"),
    lambda r: r.__setitem__("document_revision", 2 ** 53),
    lambda r: r.__setitem__("arbitrary_field", 1),
])
def test_t23_invalid_models_do_not_call_optimizer(monkeypatch, mutate):
    """Reject malformed mathematics and dimensions before optimization."""
    optimizer = Mock(side_effect=AssertionError("The optimizer must not be called"))
    monkeypatch.setattr(service, "linprog", optimizer)
    request = request_fixture()
    mutate(request)
    result = solve_lp(request)
    assert result.status == "invalid_model", result.model_dump()
    assert result.solution is None
    assert result.diagnostics
    optimizer.assert_not_called()
    json.dumps(result.model_dump(), allow_nan=False)


@pytest.mark.parametrize("limits", [
    SolverLimits(max_variables=1), SolverLimits(max_rows=1), SolverLimits(max_nonzeros=4),
    SolverLimits(max_objective_layers=1), SolverLimits(max_time_limit_ms=100),
])
def test_server_limits_cannot_be_overridden(monkeypatch, limits):
    """Apply server-owned caps to submitted entries, not just reduced nonzeros."""
    optimizer = Mock()
    monkeypatch.setattr(service, "linprog", optimizer)
    assert solve_lp(request_fixture(), limits=limits).status == "invalid_model"
    optimizer.assert_not_called()


@pytest.mark.parametrize("value,scale", [(1e308, 1e-308), (1e-308, 1e308)])
def test_normalization_overflow_or_underflow_is_invalid(monkeypatch, value, scale):
    """Never silently drop an objective or pass nonfinite normalized coefficients."""
    request = request_fixture()
    request["objectives"][0]["coefficients"][0]["value"] = value
    request["objectives"][0]["normalization_scale"] = scale
    optimizer = Mock()
    monkeypatch.setattr(service, "linprog", optimizer)
    assert solve_lp(request).status == "invalid_model"
    optimizer.assert_not_called()


def test_duplicate_sum_overflow_is_invalid(monkeypatch):
    """Finite individual coefficients must still reduce to a finite matrix."""
    request = request_fixture()
    request["equalities"]["entries"] = [{"row": 0, "col": 0, "value": 1e308}] * 2
    optimizer = Mock()
    monkeypatch.setattr(service, "linprog", optimizer)
    assert solve_lp(request).status == "invalid_model"
    optimizer.assert_not_called()


@pytest.mark.parametrize("status,expected", [(1, "limit_reached"), (2, "infeasible"), (3, "unbounded"), (4, "solver_error"), (99, "solver_error")])
def test_optimizer_status_is_not_conflated(monkeypatch, status, expected):
    """Never turn an interrupted, infeasible or unbounded optimization into success."""
    optimizer = Mock(return_value=SimpleNamespace(status=status, success=False, x=None))
    monkeypatch.setattr(service, "linprog", optimizer)
    result = solve_lp(request_fixture())
    assert result.status == expected
    assert result.solution is None
    assert len(result.objective_results) == 1
    assert not result.objective_results[0].proven_optimal
    assert optimizer.call_count == 1


@pytest.mark.parametrize("values", [None, [0], [float("nan"), 1], [float("inf"), 1], [1, 1], [-1, -0.00005], [40000, 2]])
def test_success_vector_requires_residual_bound_and_finite_validation(monkeypatch, values):
    """Reject bad vector length, conservation, capacity, bounds and finite values."""
    monkeypatch.setattr(service, "linprog", Mock(return_value=SimpleNamespace(status=0, success=True, x=values)))
    result = solve_lp(request_fixture())
    assert result.status == "solver_error"
    assert result.solution is None
    assert any(item.code == "invalid_solution" for item in result.diagnostics)


def test_t21_second_layer_timeout_retains_verified_first_solution(monkeypatch):
    """A timeout keeps the first feasible optimum and never claims all layers optimal."""
    optimizer = Mock(side_effect=[
        SimpleNamespace(status=0, success=True, x=[20000, 1]),
        SimpleNamespace(status=1, success=False, x=[0, 0]),  # Feasible original LP, violates the lock.
    ])
    monkeypatch.setattr(service, "linprog", optimizer)
    result = solve_lp(request_fixture())
    assert result.status == "limit_reached"
    assert result.solution.values == [20000, 1]
    assert result.solution.feasibility.passed
    assert [stage.proven_optimal for stage in result.objective_results] == [True, False]
    assert any(row.kind == "objective_lock" for row in result.solution.feasibility.row_residuals)
    assert result.objective_results[1].feasibility is None


def test_timeout_can_return_new_verified_incumbent(monkeypatch):
    """A first-stage time limit may expose an actual verified feasible incumbent."""
    monkeypatch.setattr(service, "linprog", Mock(return_value=SimpleNamespace(status=1, success=False, x=[10000, 0.5])))
    result = solve_lp(request_fixture())
    assert result.status == "limit_reached"
    assert result.solution.values == [10000, 0.5]
    assert result.objective_results[0].normalized_value == -0.5
    assert result.objective_results[0].lock_upper is None
    assert not result.objective_results[0].proven_optimal


def test_timeout_never_publishes_unverified_incumbent(monkeypatch):
    """A returned vector alone does not prove feasibility after a time limit."""
    monkeypatch.setattr(service, "linprog", Mock(return_value=SimpleNamespace(status=1, success=False, x=[1, 1])))
    result = solve_lp(request_fixture())
    assert result.status == "limit_reached"
    assert result.solution is None


def test_every_stage_shares_one_budget(monkeypatch):
    """The second optimizer call receives the remaining budget, not a fresh limit."""
    now = [100.0]
    monkeypatch.setattr(service, "perf_counter", lambda: now[0])
    time_limits = []

    def optimize(*args, **kwargs):
        """Advance a deterministic clock instead of sleeping in a regression test."""
        time_limits.append(kwargs["options"]["time_limit"])
        now[0] += 2
        return SimpleNamespace(status=0, success=True, x=[20000, 1])

    monkeypatch.setattr(service, "linprog", optimize)
    result = solve_lp(request_fixture())
    assert result.status == "success"
    assert time_limits == [10, 8]
    assert result.timings.solve_ms == 4000
    assert result.timings.total_ms == 4000


def test_budget_expiry_between_stages_preserves_verified_solution(monkeypatch):
    """Exhaustion after one layer does not start another optimizer invocation."""
    now = [100.0]
    monkeypatch.setattr(service, "perf_counter", lambda: now[0])

    def optimize(*args, **kwargs):
        """Consume the entire shared budget while returning a verified optimum."""
        now[0] += 11
        return SimpleNamespace(status=0, success=True, x=[20000, 1])

    optimizer = Mock(side_effect=optimize)
    monkeypatch.setattr(service, "linprog", optimizer)
    result = solve_lp(request_fixture())
    assert result.status == "limit_reached"
    assert result.solution.values == [20000, 1]
    assert len(result.objective_results) == 1
    assert optimizer.call_count == 1


def test_budget_includes_model_construction(monkeypatch):
    """The budget starts before parsing and sparse construction, not just linprog."""
    now = [100.0]
    monkeypatch.setattr(service, "perf_counter", lambda: now[0])
    actual_compile = service._compile

    def compile_model(*args):
        """Advance the wall clock while preserving real sparse compilation."""
        now[0] += 11
        return actual_compile(*args)

    monkeypatch.setattr(service, "_compile", compile_model)
    optimizer = Mock()
    monkeypatch.setattr(service, "linprog", optimizer)
    result = solve_lp(request_fixture())
    assert result.status == "limit_reached"
    assert result.solution is None
    optimizer.assert_not_called()


def test_later_optimum_cannot_violate_preceding_lock(monkeypatch):
    """Verify objective locks in addition to the original mathematical constraints."""
    monkeypatch.setattr(service, "linprog", Mock(side_effect=[
        SimpleNamespace(status=0, success=True, x=[20000, 1]),
        SimpleNamespace(status=0, success=True, x=[0, 0]),
    ]))
    result = solve_lp(request_fixture())
    assert result.status == "solver_error"
    assert result.solution is None
    assert result.objective_results[0].proven_optimal
    assert not result.objective_results[1].proven_optimal


def test_solver_exception_and_malformed_result_are_safe(monkeypatch):
    """Keep private exception content out of returned diagnostics."""
    monkeypatch.setattr(service, "linprog", Mock(side_effect=RuntimeError("private internals")))
    result = solve_lp(request_fixture())
    assert result.status == "solver_error"
    assert "private internals" not in result.model_dump_json()


def test_prevalidated_request_is_revalidated(monkeypatch):
    """Mutable or constructed Pydantic objects cannot bypass numerical invariants."""
    request = LPRequest.model_validate(request_fixture())
    request.variables[0].lower = float("nan")
    optimizer = Mock()
    monkeypatch.setattr(service, "linprog", optimizer)
    assert solve_lp(request).status == "invalid_model"
    optimizer.assert_not_called()


def test_unbounded_later_layer_stops_and_publishes_no_success():
    """A bounded first objective cannot conceal an unbounded later priority."""
    request = request_fixture(2)
    request["variables"].append({"id": "bounded", "lower": 0, "upper": 1})
    request["objectives"] = [
        {"id": "bounded-first", "priority": 0, "coefficients": [{"col": 1, "value": -1}], "normalization_scale": 1, "abs_tolerance": 0, "rel_tolerance": 0},
        {**request["objectives"][0], "priority": 1},
        {"id": "never-run", "priority": 2, "coefficients": [], "normalization_scale": 1, "abs_tolerance": 0, "rel_tolerance": 0},
    ]
    result = solve_lp(request)
    assert result.status == "unbounded"
    assert result.solution is None
    assert [item.status for item in result.objective_results] == ["optimal", "unbounded"]


@pytest.mark.parametrize("case", RESPONSE_FIXTURES, ids=lambda case: case["id"])
def test_shared_response_contract(case):
    """Read every cross-language response with the same Pydantic wire schema."""
    assert LPResponse.model_validate(case["response"]).model_dump() == case["response"]


@pytest.mark.parametrize("mutate", [
    lambda r: r["solution"]["values"].__setitem__(0, float("inf")),
    lambda r: r["objective_results"][0].__setitem__("normalized_value", float("nan")),
    lambda r: r["objective_results"][0].__setitem__("lock_upper", float("inf")),
    lambda r: r["objective_results"][0].__setitem__("status", "solver_error"),
    lambda r: r["objective_results"][0].__setitem__("feasibility", None),
    lambda r: r["objective_results"].pop(),
    lambda r: r["solution"]["feasibility"]["row_residuals"][0].__setitem__("passed", False),
    lambda r: r["solution"]["feasibility"]["bound_slacks"][0].__setitem__("value", -100),
    lambda r: r.__setitem__("status", "infeasible"),
])
def test_response_contract_rejects_nonfinite_or_inconsistent_evidence(mutate):
    """The Python response contract has the same acceptance gates as TypeScript."""
    response = deepcopy(RESPONSE_FIXTURES[0]["response"])
    mutate(response)
    with pytest.raises(ValidationError):
        LPResponse.model_validate(response)
