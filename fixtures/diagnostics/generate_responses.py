"""Refresh real diagnostic LP responses after regenerating TypeScript models."""
import json
from pathlib import Path
from backend.solver import solve_lp


def main():
    """Write deterministic evidence; timing values are not fixture assertions."""
    directory = Path(__file__).parent
    models = json.loads((directory / 'models.json').read_text())
    responses = []
    for model in models:
        original = solve_lp(model['original']).model_dump(mode='json')
        result = solve_lp(model['request']).model_dump(mode='json')
        for response in (original, result):
            response['timings'] = dict(queue_ms=0, solve_ms=0, total_ms=0)
            for stage in response['objective_results']:
                stage['elapsed_ms'] = 0
        responses.append(dict(id=model['id'], original=original, response=result))
    (directory / 'responses.json').write_text(json.dumps(responses, indent=2) + '\n')


if __name__ == '__main__':
    main()
