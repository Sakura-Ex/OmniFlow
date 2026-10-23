"""Run an owned benchmark server and sample memory inside its actual interpreter."""
import argparse
import json
import os
from pathlib import Path
from threading import Event, Thread
import time

import uvicorn
from backend.benchmarks.run import peak_memory


def main():
    """Stop gracefully via an owned file; avoid Windows launcher PID memory mistakes."""
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--directory', type=Path, required=True)
    args = parser.parse_args()
    server = uvicorn.Server(uvicorn.Config('backend.main:app', host='127.0.0.1', port=args.port, log_level='warning'))
    done = Event()
    def monitor():
        while not done.wait(.05):
            memory = dict(pid=os.getpid(), peak_working_set_bytes=peak_memory())
            target = args.directory / 'memory.json'
            temporary = args.directory / 'memory.tmp'
            temporary.write_text(json.dumps(memory))
            temporary.replace(target)
            if (args.directory / 'stop').exists():
                server.should_exit = True
    thread = Thread(target=monitor, daemon=True)
    thread.start()
    try:
        server.run()
    finally:
        done.set()
        thread.join(timeout=1)
        (args.directory / 'memory.json').write_text(json.dumps(dict(pid=os.getpid(), peak_working_set_bytes=peak_memory())))


if __name__ == '__main__':
    main()
