"""Historical mathematical counterexamples run through the v2 HTTP contract."""
import pytest


def test_boundary_summary(client, production_graph):
    """T06: explicit source/delivery variables each report 10/s, separate from residuals."""
    result = client.post("/api/calculate", json=production_graph).json()
    assert result["solution"]["values"] == pytest.approx([10, 10, 10])
    assert all(abs(row["residual"]) < 1e-7 for row in result["solution"]["feasibility"]["row_residuals"])


def test_void_is_not_free_supply(client, production_graph):
    """No source variable means conservation forbids free production, regardless of names."""
    production_graph["variables"][0]["upper"] = 0
    production_graph["equalities"]["row_ids"][0] = "Void_ore"
    assert client.post("/api/calculate", json=production_graph).json()["status"] == "infeasible"


def test_no_implicit_waste_disposal(client, production_graph):
    """T04: a mandatory closed byproduct prevents production until an outlet is modeled."""
    production_graph["equalities"]["row_ids"].append("waste")
    production_graph["equalities"]["rhs"].append(0)
    production_graph["equalities"]["entries"].append({"row": 3, "col": 1, "value": 1})
    assert client.post("/api/calculate", json=production_graph).json()["status"] == "infeasible"


def test_slow_recipe_still_maximizes(client, lp_models):
    """T09: delivery priority wins even when it requires 20000 operating equivalents."""
    model = next(m for m in lp_models if m["id"] == "T09-slow-production")
    result = client.post("/api/calculate", json=model["request"]).json()
    assert result["solution"]["values"] == pytest.approx([20000, 1])
