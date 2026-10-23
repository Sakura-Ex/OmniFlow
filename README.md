# OmniFlow

English | [简体中文](docs/README_CN.md)

[![CI](https://github.com/Sakura-Ex/OmniFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/Sakura-Ex/OmniFlow/actions/workflows/ci.yml)

OmniFlow is a visual production-line planner for calculating machine quantities, resource requirements and final output rates under supply and disposal constraints. It is intended for players planning factory-game production chains, including GregTech recipes with parallelism and overclocking.

## What you can do

- **Plan for a target output.** Connect recipes, supply sources and delivery targets, then inspect operating quantities, recommended installation counts, utilization and resource flows.
- **Model only the processes you care about.** Give an input explicit external supply instead of drawing every upstream machine. Set a finite limit when supply is constrained, or sufficient supply when that part of the chain is outside your model.
- **Check bottlenecks and coproducts.** Set supply, delivery, disposal and capacity constraints. Inspect active limits and diagnostic shortages when the requested plan is infeasible.
- **Adjust machine behavior.** Edit recipes, units, TPS and supported modifiers; use wired connections, shared resource buses and fixed-ratio splitters where needed.

For example, size a steel line for 10 ingots/min, then restrict ore supply or close a coproduct outlet to inspect why that target can no longer be met.

## Quick start

Run the frontend and calculation backend locally. Use **Node.js 24 with npm** and **Python 3.13** to match the CI configuration. Installing dependencies requires Internet access. Git is needed for the clone command; a downloaded source archive also works.

```sh
git clone https://github.com/Sakura-Ex/OmniFlow.git
cd OmniFlow
```

### Windows

From PowerShell in the repository root:

```powershell
.\start.bat
```

The launcher installs missing dependencies, creates a Python virtual environment, starts both services and opens **http://127.0.0.1:5173**. Keep its window open; press Enter or Ctrl+C there to stop the services. See the [launcher guide](docs/starting.md) for diagnostics and options.

For manual setup, run this in the first terminal:

```powershell
npm ci
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 7998
```

In a second terminal, also in the repository root:

```powershell
npm run dev -- --host 127.0.0.1
```

### macOS / Linux

In the first terminal:

```sh
npm ci
cp .env.example .env
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 7998
```

In a second terminal, in the repository root:

```sh
npm run dev -- --host 127.0.0.1
```

These manual commands are for a fresh checkout; keep your existing `.env` if you have already configured one. If you change ports, update `VITE_BACKEND_URL` and the backend's allowed browser origins as described in [.env.example](.env.example). Backend settings must be exported to the Python process; Vite's `.env` does not configure Python.

### Your first calculation

1. Open **http://127.0.0.1:5173**. The starter canvas contains a steel line with a **10 ingots/min** target, explicit ore/water supply, electricity supply and coproduct outlets.
2. Click **Calculate**. Inspect machine quantities on recipe cards and expand the calculation results for resource totals. The starter document also requests an initial calculation when it opens.
3. Change the steel target to **12 ingots/min** and calculate again. Editing keeps the previous result visible with an out-of-date notice until recalculation.
4. Use **File → Save** to keep the document in this browser, or **File → Export** to download a portable JSON copy.

If calculation cannot connect, check that the backend is running at **http://localhost:7998/api/health** and that `VITE_BACKEND_URL` matches it. The frontend alone cannot solve a production line.

## Building and adjusting a line

Add recipe nodes, enter their inputs, outputs and cycle duration, and connect the processes you want to model. Set machine modifiers before calculating their required quantities.

Three boundary choices determine what may enter or leave the line:

| Boundary | Meaning |
|---|---|
| Supply | Material or energy may enter from outside the model, with a finite limit or sufficient supply. An unconnected input is not automatically supplied. |
| Delivery target | Require at least a quantity, require an exact quantity, or maximize delivery subject to the other constraints. |
| Spill / disposal | Allow surplus or coproducts to leave, optionally with a limit. Without an outlet, a coproduct can block production. |

Use a recipe card's supply/boundary settings for inputs whose upstream processes you want to omit. A global bus connects compatible ports; it does **not** create supply. The settings page holds line-wide constraints, the resource dictionary and the unit environment.

Calculate, inspect the result, adjust quantities or limits, and calculate again. Use undo/redo for document edits. Settings with an Apply or Save button remain drafts until committed; applying settings is separate from saving the document.

**Save** writes one document slot in this browser's local storage; **Open** reads it. **Export** downloads JSON; **Import** validates and loads a JSON document. Export is the way to transfer or back up a line. Browser storage is not cloud sync and can be lost if browser data is cleared. Exporting does not clear the local-save “unsaved” indicator.

## Current status and limits

The v2 calculation path, node editing, settings, Chinese/English interface and document import/export are implemented. Menu items marked unavailable are placeholders, not working commands. Current verification and remaining acceptance boundaries are in the [testing guide](docs/testing.md).

- **Steady-state planning, not a time simulation.** The continuous linear model balances average flows. It does not simulate inventory over time, automatically choose operating conditions or perform integer installation optimization. An operating quantity of 1.2 machines is distinct from an installation recommendation of 2.
- **Startup is not guaranteed by balanced flows.** A cyclic line may need an initial charge or preheating. Startup checklists flag conditions for review; they do not prove the line can start dynamically.
- **Diagnostics are guidance.** Shortages and binding limits are not necessarily the only conflict or proof that expanding a machine will help. A time-limited feasible result is not necessarily optimal.
- **Local services are required.** After dependencies are installed, editing and calculation can run without Internet access while the local frontend and backend are running. There is no installed offline/PWA mode, cloud synchronization or automatic crash recovery.
- **Local use is the deployment baseline.** The backend has no user authentication. Public or multi-user hosting requires additional deployment controls.

Use **View → Node display → Compact / Standard / Detailed** to change the whole canvas. Compact is the first-use default; all modes retain resources, ports and editing controls. Details open without resizing nodes. The mode is saved with the document and does not invalidate calculations or enter model undo history. The core delivery/installation summary remains visible when detailed results are hidden. Further large-canvas interactions are tracked in the [interaction handbook](docs/interaction-design-handbook.md).

## Development and contribution

The frontend uses TypeScript, React and React Flow; the backend uses FastAPI and SciPy/HiGHS. Frontend code compiles the production model, and the backend solves the resulting linear program.

After installing the dependencies above, run the frontend checks:

```sh
npm run lint
npm test
npm run build
```

For backend tests on Windows:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest
```

On macOS/Linux, replace `.\.venv\Scripts\python.exe` with `.venv/bin/python`. CI runs these checks; browser acceptance is documented separately. Start with [Contributing](CONTRIBUTING.md) and the [repository guidelines](AGENTS.md) before changing code.

## Further reading

- [Documentation index](docs/README.md): design, implementation status and historical evidence.
- [Interaction handbook](docs/interaction-design-handbook.md): workflows and planned interactions.
- [v2 technical design](docs/technical-design-v2-proposal.md) and [solver contract](docs/solver-lp.md): model assumptions and calculation architecture.
- [Testing](docs/testing.md) and [CI](docs/ci.md): checks, results and verification limits.

## License

[GNU GPL v3](LICENSE).
