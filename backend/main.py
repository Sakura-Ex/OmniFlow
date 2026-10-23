"""Expose the versioned mathematical LP service over HTTP."""

from contextlib import asynccontextmanager
import logging
from time import perf_counter
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.solver import LPResponse
from backend.solver.runtime import SolverRuntime
from backend.solver.schema import Diagnostic, Timings
from backend.http_policy import BodyLimitMiddleware, allowed_origins

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Own the bounded solver workers for the complete application lifetime."""
    app.state.solver_runtime = SolverRuntime()
    await app.state.solver_runtime.start()
    try:
        yield
    finally:
        await app.state.solver_runtime.close()

app = FastAPI(title="OmniFlow Backend", version="2.0.0", lifespan=lifespan)
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(
    CORSMiddleware, allow_origins=allowed_origins(), allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type"],
)


def http_response(result: LPResponse) -> JSONResponse:
    """Preserve mathematical outcomes and distinguish invalid/server failures."""
    status = {"invalid_model": 422, "solver_error": 500}.get(result.status, 200)
    return JSONResponse(status_code=status, content=result.model_dump(mode="json"))


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, error: RequestValidationError) -> JSONResponse:
    """Return the LP envelope for malformed JSON without echoing request data."""
    result = LPResponse(
        request_id=None, document_revision=None, compiler_fingerprint=None,
        status="invalid_model", solution=None, objective_results=[], model_stats=None,
        diagnostics=[Diagnostic(code=item["type"], message=item["msg"], path=list(item["loc"]))
                     for item in error.errors()],
        timings=Timings(queue_ms=0, solve_ms=0, total_ms=0),
    )
    return http_response(result)


@app.get("/api/health")
async def health() -> dict[str, str]:
    """Provide a cheap event-loop responsiveness probe."""
    return {"status": "ok", "schema_version": "omniflow.lp.v1"}



@app.middleware("http")
async def request_clock(request: Request, call_next):
    """Start the budget before request body parsing and route validation."""
    if not hasattr(request.state, "started"):
        request.state.started = perf_counter()
    return await call_next(request)


async def run_calculation(payload: dict, request: Request) -> JSONResponse:
    """Use the same runtime for calculation and debug, with no alternate modeling."""
    try:
        result, status = await request.app.state.solver_runtime.submit(payload, started=request.state.started)
    except Exception:
        request_id = payload.get("request_id")
        logger.exception("Calculation request failed request_id=%s", request_id if isinstance(request_id, str) and len(request_id) <= 200 else None)
        result = LPResponse(
            request_id=None, document_revision=None, compiler_fingerprint=None,
            status="solver_error", solution=None, objective_results=[], model_stats=None,
            diagnostics=[Diagnostic(code="request_execution_error", message="The calculation service failed to execute")],
            timings=Timings(queue_ms=0, solve_ms=0, total_ms=(perf_counter() - request.state.started) * 1000),
        )
        status = 500
    response = http_response(result)
    if status != 200:
        response.status_code = status
    return response


@app.post("/api/calculate")
async def calculate(payload: dict, request: Request) -> JSONResponse:
    """Solve only the versioned LP contract through bounded execution."""
    return await run_calculation(payload, request)


@app.post("/api/debug")
async def debug(payload: dict, request: Request) -> JSONResponse:
    """Inspect the same verified stages and residuals as the calculation service."""
    return await run_calculation(payload, request)


@app.delete("/api/calculate/{request_id}")
async def cancel_queued(request_id: str, request: Request) -> dict[str, bool]:
    """Cancel an explicitly identified queued request; never claim native termination."""
    cancelled = await request.app.state.solver_runtime.cancel(request_id)
    return {"cancelled": cancelled}
