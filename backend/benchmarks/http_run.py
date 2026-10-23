"""Measure a dedicated current-code HTTP process without touching existing local services."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen

def main():
    """Start an isolated ephemeral-port backend, measure it, and release its process."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--repeats', type=int, default=20)
    parser.add_argument('--concurrency', type=int, default=4)
    parser.add_argument('--datasets', nargs='+', default=['chain:100', 'chain:1000', 'chain:5000', 'independent:1000', 'fan:2000', 'ratio:1000', 'coefficient-span:1000'])
    args = parser.parse_args()
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    url = f'http://127.0.0.1:{port}'
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    with tempfile.TemporaryFile() as logs, tempfile.TemporaryDirectory(prefix='omniflow-benchmark-') as directory:
        owned = Path(directory)
        server = subprocess.Popen([sys.executable, '-m', 'backend.benchmarks.serve',
                                   '--port', str(port), '--directory', directory],
                                  stdout=logs, stderr=logs, creationflags=flags)
        try:
            deadline = time.monotonic() + 20
            while True:
                if server.poll() is not None:
                    raise RuntimeError('Dedicated benchmark server exited before readiness')
                try:
                    with urlopen(url + '/api/health', timeout=.5) as response:
                        if response.status == 200:
                            break
                except (URLError, TimeoutError):
                    pass
                if time.monotonic() > deadline:
                    raise RuntimeError('Dedicated benchmark server did not become ready')
                time.sleep(.05)
            command = [sys.executable, '-m', 'backend.benchmarks.run', '--url', url,
                       '--output', str(args.output), '--repeats', str(args.repeats),
                       '--concurrency', str(args.concurrency), '--datasets', *args.datasets]
            subprocess.run(command, check=True, creationflags=flags)
            report = json.loads(args.output.read_text())
            memory = json.loads((owned / 'memory.json').read_text())
            report['server'] = dict(ownership='dedicated subprocess launched from current checkout',
                                    workers=2, queue_capacity=8, native_threads_per_solve=1,
                                    peak_working_set_bytes=memory['peak_working_set_bytes'],
                                    memory_source='actual interpreter self measurement, including native allocations')
            report['notes'].append('HTTP server peak is the complete process high-water mark across all datasets, not a per-model allocation delta.')
            args.output.write_text(json.dumps(report, indent=2) + '\n')
        finally:
            (owned / 'stop').touch()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.terminate()
                server.kill()
                server.wait(timeout=5)


if __name__ == '__main__':
    main()
