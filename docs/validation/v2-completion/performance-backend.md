# v2 backend performance measurements

Recorded 2026-10-23T15:52:23+0800 (in-process) and 2026-10-23T15:54:52+0800 (HTTP). These are measured results on one machine, not hardware-independent performance promises.

## Environment and method

- CPU: Intel(R) Core(TM) i9-14900K; 32 logical CPUs; physical RAM 95.69 GiB.
- OS: Windows-11-10.0.26200-SP0. Python 3.14.0, NumPy 2.4.4, SciPy 1.17.1, Pydantic 2.13.3.
- Each fixed mathematical dataset has one warm-up and 20 measured requests. P50 is the median; P95 is nearest rank. Raw per-request samples are retained in the JSON files.
- In-process runs use a fresh interpreter per dataset and one native HiGHS thread. HTTP runs launch an owned server from the current checkout on an ephemeral loopback port, with two solver workers, eight waiting slots, one native thread per solve, and four concurrent clients.
- Existing services on ports 7998/7999 are not used. The owned benchmark server is shut down after the run.
- All measured requests returned success with solver-verified feasibility. These datasets measure steady-state continuous LPs; they do not replace domain correctness or infeasible/unbounded/timeout tests.

## Fixed dataset sizes

| Dataset | Variables | Equality / inequality rows | Matrix nonzeros | Objective nonzeros | Layers | Matrix coefficient span | Request bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| chain:100 | 102 | 101 / 0 | 202 | 101 | 2 | 1 | 14453 |
| chain:1000 | 1002 | 1001 / 0 | 2002 | 1001 | 2 | 1 | 144963 |
| chain:5000 | 5002 | 5001 / 0 | 10002 | 5001 | 2 | 1 | 752963 |
| independent:1000 | 3000 | 2000 / 0 | 4000 | 2000 | 2 | 1 | 336677 |
| fan:2000 | 2002 | 2 / 0 | 4002 | 2001 | 2 | 1 | 256293 |
| ratio:1000 | 1002 | 1002 / 0 | 4002 | 1001 | 2 | 1000 | 204881 |
| coefficient-span:1000 | 1002 | 1001 / 0 | 2002 | 1001 | 2 | 1000000 | 149269 |

Chain uses sequential conserved operations; independent uses isolated source/operation/delivery networks; fan has many interchangeable branches; ratio fixes branch allocation; coefficient-span varies the operation coefficients from 0.001 to 1000 without changing delivery units.

## In-process latency and native memory

All times below are milliseconds, written as P50 / P95. Service total includes validation, sparse preparation, all objective layers and residual checks. Native solve is the sum of optimizer-call wall times.

| Dataset | Native solve | Service total | Process peak working set (MiB) |
|---|---:|---:|---:|
| chain:100 | 2.79 / 3.10 | 6.22 / 6.52 | 85.75 |
| chain:1000 | 7.75 / 8.54 | 32.44 / 38.97 | 99.27 |
| chain:5000 | 28.80 / 29.90 | 162.48 / 170.91 | 147.98 |
| independent:1000 | 15.49 / 16.97 | 79.93 / 84.99 | 116.23 |
| fan:2000 | 10.89 / 11.58 | 39.96 / 45.39 | 103.29 |
| ratio:1000 | 10.48 / 11.06 | 38.22 / 41.39 | 100.89 |
| coefficient-span:1000 | 7.81 / 8.54 | 32.45 / 38.16 | 100.67 |

Peak working set is obtained from the actual interpreter process through the Windows process-memory API and includes Python, libraries and native allocations. It is a process high-water mark, not a model-only allocation delta; tracemalloc is not used as a substitute for native memory.

## HTTP runtime under four concurrent clients

All times below are milliseconds, written as P50 / P95. Queue is measured from request admission clock to worker dispatch and includes request parsing/validation. Server total ends before final HTTP response serialization. Round trip is measured by the client after encoding and before parsing the response.

| Dataset | Queue | Native solve | Server total | Client round trip |
|---|---:|---:|---:|---:|
| chain:100 | 4.74 / 19.16 | 5.68 / 8.38 | 19.75 / 36.86 | 39.69 / 46.67 |
| chain:1000 | 60.02 / 87.78 | 52.75 / 71.30 | 186.06 / 226.01 | 238.81 / 279.31 |
| chain:5000 | 390.41 / 497.23 | 209.79 / 280.35 | 981.58 / 1230.13 | 1172.16 / 1407.17 |
| independent:1000 | 152.21 / 214.95 | 114.13 / 136.99 | 436.74 / 497.43 | 553.05 / 597.63 |
| fan:2000 | 84.55 / 129.48 | 80.30 / 105.56 | 248.51 / 282.38 | 306.81 / 335.37 |
| ratio:1000 | 69.02 / 105.68 | 60.72 / 87.38 | 208.86 / 260.47 | 284.61 / 331.25 |
| coefficient-span:1000 | 65.34 / 96.73 | 55.22 / 78.92 | 191.77 / 216.85 | 246.33 / 258.92 |

## Serialization and transport evidence

The residual overhead below is max(0, client round trip minus server total) per sample. It includes loopback transport, HTTP scheduling, response validation/serialization and client reading; it is not a pure network-transfer measurement. Percentiles of stage durations do not add up to a percentile of their sum.

| Dataset | Request JSON encoding | Response JSON parsing | Residual HTTP overhead | Client total |
|---|---:|---:|---:|---:|
| chain:100 | 0.12 / 0.13 | 0.54 / 0.60 | 19.87 / 21.56 | 40.35 / 47.36 |
| chain:1000 | 0.92 / 1.10 | 5.06 / 5.28 | 43.86 / 89.16 | 244.82 / 285.37 |
| chain:5000 | 4.42 / 6.78 | 26.26 / 28.90 | 222.61 / 280.31 | 1202.55 / 1437.12 |
| independent:1000 | 2.02 / 2.28 | 13.86 / 14.20 | 103.44 / 131.82 | 568.93 / 613.60 |
| fan:2000 | 1.62 / 1.67 | 4.47 / 4.71 | 61.21 / 83.79 | 312.83 / 341.73 |
| ratio:1000 | 1.43 / 1.78 | 5.96 / 6.35 | 71.25 / 93.10 | 292.24 / 338.54 |
| coefficient-span:1000 | 1.02 / 1.10 | 5.74 / 5.84 | 50.97 / 84.35 | 253.14 / 265.60 |

The dedicated HTTP server's native-inclusive peak working set across the complete run was **369.97 MiB**, sampled inside its actual interpreter. Per-dataset memory in the HTTP JSON belongs to the client; use the report-level server value for backend memory.

## Interpretation and limits

- The large chain has higher preparation/residual/JSON overhead than optimizer time in the serial run. Concurrent native-call wall times also include scheduling and contention; they are not isolated CPU-time measurements. No speculative optimization was added from these observations.
- This run has only 20 samples per dataset on a shared desktop. The machine was not pinned to an isolated CPU set and background workload was not controlled. Repeat the scripts on deployment hardware before capacity planning.
- Synthetic models have at most two objective layers and the recorded coefficient spans. They do not establish a performance guarantee at the configured maximum model size, maximum 32 layers, or arbitrary ill-conditioned models.
- Browser compilation, browser-to-remote-server transfer and browser rendering are not measured here. Python fixture generation_ms in raw JSON is not frontend compilation. Frontend measurements must be supplied separately; this report does not fill those acceptance cells with backend timings.
- Queue overload, queued cancellation, native-slot retention and deadline correctness are covered by deterministic runtime regression tests; these success-only latency datasets do not replace those tests.
- SciPy emits an OptimizeWarning that threads is forwarded verbatim to HiGHS. The server-owned option is explicitly passed and covered by test_native_thread_limit_is_forwarded; environment variables alone are not the thread-limit evidence.

## Reproduce

Run from the repository root after installing backend/requirements-dev.txt:

```powershell
.venv/Scripts/python.exe -m backend.benchmarks.run --repeats 20 --output backend/benchmarks/in-process-results.json
.venv/Scripts/python.exe -m backend.benchmarks.http_run --repeats 20 --concurrency 4 --output backend/benchmarks/http-results.json
.venv/Scripts/python.exe -m backend.benchmarks.report
```

The HTTP script owns its temporary server and records memory from inside that process, avoiding the Windows virtual-environment launcher PID. It stops only that owned server. Do not substitute a previously running service when collecting current-code evidence.

Raw evidence: [in-process results](../../../backend/benchmarks/in-process-results.json), [HTTP results](../../../backend/benchmarks/http-results.json). Dataset construction and sampling are in [run.py](../../../backend/benchmarks/run.py); isolated server orchestration is in [http_run.py](../../../backend/benchmarks/http_run.py).
