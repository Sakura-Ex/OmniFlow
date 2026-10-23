"""Bound queued work and account for one end-to-end request deadline."""
import asyncio
import logging
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from time import perf_counter
from typing import Callable

from pydantic import BaseModel, ValidationError
from backend.solver import LPRequest, LPResponse, SolverLimits, solve_lp
from backend.solver.schema import Diagnostic, Timings, Identifier, Index, SolverOptions

logger = logging.getLogger(__name__)


class AdmissionIdentity(BaseModel):
    """Validate only constant-size routing metadata before bounded admission."""

    request_id: Identifier
    document_revision: Index
    compiler_fingerprint: Identifier
    solver_options: SolverOptions


@dataclass
class Job:
    """Retain admission identity and the deadline across queue and native work."""
    request: AdmissionIdentity
    payload: dict
    started: float
    deadline: float
    future: asyncio.Future
    dispatched: bool = False
    queue_ms: float = 0


class SolverRuntime:
    """Use a finite queue and dedicated worker slots; timeouts never free running slots."""

    def __init__(self, *, workers: int = 2, queue_size: int = 8,
                 limits: SolverLimits | None = None, solver: Callable = solve_lp):
        if workers < 1 or queue_size < 0:
            raise ValueError("Runtime limits must have positive workers and nonnegative queue size")
        self.limits = limits or SolverLimits()
        self.workers = workers
        self.queue_size = queue_size
        self.solver = solver
        self.pending: deque[Job] = deque()
        self.active: dict[str, Job] = {}
        self.condition = asyncio.Condition()
        self.executor = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="omniflow-solver")
        self.tasks: list[asyncio.Task] = []
        self.closed = False

    async def start(self) -> None:
        """Start exactly the configured number of queue consumers."""
        self.tasks = [asyncio.create_task(self._worker()) for _ in range(self.workers)]

    def outcome(self, request: AdmissionIdentity, code: str, started: float,
                queue_ms: float, status: str = "limit_reached") -> LPResponse:
        """Build a wire-compatible runtime outcome without publishing a fake solution."""
        return LPResponse(request_id=request.request_id, document_revision=request.document_revision,
                          compiler_fingerprint=request.compiler_fingerprint, status=status,
                          solution=None, objective_results=[], model_stats=None,
                          diagnostics=[Diagnostic(code=code, message=code.replace("_", " "), path=[])],
                          timings=Timings(queue_ms=queue_ms, solve_ms=0,
                                          total_ms=max(0, (perf_counter() - started) * 1000)))

    async def submit(self, payload: dict, *, started: float | None = None) -> tuple[LPResponse, int]:
        """Bound admission before expensive validation and charge all work to one budget."""
        started = perf_counter() if started is None else started
        try:
            request = AdmissionIdentity.model_validate(payload)
        except ValidationError as error:
            result = LPResponse(
                request_id=None, document_revision=None, compiler_fingerprint=None,
                status="invalid_model", solution=None, objective_results=[], model_stats=None,
                diagnostics=[Diagnostic(code=item["type"], message=item["msg"], path=list(item["loc"]))
                             for item in error.errors(include_input=False, include_context=False, include_url=False)],
                timings=Timings(queue_ms=0, solve_ms=0, total_ms=(perf_counter() - started) * 1000),
            )
            return result, 422
        # Server-owned size caps are checked before work can consume a queue slot.
        def length(value: object) -> int:
            """Read collection sizes without traversing unvalidated model entries."""
            return len(value) if isinstance(value, list) else 0

        row_sets = [payload.get(name) for name in ("equalities", "inequalities")]
        row_sets = [rows for rows in row_sets if isinstance(rows, dict)]
        objectives = payload.get("objectives")
        if length(objectives) > self.limits.max_objective_layers:
            return self.outcome(request, "model_size_limit", started, 0, "invalid_model"), 422
        entries = sum(length(rows.get("entries")) for rows in row_sets)
        entries += sum(length(item.get("coefficients")) for item in (objectives or []) if isinstance(item, dict)) if isinstance(objectives, list) else 0
        if (length(payload.get("variables")) > self.limits.max_variables
                or sum(length(rows.get("row_ids")) for rows in row_sets) > self.limits.max_rows
                or entries > self.limits.max_nonzeros):
            return self.outcome(request, "model_size_limit", started, 0, "invalid_model"), 422
        budget = min(request.solver_options.time_limit_ms, self.limits.max_time_limit_ms) / 1000
        deadline = started + budget
        loop = asyncio.get_running_loop()
        job = Job(request, payload, started, deadline, loop.create_future())
        async with self.condition:
            if self.closed:
                return self.outcome(request, "runtime_closed", started, 0), 503
            if request.request_id in self.active:
                return self.outcome(request, "duplicate_request_id", started, 0, "invalid_model"), 409
            if len(self.active) >= self.workers + self.queue_size:
                return self.outcome(request, "queue_full", started, 0), 503
            self.active[request.request_id] = job
            self.pending.append(job)
            self.condition.notify()
        try:
            remaining = max(0, deadline - perf_counter())
            return await asyncio.wait_for(asyncio.shield(job.future), remaining), 200
        except asyncio.TimeoutError:
            await self.cancel(request.request_id, code="queue_budget_exhausted")
            queue_ms = job.queue_ms if job.dispatched else max(0, (perf_counter() - started) * 1000)
            return self.outcome(request, "request_budget_exhausted", started, queue_ms), 200
        except asyncio.CancelledError:
            await self.cancel(request.request_id)
            raise

    async def cancel(self, request_id: str, *, code: str = "queued_request_cancelled") -> bool:
        """Remove only queued work; native calls remain bounded by their solver budget."""
        async with self.condition:
            job = self.active.get(request_id)
            if job is None or job.dispatched:
                return False
            self.pending.remove(job)
            del self.active[request_id]
            if not job.future.done():
                job.future.set_result(self.outcome(job.request, code, job.started,
                                                   (perf_counter() - job.started) * 1000))
            return True

    async def _worker(self) -> None:
        """Retain the slot until the native future actually completes."""
        while True:
            async with self.condition:
                await self.condition.wait_for(lambda: self.pending or self.closed)
                if not self.pending:
                    return
                job = self.pending.popleft()
                job.dispatched = True
            queue_ms = max(0, (perf_counter() - job.started) * 1000)
            job.queue_ms = queue_ms
            remaining_ms = (job.deadline - perf_counter()) * 1000
            if remaining_ms <= 0:
                result = self.outcome(job.request, "queue_budget_exhausted", job.started, queue_ms)
            else:
                try:
                    result = await asyncio.get_running_loop().run_in_executor(
                        self.executor, lambda: self._execute(job))
                    result.timings.queue_ms = queue_ms
                    result.timings.total_ms = max(0, (perf_counter() - job.started) * 1000)
                    if perf_counter() > job.deadline and result.status == "success":
                        result.status = "limit_reached"
                        result.diagnostics.append(Diagnostic(code="request_budget_exhausted",
                                                              message="Request deadline exceeded", path=[]))
                except Exception:
                    logger.exception("Solver runtime failed request_id=%s", job.request.request_id)
                    result = self.outcome(job.request, "runtime_execution_error", job.started,
                                          queue_ms, "solver_error")
            async with self.condition:
                self.active.pop(job.request.request_id, None)
                if not job.future.done():
                    job.future.set_result(result)

    def _execute(self, job: Job) -> LPResponse:
        """Validate inside the fixed worker pool and pass only the remaining budget."""
        try:
            request = LPRequest.model_validate(job.payload)
        except ValidationError:
            return solve_lp(job.payload, limits=self.limits)
        remaining_ms = (job.deadline - perf_counter()) * 1000
        if remaining_ms <= 0:
            return self.outcome(job.request, "request_budget_exhausted", job.started, job.queue_ms)
        if request.solver_options.time_limit_ms > self.limits.max_time_limit_ms:
            return self.outcome(job.request, "time_limit_exceeded", job.started, job.queue_ms, "invalid_model")
        request.solver_options.time_limit_ms = remaining_ms
        return self.solver(request, limits=self.limits)

    async def close(self) -> None:
        """Reject queued work and await genuine completion before releasing the executor."""
        self.closed = True
        for request_id in list(self.active):
            await self.cancel(request_id, code="runtime_closed")
        async with self.condition:
            self.condition.notify_all()
        await asyncio.gather(*self.tasks)
        self.executor.shutdown(wait=True, cancel_futures=True)
