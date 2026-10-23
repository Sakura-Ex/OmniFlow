"""HTTP boundary and private exception regressions, run with pytest."""

import asyncio
import json

import pytest

from backend.http_policy import BodyLimitMiddleware, allowed_origins
from backend.solver import LPResponse


@pytest.mark.parametrize("origin,allowed", [
    ("http://localhost:5173", True), ("http://127.0.0.1:5173", True),
    ("http://localhost:4173", True), ("http://127.0.0.1:4173", True),
    ("https://foreign.example", False), ("http://localhost:5174", False),
])
def test_exact_browser_origins(client, production_graph, origin, allowed):
    """Match preflight and actual browser access to the same exact allowlist."""
    preflight = client.options("/api/calculate", headers={
        "origin": origin, "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
    })
    response = client.post("/api/calculate", json=production_graph, headers={"origin": origin})
    assert preflight.status_code == (200 if allowed else 400)
    assert response.headers.get("access-control-allow-origin") == (origin if allowed else None)
    assert "access-control-allow-credentials" not in response.headers


def test_configured_origins_are_exact(monkeypatch):
    """Support explicit local/LAN origins without enabling wildcards."""
    monkeypatch.setenv("OMNIFLOW_ALLOWED_ORIGINS", "http://192.168.0.2:5173, http://localhost:9999")
    assert allowed_origins() == ["http://192.168.0.2:5173", "http://localhost:9999"]
    monkeypatch.setenv("OMNIFLOW_ALLOWED_ORIGINS", "*")
    with pytest.raises(ValueError):
        allowed_origins()


@pytest.mark.parametrize("length", [None, b"1", b"999"])
def test_streamed_body_limit_counts_actual_bytes(length):
    """Reject cumulative chunks regardless of a missing or false content length."""
    async def scenario():
        called, messages = [], []

        async def application(scope, receive, send):
            called.append(True)

        chunks = iter([
            {"type": "http.request", "body": b"1234", "more_body": True},
            {"type": "http.request", "body": b"5678", "more_body": True},
            {"type": "http.request", "body": b"unread", "more_body": False},
        ])

        async def receive():
            return next(chunks)

        async def send(message):
            messages.append(message)

        headers = [] if length is None else [(b"content-length", length)]
        await BodyLimitMiddleware(application, max_bytes=7)({"type": "http", "headers": headers}, receive, send)
        assert not called
        assert messages[0]["status"] == 413
        result = LPResponse.model_validate(json.loads(messages[1]["body"]))
        assert result.diagnostics[0].code == "request_body_too_large"
        assert next(chunks)["body"] == b"unread"
    asyncio.run(scenario())


def test_oversized_http_response_keeps_cors_and_health(client, monkeypatch):
    """Return the API envelope and browser headers on byte-limit rejection."""
    from backend.main import app
    app.middleware_stack = None
    monkeypatch.setenv("OMNIFLOW_MAX_BODY_BYTES", "7")
    try:
        response = client.post("/api/debug", content=b"12345678", headers={"origin": "http://localhost:5173"})
        assert response.status_code == 413
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
        LPResponse.model_validate(response.json())
        assert client.get("/api/health").status_code == 200
    finally:
        app.middleware_stack = None


def test_unexpected_request_failure_is_private_and_logged(client, production_graph, caplog, monkeypatch):
    """Keep traceback and identity in server logs, excluding details from the client."""
    async def fail(*args, **kwargs):
        raise RuntimeError("sentinel-private-path")

    monkeypatch.setattr(client.app.state.solver_runtime, "submit", fail)
    response = client.post("/api/calculate", json=production_graph)
    assert response.status_code == 500
    assert "sentinel-private-path" not in response.text
    LPResponse.model_validate(response.json())
    assert any("request_id=production" in record.getMessage() and record.exc_info for record in caplog.records)


def test_optimizer_exception_is_private_and_logged(production_graph, caplog, monkeypatch):
    """Retain a failing native stage traceback without exposing its exception string."""
    from backend.solver import service

    def fail(*args, **kwargs):
        raise RuntimeError("private-optimizer-detail")

    monkeypatch.setattr(service, "linprog", fail)
    result = service.solve_lp(production_graph)
    assert result.status == "solver_error"
    assert "private-optimizer-detail" not in result.model_dump_json()
    assert any("request_id=production" in record.getMessage() and record.exc_info for record in caplog.records)
