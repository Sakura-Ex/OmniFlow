"""Reproducible sparse LP benchmarks; run with python -m backend.benchmarks.run."""
import argparse
import ctypes
import json
import math
import os
import platform
import statistics
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.solver import solve_lp


def model(kind: str, size: int) -> dict:
    """Generate deterministic sparse mathematical datasets independent of display units."""
    if kind not in ('chain', 'coefficient-span', 'independent', 'fan', 'ratio') or not 1 <= size <= 10000:
        raise ValueError('Unknown dataset or size outside 1..10000')
    variables, entries, rhs, row_ids = [], [], [], []
    objective, costs = [], []
    def variable(name, upper=None):
        col = len(variables)
        variables.append(dict(id=name, lower=0, upper=upper))
        return col
    def row(terms):
        index = len(rhs)
        row_ids.append(f'net:{index}')
        rhs.append(0)
        entries.extend(dict(row=index, col=col, value=value) for col, value in terms)
    if kind in ('chain', 'coefficient-span'):
        previous, previous_scale = variable('source', 100), 1
        for index in range(size):
            current = variable(f'operation:{index}')
            scale = 10 ** ((index % 7) - 3) if kind == 'coefficient-span' else 1
            row([(previous, previous_scale), (current, -scale)])
            costs.append(dict(col=current, value=1))
            previous, previous_scale = current, scale
        delivery = variable('delivery')
        row([(previous, previous_scale), (delivery, -1)])
        objective.append(dict(col=delivery, value=-1))
    elif kind == 'independent':
        for index in range(size):
            source = variable(f'source:{index}', 1)
            operation = variable(f'operation:{index}')
            delivery = variable(f'delivery:{index}')
            row([(source, 1), (operation, -1)])
            row([(operation, 1), (delivery, -1)])
            objective.append(dict(col=delivery, value=-1))
            costs.append(dict(col=operation, value=1))
    else:
        source, delivery = variable('source', 100), variable('delivery')
        operations = [variable(f'branch:{index}') for index in range(size)]
        row([(source, 1), *[(col, -1) for col in operations]])
        row([*[(col, 1) for col in operations], (delivery, -1)])
        if kind == 'ratio':
            for col in operations:
                row([(col, 1), (source, -1 / size)])
        objective.append(dict(col=delivery, value=-1))
        costs.extend(dict(col=col, value=1) for col in operations)
    return dict(schema_version='omniflow.lp.v1', request_id=f'bench:{kind}:{size}',
                document_revision=1, compiler_fingerprint=f'benchmark:v1:{kind}:{size}',
                variables=variables, equalities=dict(row_ids=row_ids, rhs=rhs, entries=entries),
                inequalities=dict(row_ids=[], rhs=[], entries=[]),
                objectives=[dict(id=name, priority=priority, coefficients=coefficients,
                                 normalization_scale=1, abs_tolerance=1e-8, rel_tolerance=1e-9)
                            for name, priority, coefficients in [('delivery', 0, objective), ('operation', 1, costs)]],
                solver_options=dict(time_limit_ms=10000))


def peak_memory(pid: int | None = None) -> int | None:
    """Return process peak resident memory including native allocations, when supported."""
    if os.name == 'nt':
        from ctypes import wintypes
        class Counters(ctypes.Structure):
            _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD),
                        ('PeakWorkingSetSize', ctypes.c_size_t), ('WorkingSetSize', ctypes.c_size_t),
                        ('QuotaPeakPagedPoolUsage', ctypes.c_size_t), ('QuotaPagedPoolUsage', ctypes.c_size_t),
                        ('QuotaPeakNonPagedPoolUsage', ctypes.c_size_t), ('QuotaNonPagedPoolUsage', ctypes.c_size_t),
                        ('PagefileUsage', ctypes.c_size_t), ('PeakPagefileUsage', ctypes.c_size_t)]
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.OpenProcess(0x410, False, pid) if pid else kernel.GetCurrentProcess()
        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        api = ctypes.WinDLL('psapi').GetProcessMemoryInfo
        api.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
        success = api(handle, ctypes.byref(counters), counters.cb)
        if pid and handle:
            kernel.CloseHandle(handle)
        return counters.PeakWorkingSetSize if success else None
    if pid is None:
        import resource
        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(value * (1 if sys.platform == 'darwin' else 1024))
    return None


def percentiles(values: list[float]) -> dict:
    """Use median and nearest-rank P95 without assuming normal distributions."""
    ordered = sorted(values)
    return dict(p50=statistics.median(ordered), p95=ordered[max(0, math.ceil(len(ordered) * .95) - 1)])


def hardware() -> dict:
    """Read CPU and installed memory without requiring privileged inventory access."""
    result = dict(platform=platform.platform(), processor=platform.processor(), logical_cpus=os.cpu_count())
    if os.name == 'nt':
        import winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'HARDWARE\DESCRIPTION\System\CentralProcessor\0') as key:
            result['processor'] = winreg.QueryValueEx(key, 'ProcessorNameString')[0].strip()
        class Memory(ctypes.Structure):
            _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong),
                        *[(name, ctypes.c_ulonglong) for name in
                          ('total_physical', 'available_physical', 'total_page', 'available_page',
                           'total_virtual', 'available_virtual', 'available_extended')]]
        memory = Memory()
        memory.length = ctypes.sizeof(memory)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
            result['physical_memory_bytes'] = memory.total_physical
    elif hasattr(os, 'sysconf'):
        result['physical_memory_bytes'] = os.sysconf('SC_PHYS_PAGES') * os.sysconf('SC_PAGE_SIZE')
    return result


def sample(payload: dict, url: str | None) -> dict:
    """Separate client serialization/parsing from server-reported runtime stages."""
    started = time.perf_counter()
    encoded = json.dumps(payload, separators=(',', ':')).encode()
    encoded_at = time.perf_counter()
    if url:
        try:
            with urlopen(Request(url + '/api/calculate', data=encoded, headers={'Content-Type': 'application/json'}), timeout=15) as response:
                body = response.read()
        except HTTPError as error:
            body = error.read()
    else:
        body = solve_lp(payload).model_dump_json().encode()
    received_at = time.perf_counter()
    result = json.loads(body)
    parsed_at = time.perf_counter()
    if result['status'] != 'success':
        raise RuntimeError(f"Benchmark failed: {result['status']} {result['diagnostics']}")
    return dict(encode_ms=(encoded_at - started) * 1000, roundtrip_ms=(received_at - encoded_at) * 1000,
                decode_ms=(parsed_at - received_at) * 1000, client_total_ms=(parsed_at - started) * 1000,
                wire_overhead_ms=max(0, (received_at - encoded_at) * 1000 - result['timings']['total_ms']),
                **result['timings'], model_stats=result['model_stats'], request_bytes=len(encoded))


def measure(kind: str, size: int, repeats: int, url: str | None, concurrency: int) -> dict:
    """Warm up once, then collect raw and aggregate measurements on a fixed model."""
    started = time.perf_counter()
    payload = model(kind, size)
    generation_ms = (time.perf_counter() - started) * 1000
    sample(payload, url)
    def run(index):
        current = dict(payload, request_id=f'{payload["request_id"]}:{index}')
        return sample(current, url)
    if concurrency == 1:
        samples = [run(index) for index in range(repeats)]
    else:
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            samples = list(executor.map(run, range(repeats)))
    keys = ['encode_ms', 'roundtrip_ms', 'decode_ms', 'client_total_ms', 'wire_overhead_ms', 'queue_ms', 'solve_ms', 'total_ms']
    coefficients = [abs(entry['value']) for entry in payload['equalities']['entries'] if entry['value']]
    return dict(dataset=f'{kind}:{size}', generation_ms=generation_ms, samples=repeats, concurrency=concurrency,
                model_stats=samples[0]['model_stats'], request_bytes=samples[0]['request_bytes'],
                coefficient_min=min(coefficients), coefficient_max=max(coefficients),
                coefficient_span=max(coefficients) / min(coefficients),
                milliseconds={key: percentiles([sample[key] for sample in samples]) for key in keys},
                peak_working_set_bytes=peak_memory(), raw_samples=samples)


def main():
    """Record hardware, fixed datasets and actual measurements; no universal time promise."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--repeats', type=int, default=20)
    parser.add_argument('--datasets', nargs='+', default=['chain:100', 'chain:1000', 'chain:5000', 'independent:1000', 'fan:2000', 'ratio:1000', 'coefficient-span:1000'])
    parser.add_argument('--url')
    parser.add_argument('--concurrency', type=int, default=1)
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.repeats < 2 or args.concurrency < 1:
        parser.error('Use at least two samples and positive concurrency')
    if args.concurrency > 1 and not args.url:
        parser.error('Concurrent measurement requires the actual bounded HTTP runtime via --url')
    if args.worker:
        kind, size = args.datasets[0].split(':')
        print(json.dumps(measure(kind, int(size), args.repeats, args.url, args.concurrency)))
        return
    results = []
    for dataset in args.datasets:
        command = [sys.executable, '-m', 'backend.benchmarks.run', '--worker', '--datasets', dataset,
                   '--repeats', str(args.repeats), '--concurrency', str(args.concurrency)]
        if args.url:
            command.extend(['--url', args.url])
        process = subprocess.run(command, capture_output=True, text=True, check=True,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        results.append(json.loads(process.stdout))
    import numpy, scipy, pydantic
    report = dict(recorded_at=time.strftime('%Y-%m-%dT%H:%M:%S%z'),
                  hardware=hardware(),
                  versions=dict(python=platform.python_version(), numpy=numpy.__version__, scipy=scipy.__version__, pydantic=pydantic.__version__),
                  mode='http' if args.url else 'in-process', native_threads=1,
                  notes=['Fixed deterministic mathematical datasets; generation_ms is Python fixture generation, not browser compilation.',
                         'P95 uses nearest rank after one warm-up per dataset; raw samples are retained.',
                         'In-process peak working set includes Python, NumPy/SciPy and native allocations in a fresh process per dataset.',
                         'For HTTP mode memory belongs to the client process; collect server peak memory separately.',
                         'HTTP roundtrip includes transport, server work and response serialization; these are not independently estimated.',
                         'wire_overhead_ms is roundtrip minus server total; it includes HTTP and response serialization, not pure network latency.',
                         'Browser compilation and rendering are not measured by this backend benchmark.'], results=results)
    output = json.dumps(report, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output)
    else:
        print(output)


if __name__ == '__main__':
    main()
