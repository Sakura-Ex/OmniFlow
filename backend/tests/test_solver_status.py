"""Exercise solver outcomes through the versioned HTTP boundary."""
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from backend.solver import service


@pytest.mark.parametrize("code,status,http", [(1, "limit_reached", 200), (2, "infeasible", 200), (3, "unbounded", 200), (4, "solver_error", 500), (99, "solver_error", 500)])
def test_solver_status(client, monkeypatch, production_graph, code, status, http):
    """Preserve truthful mathematical and server error terminal states."""
    monkeypatch.setattr(service, "linprog", Mock(return_value=SimpleNamespace(status=code, success=False, message="detail", x=None)))
    response = client.post("/api/calculate", json=production_graph)
    assert response.status_code == http
    assert response.json()["status"] == status
    assert response.json()["solution"] is None


def test_solver_exception(client, monkeypatch, production_graph):
    """Keep private native execution errors out of the response."""
    monkeypatch.setattr(service, "linprog", Mock(side_effect=RuntimeError("private details")))
    response = client.post("/api/calculate", json=production_graph)
    assert response.status_code == 500
    assert response.json()["status"] == "solver_error"
    assert "private details" not in response.text


@pytest.mark.parametrize("x", [None, [float("nan")] * 3, [1]])
def test_invalid_success_vector(client, monkeypatch, production_graph, x):
    """Refuse missing, nonfinite and incorrectly sized success vectors."""
    monkeypatch.setattr(service, "linprog", Mock(return_value=SimpleNamespace(status=0, success=True, x=x)))
    response = client.post("/api/calculate", json=production_graph)
    assert response.status_code == 500
    assert response.json()["status"] == "solver_error"


def test_real_infeasible_capacity(client, production_graph):
    """Explicit finite supply cannot satisfy a larger hard demand."""
    production_graph["variables"][0]["upper"] = 1
    assert client.post("/api/calculate", json=production_graph).json()["status"] == "infeasible"


def test_real_unbounded(client, lp_models):
    """Uncapped delivery maximization stays unbounded without implicit limits."""
    model = next(m for m in lp_models if m["id"] == "T16-unbounded")
    assert client.post("/api/calculate", json=model["request"]).json()["status"] == "unbounded"
