"""Apply local browser access and streaming HTTP resource boundaries."""

import os
from time import perf_counter

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from backend.solver.schema import Diagnostic, LPResponse, Timings


def allowed_origins() -> list[str]:
    """Read an exact origin allowlist for development and preview browsers."""
    defaults = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
    origins = [value.strip() for value in os.getenv("OMNIFLOW_ALLOWED_ORIGINS", defaults).split(",") if value.strip()]
    if "*" in origins:
        raise ValueError("OMNIFLOW_ALLOWED_ORIGINS must contain exact origins")
    return origins


class BodyLimitMiddleware:
    """Count received bytes before forwarding a bounded body to route parsing."""

    def __init__(self, app: ASGIApp, max_bytes: int | None = None):
        self.app = app
        self.max_bytes = int(os.getenv("OMNIFLOW_MAX_BODY_BYTES", "16777216")) if max_bytes is None else max_bytes
        if self.max_bytes < 1:
            raise ValueError("OMNIFLOW_MAX_BODY_BYTES must be positive")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Reject oversized streams without trusting the declared content length."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = perf_counter()
        scope.setdefault("state", {})["started"] = started
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.max_bytes:
                result = LPResponse(
                    request_id=None, document_revision=None, compiler_fingerprint=None,
                    status="invalid_model", solution=None, objective_results=[], model_stats=None,
                    diagnostics=[Diagnostic(code="request_body_too_large", message="Request body exceeds the server byte limit")],
                    timings=Timings(queue_ms=0, solve_ms=0, total_ms=(perf_counter() - started) * 1000),
                )
                await JSONResponse(result.model_dump(mode="json"), status_code=413)(scope, receive, send)
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break
        delivered = False

        async def bounded_receive() -> Message:
            """Replay the checked body once, preserving later disconnect events."""
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, bounded_receive, send)
