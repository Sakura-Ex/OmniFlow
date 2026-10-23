"""Render the checked-in backend benchmark evidence into a concise release report."""
import json
from pathlib import Path


def main():
    """Regenerate the report without replacing raw measurements or inventing missing stages."""
    root = Path(__file__).parents[2]
    direct = json.loads((root / 'backend/benchmarks/in-process-results.json').read_text())
    http = json.loads((root / 'backend/benchmarks/http-results.json').read_text())
    hardware = direct['hardware']
    versions = direct['versions']
    lines = ['# v2 backend performance measurements', '',
             f"Recorded {direct['recorded_at']} (in-process) and {http['recorded_at']} (HTTP). These are measured results on one machine, not hardware-independent performance promises.", '',
             '## Environment and method', '',
             f"- CPU: {hardware['processor']}; {hardware['logical_cpus']} logical CPUs; physical RAM {hardware['physical_memory_bytes'] / 2**30:.2f} GiB.",
             f"- OS: {hardware['platform']}. Python {versions['python']}, NumPy {versions['numpy']}, SciPy {versions['scipy']}, Pydantic {versions['pydantic']}.",
             '- Each fixed mathematical dataset has one warm-up and 20 measured requests. P50 is the median; P95 is nearest rank. Raw per-request samples are retained in the JSON files.',
             '- In-process runs use a fresh interpreter per dataset and one native HiGHS thread. HTTP runs launch an owned server from the current checkout on an ephemeral loopback port, with two solver workers, eight waiting slots, one native thread per solve, and four concurrent clients.',
             '- Existing services on ports 7998/7999 are not used. The owned benchmark server is shut down after the run.',
             '- All measured requests returned success with solver-verified feasibility. These datasets measure steady-state continuous LPs; they do not replace domain correctness or infeasible/unbounded/timeout tests.', '',
             '## Fixed dataset sizes', '',
             '| Dataset | Variables | Equality / inequality rows | Matrix nonzeros | Objective nonzeros | Layers | Matrix coefficient span | Request bytes |',
             '|---|---:|---:|---:|---:|---:|---:|---:|']
    for result in direct['results']:
        stats = result['model_stats']
        lines.append(f"| {result['dataset']} | {stats['variables']} | {stats['equality_rows']} / {stats['inequality_rows']} | {stats['matrix_nonzeros']} | {stats['objective_nonzeros']} | {stats['objective_layers']} | {result['coefficient_span']:.0f} | {result['request_bytes']} |")
    lines.extend(['', 'Chain uses sequential conserved operations; independent uses isolated source/operation/delivery networks; fan has many interchangeable branches; ratio fixes branch allocation; coefficient-span varies the operation coefficients from 0.001 to 1000 without changing delivery units.', '',
                  '## In-process latency and native memory', '',
                  'All times below are milliseconds, written as P50 / P95. Service total includes validation, sparse preparation, all objective layers and residual checks. Native solve is the sum of optimizer-call wall times.', '',
                  '| Dataset | Native solve | Service total | Process peak working set (MiB) |', '|---|---:|---:|---:|'])
    def pair(result, key):
        values = result['milliseconds'][key]
        return f"{values['p50']:.2f} / {values['p95']:.2f}"
    for result in direct['results']:
        lines.append(f"| {result['dataset']} | {pair(result, 'solve_ms')} | {pair(result, 'total_ms')} | {result['peak_working_set_bytes'] / 2**20:.2f} |")
    lines.extend(['', 'Peak working set is obtained from the actual interpreter process through the Windows process-memory API and includes Python, libraries and native allocations. It is a process high-water mark, not a model-only allocation delta; tracemalloc is not used as a substitute for native memory.', '',
                  '## HTTP runtime under four concurrent clients', '',
                  'All times below are milliseconds, written as P50 / P95. Queue is measured from request admission clock to worker dispatch and includes request parsing/validation. Server total ends before final HTTP response serialization. Round trip is measured by the client after encoding and before parsing the response.', '',
                  '| Dataset | Queue | Native solve | Server total | Client round trip |', '|---|---:|---:|---:|---:|'])
    for result in http['results']:
        lines.append(f"| {result['dataset']} | {pair(result, 'queue_ms')} | {pair(result, 'solve_ms')} | {pair(result, 'total_ms')} | {pair(result, 'roundtrip_ms')} |")
    lines.extend(['', '## Serialization and transport evidence', '',
                  'The residual overhead below is max(0, client round trip minus server total) per sample. It includes loopback transport, HTTP scheduling, response validation/serialization and client reading; it is not a pure network-transfer measurement. Percentiles of stage durations do not add up to a percentile of their sum.', '',
                  '| Dataset | Request JSON encoding | Response JSON parsing | Residual HTTP overhead | Client total |', '|---|---:|---:|---:|---:|'])
    for result in http['results']:
        lines.append(f"| {result['dataset']} | {pair(result, 'encode_ms')} | {pair(result, 'decode_ms')} | {pair(result, 'wire_overhead_ms')} | {pair(result, 'client_total_ms')} |")
    peak = http['server']['peak_working_set_bytes']
    lines.extend(['', f"The dedicated HTTP server's native-inclusive peak working set across the complete run was **{peak / 2**20:.2f} MiB**, sampled inside its actual interpreter. Per-dataset memory in the HTTP JSON belongs to the client; use the report-level server value for backend memory.", '',
                  '## Interpretation and limits', '',
                  '- The large chain has higher preparation/residual/JSON overhead than optimizer time in the serial run. Concurrent native-call wall times also include scheduling and contention; they are not isolated CPU-time measurements. No speculative optimization was added from these observations.',
                  '- This run has only 20 samples per dataset on a shared desktop. The machine was not pinned to an isolated CPU set and background workload was not controlled. Repeat the scripts on deployment hardware before capacity planning.',
                  '- Synthetic models have at most two objective layers and the recorded coefficient spans. They do not establish a performance guarantee at the configured maximum model size, maximum 32 layers, or arbitrary ill-conditioned models.',
                  '- Browser compilation, browser-to-remote-server transfer and browser rendering are not measured here. Python fixture generation_ms in raw JSON is not frontend compilation. Frontend measurements must be supplied separately; this report does not fill those acceptance cells with backend timings.',
                  '- Queue overload, queued cancellation, native-slot retention and deadline correctness are covered by deterministic runtime regression tests; these success-only latency datasets do not replace those tests.',
                  '- SciPy emits an OptimizeWarning that threads is forwarded verbatim to HiGHS. The server-owned option is explicitly passed and covered by test_native_thread_limit_is_forwarded; environment variables alone are not the thread-limit evidence.', '',
                  '## Reproduce', '', 'Run from the repository root after installing backend/requirements-dev.txt:', '', '```powershell',
                  '.venv/Scripts/python.exe -m backend.benchmarks.run --repeats 20 --output backend/benchmarks/in-process-results.json',
                  '.venv/Scripts/python.exe -m backend.benchmarks.http_run --repeats 20 --concurrency 4 --output backend/benchmarks/http-results.json',
                  '.venv/Scripts/python.exe -m backend.benchmarks.report', '```', '',
                  'The HTTP script owns its temporary server and records memory from inside that process, avoiding the Windows virtual-environment launcher PID. It stops only that owned server. Do not substitute a previously running service when collecting current-code evidence.', '',
                  'Raw evidence: [in-process results](../../../backend/benchmarks/in-process-results.json), [HTTP results](../../../backend/benchmarks/http-results.json). Dataset construction and sampling are in [run.py](../../../backend/benchmarks/run.py); isolated server orchestration is in [http_run.py](../../../backend/benchmarks/http_run.py).', ''])
    output = root / 'docs/validation/v2-completion/performance-backend.md'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text('\n'.join(lines), encoding='utf-8')


if __name__ == '__main__':
    main()
