import json
from unittest.mock import Mock

import pytest

from backend import main


@pytest.mark.parametrize("route", ["/api/calculate", "/api/debug"])
@pytest.mark.parametrize("node_type,data", [
    ("sourceNode", {}),
    ("sourceNode", {"id": ""}),
    ("sourceNode", {"id": "   "}),
    ("sourceNode", {"id": "ore", "mode": "auto"}),
    ("targetNode", {"id": "ore", "mode": "invalid"}),
    ("recipeNode", {"mode": "invalid"}),
    ("recipeNode", {"mode": "limit"}),
    ("recipeNode", {"mode": "limit", "manual_machines": None}),
    ("recipeNode", {"manual_machines": -1}),
    ("recipeNode", {"inputs": {"ore": -1}}),
    ("recipeNode", {"outputs": {"": 1}}),
    ("sourceNode", {"id": "ore", "amount": -1}),
    ("sourceNode", {"id": "ore", "amount": None}),
    ("sourceNode", {"id": "ore", "amount": "1"}),
    ("sourceNode", {"id": "ore", "amount": True}),
    ("unknown", {}),
    ("virtualNode", {"kind": "global_source"}),
])
def test_invalid_node_rejects_entire_graph(client, monkeypatch, production_graph, route, node_type, data):
    """Reject invalid nodes even when the other nodes are valid."""
    solver = Mock()
    monkeypatch.setattr(main, "linprog", solver)
    production_graph["nodes"].append({"id": "bad", "type": node_type, "data": data})
    response = client.post(route, json=production_graph)
    assert response.status_code == 422
    body = response.json()
    assert body["status"] == "invalid_model"
    assert body["errors"][0]["node_id"] == "bad"
    assert body["errors"][0]["path"][:2] == ["nodes", 3]
    assert "node_results" not in body
    solver.assert_not_called()


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
@pytest.mark.parametrize("field", ["amount", "inputs", "outputs", "manual_machines"])
def test_nonfinite_numbers_are_json_safe_errors(client, monkeypatch, value, field):
    """Reject nonfinite values without echoing them into JSON errors."""
    solver = Mock()
    monkeypatch.setattr(main, "linprog", solver)
    data = {"id": "ore", field: {"ore": value} if field in ("inputs", "outputs") else value}
    kind = "sourceNode" if field == "amount" else "recipeNode"
    graph = {"nodes": [{"id": "bad", "type": kind, "data": data}], "edges": []}
    response = client.post("/api/calculate", content=json.dumps(graph), headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["status"] == "invalid_model"
    solver.assert_not_called()


@pytest.mark.parametrize("graph", [
    {}, {"nodes": {}, "edges": []},
    {"nodes": [{"id": "", "type": "recipeNode"}], "edges": []},
    {"nodes": [{"id": "x", "type": "recipeNode"}] * 2, "edges": []},
    {"nodes": [], "edges": [{"source": "missing", "target": "missing"}]},
])
def test_graph_structure_errors(client, graph):
    """Use the same envelope for outer and graph-level validation."""
    response = client.post("/api/calculate", json=graph)
    assert response.status_code == 422
    assert response.json()["status"] == "invalid_model"
    assert response.json()["errors"]


def test_global_helpers_and_empty_graph(client, production_graph):
    """Accept current frontend helper nodes without treating them as supply."""
    for suffix in ("Source", "Target"):
        production_graph["nodes"].append({"id": f"Virtual_Global_{suffix}", "type": "virtualNode",
                                          "data": {"kind": f"global_{suffix.lower()}"}})
    assert client.post("/api/calculate", json=production_graph).json()["status"] == "success"
    debug = client.post("/api/debug", json=production_graph).json()
    assert debug["nodes_summary"]["source_count"] == 1
    assert client.post("/api/calculate", json={"nodes": [], "edges": []}).json()["node_results"] == {}


def test_fractional_installation(client, production_graph):
    """Keep 1.2 operating equivalents and recommend two installed machines."""
    production_graph["nodes"][2]["data"]["amount"] = 1.2
    body = client.post("/api/calculate", json=production_graph).json()
    assert body["status"] == "success"
    assert body["node_results"]["recipe"] == pytest.approx({
        "machines_exact": 1.2, "machines_actual": 2, "utilization": 0.6})


def test_fractional_source_throughput(client, production_graph):
    """T15: preserve a 0.25/s source flow rather than rounding to machines."""
    production_graph["nodes"][0]["data"]["amount"] = 0.25
    production_graph["nodes"][2]["data"]["amount"] = 0.25
    body = client.post("/api/calculate", json=production_graph).json()
    assert body["status"] == "success"
    assert body["node_results"]["source"]["actual_amounts"]["Net_ore"] == pytest.approx(0.25)


def test_recipe_without_resource_rows(client):
    """Keep a valid idle recipe serializable even when the matrix has no rows."""
    response = client.post("/api/calculate", json={
        "nodes": [{"id": "idle", "type": "recipeNode", "data": {}}], "edges": []})
    assert response.status_code == 200
    assert response.json()["node_results"]["idle"]["machines_actual"] == 0


def test_null_modes_keep_legacy_defaults(client, production_graph):
    """Default Source/Recipe/Target modes remain infinite/auto/maximize."""
    for node in production_graph["nodes"]:
        node["data"]["mode"] = None
    result = client.post("/api/calculate", json=production_graph).json()
    assert result["status"] == "unbounded"
