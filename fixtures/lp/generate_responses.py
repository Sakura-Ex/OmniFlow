"""Refresh deterministic cross-language response fixtures from the real LP service."""

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from backend.solver import solve_lp


def main() -> None:
    """Write real-model responses plus controlled timeout/error contract examples."""
    folder = Path(__file__).resolve().parent
    cases = json.loads((folder / "models.json").read_text())
    responses = [{"id": case["id"], "response": solve_lp(case["request"]).model_dump()} for case in cases]
    with patch("backend.solver.service.linprog", Mock(side_effect=[
        SimpleNamespace(status=0, success=True, x=[20000, 1]),
        SimpleNamespace(status=1, success=False, x=None),
    ])):
        responses.append({"id": "T21-verified-first-layer-timeout", "response": solve_lp(cases[0]["request"]).model_dump()})
    with patch("backend.solver.service.linprog", Mock(side_effect=RuntimeError("private detail"))):
        responses.append({"id": "solver-exception", "response": solve_lp(cases[0]["request"]).model_dump()})
    responses.append({"id": "invalid-model", "response": solve_lp({"schema_version": "unsupported"}).model_dump()})
    for case in responses:
        case["response"]["timings"] = {"queue_ms": 0, "solve_ms": 0, "total_ms": 0}
        for stage in case["response"]["objective_results"]:
            stage["elapsed_ms"] = 0
    (folder / "responses.json").write_text(json.dumps(responses, indent=2, allow_nan=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
