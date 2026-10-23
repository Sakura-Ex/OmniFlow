from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from backend import main


@pytest.mark.parametrize("code,status,http", [
    (1, "limit_reached", 200), (2, "infeasible", 200), (3, "unbounded", 200),
    (4, "solver_error", 500), (99, "solver_error", 500),
])
def test_solver_status(client, monkeypatch, production_graph, code, status, http):
    """Do not publish unverified partial solutions or conflate failures."""
    monkeypatch.setattr(main, "linprog", Mock(return_value=SimpleNamespace(
        status=code, success=False, message="solver detail", x=[1])))
    response = client.post("/api/calculate", json=production_graph)
    assert response.status_code == http
    assert response.json() == {"status": status, "message": "solver detail"}


def test_solver_exception(client, monkeypatch, production_graph):
    """Return a structured server error without exposing exception details."""
    monkeypatch.setattr(main, "linprog", Mock(side_effect=RuntimeError("private details")))
    response = client.post("/api/calculate", json=production_graph)
    assert response.status_code == 500
    assert response.json()["status"] == "solver_error"
    assert "private details" not in response.text


@pytest.mark.parametrize("x", [None, [float("nan")] * 5, [1]])
def test_invalid_success_vector(client, monkeypatch, production_graph, x):
    """Reject missing, nonfinite and incorrectly sized solver vectors."""
    monkeypatch.setattr(main, "linprog", Mock(return_value=SimpleNamespace(status=0, success=True, x=x)))
    response = client.post("/api/calculate", json=production_graph)
    assert response.status_code == 500
    assert response.json()["status"] == "solver_error"


def test_real_infeasible_capacity(client, production_graph):
    """A finite supply below fixed demand is infeasible in the current model."""
    production_graph["nodes"][0]["data"]["amount"] = 1
    assert client.post("/api/calculate", json=production_graph).json()["status"] == "infeasible"


def test_real_unbounded(client, production_graph):
    """An infinite supply with an uncapped maximize target is unbounded."""
    production_graph["nodes"][0]["data"]["mode"] = "infinite"
    production_graph["nodes"][2]["data"]["mode"] = "maximize"
    assert client.post("/api/calculate", json=production_graph).json()["status"] == "unbounded"
