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
    """Provide the historical 10/s ore-to-plate regression fixture."""
    return {
        "nodes": [
            {"id": "source", "type": "sourceNode", "data": {
                "id": "Net_ore", "mode": "limit", "amount": 10}},
            {"id": "recipe", "type": "recipeNode", "data": {
                "inputs": {"Net_ore": 1}, "outputs": {"Net_plate": 1}}},
            {"id": "target", "type": "targetNode", "data": {
                "id": "Net_plate", "mode": "demand", "amount": 10}},
        ],
        "edges": [{"source": "source", "target": "recipe"},
                  {"source": "recipe", "target": "target"}],
    }
