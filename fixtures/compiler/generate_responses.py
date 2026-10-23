"""Record actual solver evidence for installation and dispatch projection tests."""

import json
from pathlib import Path

from backend.solver import solve_lp


folder = Path(__file__).resolve().parent
models = json.loads((folder / 'models.json').read_text())
selected = ('T14-fractional-operation', 'T24-idle-', 'T18-dispatchable-power', 'T13-explicit-spill-enables-branch')
responses = [
    {'id': case['id'], 'response': solve_lp(case['request']).model_dump(mode='json')}
    for case in models if case['id'].startswith(selected)
]
(folder / 'installation-responses.json').write_text(json.dumps(responses, indent=2) + '\n')
