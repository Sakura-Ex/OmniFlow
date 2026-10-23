import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    """Provide an HTTP client that surfaces server errors as responses."""
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture
def production_graph():
    """Provide an explicit conserved 10/s ore-to-plate mathematical model."""
    return {
        "schema_version": "omniflow.lp.v1", "request_id": "production",
        "document_revision": 1, "compiler_fingerprint": "production:v2",
        "variables": [{"id": name, "lower": 0, "upper": upper}
                      for name, upper in [("source", 10), ("operation", None), ("delivery", None)]],
        "equalities": {"row_ids": ["ore", "plate", "demand"], "rhs": [0, 0, 10],
                       "entries": [{"row": r, "col": c, "value": v} for r, c, v in
                                   [(0, 0, 1), (0, 1, -1), (1, 1, 1), (1, 2, -1), (2, 2, 1)]]},
        "inequalities": {"row_ids": [], "rhs": [], "entries": []},
        "objectives": [], "solver_options": {"time_limit_ms": 10000},
    }


@pytest.fixture
def lp_models():
    """Reuse the cross-language mathematical acceptance fixtures."""
    return json.loads((Path(__file__).parents[2] / "fixtures/lp/models.json").read_text())
