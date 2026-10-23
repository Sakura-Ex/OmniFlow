import pytest


@pytest.mark.skip(reason="PR-07 / T06: compute summaries from explicit boundary variables")
def test_boundary_summary(client, production_graph):
    """Show 10/s input and delivery rather than conservation residuals."""
    result = client.post("/api/calculate", json=production_graph).json()
    assert result["system_inputs"]["Net_ore"] == pytest.approx(10)
    assert result["system_outputs"]["Net_plate"] == pytest.approx(10)


@pytest.mark.skip(reason="PR-06/07: reject implicit supply through Void inputs")
def test_void_is_not_free_supply(client, production_graph):
    """Require an explicit source for positive recipe inputs."""
    production_graph["nodes"].pop(0)
    production_graph["nodes"][0]["data"]["inputs"] = {"Void_ore": 1}
    production_graph["edges"] = []
    result = client.post("/api/calculate", json=production_graph).json()
    assert result["status"] in ("invalid_model", "infeasible")


@pytest.mark.skip(reason="PR-06/07 / T04: compile explicit waste policy")
def test_no_implicit_waste_disposal(client, production_graph):
    """Reject forced waste without an explicitly permitted outlet."""
    production_graph["nodes"][1]["data"]["outputs"]["Net_waste"] = 1
    assert client.post("/api/calculate", json=production_graph).json()["status"] == "infeasible"


@pytest.mark.skip(reason="PR-05/07 / T09: lexicographic objectives replace weighted costs")
def test_slow_recipe_still_maximizes(client, production_graph):
    """Maximize delivery before minimizing machine equivalents."""
    production_graph["nodes"][0]["data"]["amount"] = 1
    production_graph["nodes"][1]["data"]["outputs"]["Net_plate"] = 0.00005
    production_graph["nodes"][2]["data"]["mode"] = "maximize"
    result = client.post("/api/calculate", json=production_graph).json()
    assert result["node_results"]["target"]["actual_amounts"]["Net_plate"] == pytest.approx(0.00005)
