"""Deterministic runtime admission, cancellation and deadline regression tests."""
import asyncio
import copy
from threading import Event
from time import perf_counter

from backend.solver import solve_lp, SolverLimits
from backend.solver.runtime import SolverRuntime


def test_queue_overload_cancellation_and_slot_retention(production_graph):
    """A timed-out native call retains its slot; queued cancellation frees admission."""
    async def scenario():
        entered, release = Event(), Event()
        calls = []

        def blocked(request, *, limits):
            calls.append(request.request_id)
            entered.set()
            release.wait(2)
            return solve_lp(request, limits=limits)

        runtime = SolverRuntime(workers=1, queue_size=1, solver=blocked)
        await runtime.start()
        first = copy.deepcopy(production_graph)
        first["solver_options"]["time_limit_ms"] = 50
        running = asyncio.create_task(runtime.submit(first))
        try:
            while not entered.is_set():
                await asyncio.sleep(0.001)
            second = copy.deepcopy(production_graph)
            second["request_id"] = "second"
            queued = asyncio.create_task(runtime.submit(second))
            await asyncio.sleep(0.001)
            third = copy.deepcopy(production_graph)
            third["request_id"] = "third"
            result, http = await runtime.submit(third)
            assert http == 503
            assert result.diagnostics[0].code == "queue_full"
            result, _ = await running
            assert result.status == "limit_reached"
            assert not await runtime.cancel(first["request_id"])
            assert first["request_id"] in runtime.active
            assert await runtime.cancel("second")
            cancelled, _ = await queued
            assert cancelled.diagnostics[0].code == "queued_request_cancelled"
            assert calls == ["production"]
        finally:
            release.set()
            await runtime.close()
        assert not runtime.active
    asyncio.run(scenario())


def test_queue_wait_reduces_solver_budget(production_graph):
    """Queue time is charged once, and the native service receives only the remainder."""
    async def scenario():
        entered, release = Event(), Event()
        budgets = []

        def solver(request, *, limits):
            budgets.append(request.solver_options.time_limit_ms)
            if request.request_id == "production":
                entered.set()
                release.wait(2)
            return solve_lp(request, limits=limits)

        runtime = SolverRuntime(workers=1, queue_size=1, solver=solver)
        await runtime.start()
        first = asyncio.create_task(runtime.submit(production_graph))
        try:
            while not entered.is_set():
                await asyncio.sleep(0.001)
            second = copy.deepcopy(production_graph)
            second["request_id"] = "second"
            second["solver_options"]["time_limit_ms"] = 500
            queued = asyncio.create_task(runtime.submit(second))
            await asyncio.sleep(0.025)
            release.set()
            result, http = await queued
            assert http == 200 and result.status == "success"
            assert result.timings.queue_ms >= 20
            assert result.timings.total_ms >= result.timings.queue_ms
            assert 0 < budgets[1] < 480
            await first
        finally:
            release.set()
            await runtime.close()
    asyncio.run(scenario())


def test_expired_queued_job_never_reaches_native_solver(production_graph):
    """Repeated expired work cannot build an unbounded native backlog."""
    async def scenario():
        entered, release = Event(), Event()
        calls = []

        def solver(request, *, limits):
            calls.append(request.request_id)
            entered.set()
            release.wait(2)
            return solve_lp(request, limits=limits)

        runtime = SolverRuntime(workers=1, queue_size=1, solver=solver)
        await runtime.start()
        first = asyncio.create_task(runtime.submit(production_graph))
        try:
            while not entered.is_set():
                await asyncio.sleep(0.001)
            for i in range(3):
                payload = copy.deepcopy(production_graph)
                payload["request_id"] = f"queued-{i}"
                payload["solver_options"]["time_limit_ms"] = 10
                result, _ = await runtime.submit(payload)
                assert result.status == "limit_reached"
                assert not runtime.pending
                assert len(runtime.active) == 1
            assert calls == ["production"]
        finally:
            release.set()
            await first
            await runtime.close()
    asyncio.run(scenario())


def test_size_caps_before_admission(production_graph):
    """Oversized requests fail without invoking the worker or consuming queue slots."""
    async def scenario():
        def forbidden(*args, **kwargs):
            raise AssertionError("Native solver must not run")
        runtime = SolverRuntime(workers=1, queue_size=0,
                                limits=SolverLimits(max_variables=1), solver=forbidden)
        await runtime.start()
        try:
            result, http = await runtime.submit(production_graph)
            assert http == 422 and result.status == "invalid_model"
            assert not runtime.active
        finally:
            await runtime.close()
    asyncio.run(scenario())


def test_event_loop_remains_responsive(production_graph):
    """A native call runs off-loop while an independent lightweight coroutine completes."""
    async def scenario():
        entered, release = Event(), Event()
        def solver(request, *, limits):
            entered.set()
            release.wait(2)
            return solve_lp(request, limits=limits)
        runtime = SolverRuntime(workers=1, solver=solver)
        await runtime.start()
        first = asyncio.create_task(runtime.submit(production_graph))
        try:
            while not entered.is_set():
                await asyncio.sleep(0.001)
            async def probe():
                await asyncio.sleep(0)
                return "responsive"
            assert await asyncio.wait_for(probe(), 0.1) == "responsive"
        finally:
            release.set()
            await first
            await runtime.close()
    asyncio.run(scenario())


def test_native_thread_limit_is_forwarded(monkeypatch, production_graph):
    """Set an actual HiGHS option rather than relying only on process environment."""
    from backend.solver import service
    original = service.linprog
    seen = []
    def capture(*args, **kwargs):
        seen.append(kwargs["options"]["threads"])
        return original(*args, **kwargs)
    monkeypatch.setattr(service, "linprog", capture)
    assert solve_lp(production_graph, limits=SolverLimits(max_threads=1)).status == "success"
    assert seen == [1]


def test_validation_uses_bounded_worker_and_retains_expired_slot(monkeypatch, production_graph):
    """Slow validation stays off-loop and cannot release a still-running worker."""
    from backend.solver import LPRequest
    original = LPRequest.model_validate
    entered, release = Event(), Event()

    def blocked(cls, payload, **kwargs):
        entered.set()
        release.wait(2)
        return original(payload, **kwargs)

    monkeypatch.setattr(LPRequest, "model_validate", classmethod(blocked))

    async def scenario():
        payload = copy.deepcopy(production_graph)
        payload["solver_options"]["time_limit_ms"] = 20
        runtime = SolverRuntime(workers=1, queue_size=0)
        await runtime.start()
        pending = asyncio.create_task(runtime.submit(payload))
        try:
            while not entered.is_set():
                await asyncio.sleep(0.001)
            await asyncio.wait_for(asyncio.sleep(0), 0.1)
            result, _ = await pending
            assert result.status == "limit_reached"
            assert len(runtime.active) == 1
            second = copy.deepcopy(production_graph)
            second["request_id"] = "second"
            rejected, http = await runtime.submit(second)
            assert http == 503 and rejected.diagnostics[0].code == "queue_full"
        finally:
            release.set()
            await runtime.close()
    asyncio.run(scenario())


def test_worker_exception_is_logged_without_client_details(production_graph, caplog):
    """Preserve request correlation and traceback when a worker unexpectedly fails."""
    def fail(*args, **kwargs):
        raise RuntimeError("private-worker-detail")

    async def scenario():
        runtime = SolverRuntime(solver=fail)
        await runtime.start()
        try:
            result, _ = await runtime.submit(production_graph)
            assert result.status == "solver_error"
            assert "private-worker-detail" not in result.model_dump_json()
            assert any("request_id=production" in record.getMessage() and record.exc_info for record in caplog.records)
        finally:
            await runtime.close()
    asyncio.run(scenario())


def test_http_health_and_explicit_queued_cancel(client, production_graph):
    """The API answers health/cancel while a native request holds its worker slot."""
    from concurrent.futures import ThreadPoolExecutor
    entered, release = Event(), Event()
    runtime = client.app.state.solver_runtime
    runtime.workers = 2
    def solver(request, *, limits):
        entered.set()
        release.wait(2)
        return solve_lp(request, limits=limits)
    runtime.solver = solver
    with ThreadPoolExecutor(max_workers=3) as executor:
        running = executor.submit(client.post, "/api/calculate", json=production_graph)
        assert entered.wait(1)
        try:
            before = perf_counter()
            assert client.get("/api/health").json()["status"] == "ok"
            assert perf_counter() - before < 0.5
            duplicate = client.post("/api/calculate", json=production_graph)
            assert duplicate.status_code == 409
            assert duplicate.json()["diagnostics"][0]["code"] == "duplicate_request_id"
            assert client.delete("/api/calculate/production").json() == {"cancelled": False}
            assert client.delete("/api/calculate/unknown").json() == {"cancelled": False}
        finally:
            release.set()
        assert running.result().status_code == 200
