"""HTTP regressions for the versioned LP contract (pytest)."""
import copy
import pytest
from backend.solver import LPResponse


@pytest.mark.parametrize("route", ["/api/calculate", "/api/debug"])
def test_real_conserved_model(client, production_graph, route):
    """Preserve explicit input and delivery identities, precision and evidence."""
    response = client.post(route, json=production_graph)
    assert response.status_code == 200
    result = LPResponse.model_validate(response.json())
    assert result.status == "success"
    assert result.solution.variable_ids == ["source", "operation", "delivery"]
    assert result.solution.values == pytest.approx([10, 10, 10])
    assert result.solution.feasibility.passed
    for key in ("request_id", "document_revision", "compiler_fingerprint"):
        assert response.json()[key] == production_graph[key]


@pytest.mark.parametrize("mutate", [
    lambda p: p.update(schema_version="old"),
    lambda p: p.update(nodes=[]),
    lambda p: p["variables"].append(copy.deepcopy(p["variables"][0])),
    lambda p: p["variables"][0].update(upper=-1),
    lambda p: p["variables"][0].update(lower="0"),
    lambda p: p["variables"][0].update(lower=True),
    lambda p: p["variables"][0].update(id=""),
    lambda p: p["equalities"]["entries"][0].update(col=99),
    lambda p: p.update(document_revision=-1),
])
def test_invalid_model_rejects_entire_request(client, production_graph, mutate):
    """Reject invalid identities, numbers, bounds, versions and stale graph fields."""
    mutate(production_graph)
    response = client.post("/api/calculate", json=production_graph)
    assert response.status_code == 422
    result = LPResponse.model_validate(response.json())
    assert result.status == "invalid_model"
    assert result.solution is None
    assert result.diagnostics


def test_old_graph_is_rejected(client):
    """Never silently downgrade to the old graph-based mathematical rules."""
    result = client.post("/api/calculate", json={"nodes": [], "edges": []})
    assert result.status_code == 422
    assert result.json()["status"] == "invalid_model"


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_numbers_are_json_safe(client, production_graph, literal):
    """Reject nonfinite JSON numbers without echoing them into the response."""
    import json
    body = json.dumps(production_graph).replace('"lower": 0', '"lower": ' + literal, 1)
    response = client.post("/api/calculate", content=body, headers={"content-type": "application/json"})
    assert response.status_code == 422
    assert response.json()["status"] == "invalid_model"


def test_malformed_json(client):
    """Outer JSON parsing failures use the same runtime-validated envelope."""
    response = client.post("/api/calculate", content="{", headers={"content-type": "application/json"})
    assert response.status_code == 422
    LPResponse.model_validate(response.json())


def test_fractional_throughput(client, production_graph):
    """Source 0.25/s stays fractional; installation rounding belongs to planning."""
    production_graph["variables"][0]["upper"] = 0.25
    production_graph["equalities"]["rhs"][2] = 0.25
    assert client.post("/api/calculate", json=production_graph).json()["solution"]["values"] == pytest.approx([0.25] * 3)


def test_graph_instance_identity_not_template_identity(client, production_graph):
    """Independent operation variables cannot collapse by recipe template identity."""
    production_graph["variables"][1]["id"] = "graph-instance:recipe-template"
    result = client.post("/api/calculate", json=production_graph).json()
    assert result["solution"]["variable_ids"][1] == "graph-instance:recipe-template"


def test_empty_model_and_health(client, production_graph):
    """A valid empty feasibility problem and responsiveness endpoint remain supported."""
    production_graph.update(variables=[], equalities={"row_ids": [], "rhs": [], "entries": []})
    assert client.post("/api/calculate", json=production_graph).json()["status"] == "success"
    assert client.get("/api/health").status_code == 200
