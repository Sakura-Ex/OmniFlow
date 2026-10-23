"""Verify actual compiler/diagnostic fixtures against SciPy rather than a fake optimizer."""
import json
from pathlib import Path
import pytest
from backend.solver import solve_lp

CASES = json.loads((Path(__file__).parents[2] / 'fixtures/diagnostics/models.json').read_text())


@pytest.mark.parametrize('case', CASES, ids=lambda case: case['id'])
def test_diagnostic_deficits(case):
    """T03 supply and T04 closed waste deficits remain hypothetical, not normal solutions."""
    assert solve_lp(case['original']).status == 'infeasible'
    response = solve_lp(case['request'])
    assert response.status == 'success'
    assert response.solution.feasibility.passed
    positive = [dict(kind=item['kind'], amount=response.solution.values[item['col']] * item['scale'])
                for item in case['relaxations'] if response.solution.values[item['col']] > 1e-7]
    assert len(positive) == 1
    assert positive[0]['kind'] == case['expected']['kind']
    assert positive[0]['amount'] == pytest.approx(case['expected']['amount'])
    # Original installation, source capacity and demand bounds remain unchanged.
    assert case['request']['variables'][:len(case['original']['variables'])] == case['original']['variables']
