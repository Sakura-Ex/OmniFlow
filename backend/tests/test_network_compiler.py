"""Run actual TypeScript compiler output through the production sparse LP solver."""

import json
from pathlib import Path

import pytest

from backend.solver import solve_lp


CASES = json.loads(
    (Path(__file__).resolve().parents[2] / 'fixtures/compiler/models.json').read_text()
)


@pytest.mark.parametrize('case', CASES, ids=lambda case: case['id'])
def test_compiled_network(case):
    """Verify strict conservation, explicit boundaries, capacity and fixed loads."""
    result = solve_lp(case['request'])
    assert result.status == case['expected']['status'], result.model_dump()
    if case['expected']['values'] is None:
        assert result.solution is None
    else:
        assert result.solution is not None
        assert result.solution.feasibility.passed
        # Product lock allows 2e-8 delivery retreat at value 10. At 0.001/s
        # this propagates to 2e-5 operating equivalents in the slow recipe.
        tolerances = [1e-7] * len(case['expected']['values'])
        if case['id'] == 'T09-slow-recipe-product-priority':
            stage = result.objective_results[0]
            retreat = stage.abs_tolerance + stage.rel_tolerance * abs(stage.normalized_value)
            tolerances[0] += retreat / 0.001
        for actual, expected, tolerance in zip(result.solution.values, case['expected']['values'], tolerances):
            assert actual == pytest.approx(expected, abs=tolerance, rel=0)
        for variable_id, slack in case['expected'].get('upper_slacks', {}).items():
            evidence = next(bound for bound in result.solution.feasibility.bound_slacks
                            if bound.variable_id == variable_id)
            assert evidence.upper_slack == pytest.approx(slack, abs=1e-7)
        if case['id'] == 'T18-dispatchable-power-100-capacity-60-load':
            assert not any(variable['id'].startswith('spill:') for variable in case['request']['variables'])
