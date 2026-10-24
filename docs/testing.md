# Regression testing

Install locked dependencies from the repository root:

```powershell
npm ci
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
npm run lint
npm test
npm run build
.venv/Scripts/python.exe -m pytest backend/tests -q
git diff --check
```

On macOS/Linux use `python3` to create the environment and `.venv/bin/python` thereafter. Runtime-only setup and the first calculation are in the [README](../README.md). [CI](ci.md) runs frontend lint/build/tests and backend tests; no coverage percentage or automated browser runner is configured.

## Coverage ownership

| Behavior | Maintained regression entry points |
|---|---|
| Conservation, explicit supply/spill, capacity, ratios, priority | `networkCompiler.test.ts` compiles the shared cases; `backend/tests/test_network_compiler.py` solves those exact saved requests with SciPy. |
| Sparse LP, units/scale, infeasible/unbounded states, timeouts | `backend/tests/test_sparse_solver.py`, `src/common/types/lp.test.ts` and `fixtures/lp/`; deterministic optimizer substitutes cover otherwise unreliable timeout/error paths. |
| HTTP validation, identities, result envelopes | `backend/tests/test_calculate_api.py`, `test_solver_status.py`, frontend `calculationClient.test.ts`. |
| Bounded execution and request policy | `backend/tests/test_solver_runtime.py`, `test_http_policy.py`: queue/cancellation/deadlines, body limits, origin policy and exception logging. |
| Diagnostics and installation | `diagnostics.test.ts`, `backend/tests/test_diagnostics.py`, `installation.test.ts`, `capEx.test.ts`; real solver responses test projection, supplied vectors isolate bookkeeping. |
| Units, modifiers and ports | `UnitSystem.test.ts`, `recipe.environment.test.ts`, `modifier.pipeline.test.ts`, `modifier.isolation.test.ts`, `ports.test.ts`. |
| Document lifecycle | File-IO tests cover validation/migration, clipboard remapping, atomic replacement, rollback and captured save identity. Canvas history tests cover authoritative recipes, unit/registry/network restoration and real undo/redo transactions. |
| Display presentation | `recipePortPresentation.test.ts`, `PortPolicyBadge.test.ts`, `resultSummary.test.ts`: unknown evidence, delivery/spill separation, installation evidence and capacity/state units. |
| Editing and result lifecycle | Canvas calculation, node operations and document-session tests cover stale results, selection/delete scope, batch atomicity, dirty tracking and leave-guard decisions. Hook tests with mocked React do not prove DOM/native-dialog behavior. |
| Workspace editing | `editorCommit.test.ts`, `planningDraft.test.ts`, `editorGuard.test.ts` and workspace hook tests cover conflict-checked atomic saves, pending-action protection, focus intent and local-only sidebar preferences. Object browser tests cover search and accepted-result issue evidence. |
| UI helpers and architecture | Combobox keyboard/search behavior, translation coverage/interpolation/custom-name preservation, and `tests/config/eslint-boundaries.test.ts` for actual import resolution. |
| First run | `canvas.initialState.test.ts` verifies that the starter line compiles with a feasible witness for its advertised target. |

Frontend names are relative to their owning modules under `src/`. Keep distinct protocol and domain tests when they protect different failure boundaries; remove duplicate assertions or cases already covered at the same boundary.

## Shared fixtures

- `fixtures/compiler/`, `fixtures/diagnostics/`, `fixtures/lp/`: cross-language inputs and solver responses consumed by tests. Their generators are retained so expected data can be reproduced; never regenerate snapshots simply to make a failing test pass.
- `fixtures/documents/legacy-v4-export.json`: an actual older export consumed by document migration tests.
- `fixtures/canvas/`: scenarios used by the [manual browser harness](../tests/browser/README.md), including insufficient supply, closed waste, fractional installation and splitter behavior.

Compiler/diagnostic request generators use Vite to load TypeScript (`node fixtures/compiler/generate.mjs`, `node fixtures/diagnostics/generate.mjs`). Python response generators use the installed backend. Review generated diffs, then run both frontend and backend suites.

## Manual and performance checks

Use the [browser harness](../tests/browser/README.md) for repeatable UI scenarios. Verify input editing, settings drafts, undo/redo, local save/import, clipboard, stale results, keyboard focus, language/theme changes and viewport sizes relevant to the change. Native file choosers and confirmation dialogs require actual browser checks, not only mocked hooks.

Keep transient measurements under ignored `artifacts/`:

```powershell
.venv/Scripts/python.exe -m backend.benchmarks.run --repeats 20 --output artifacts/benchmarks/in-process.json
.venv/Scripts/python.exe -m backend.benchmarks.http_run --repeats 20 --concurrency 4 --output artifacts/benchmarks/http.json
```

The HTTP runner owns a temporary-port backend. Compare identical datasets, versions and hardware; retain sample count and stage boundaries. Browser compilation/render timing and backend solving measure different work. There is no current universal latency or frame-rate guarantee.

## Verification boundary

The suites cover executable contracts, not proof of every UI workflow. Native confirmation cancellation, browser unload/file selection, accessibility, cross-browser behavior and database recovery still need broader acceptance. Display preference save/restore, legacy fallback, dirty tracking, history/calculation isolation and quantity-aware presentation have automated regression coverage. Chrome checks cover all three modes on the starter line and a 41-node pressure fixture, including a 5-modifier/14-resource machine; recalculation, selection, temporary details and Chinese/English changes preserve node geometry. Browser checks also cover endpoint invalid drafts/Escape/valid commit/undo, splitter editing, Delete and click-to-connect ports, 720px/480px layouts, and saving/reopening the document mode. Native-dialog and cross-browser coverage is still incomplete. This is functional inspection, not a usability study or performance guarantee.

The production build retains its main-bundle warning. SciPy warns that the server-owned `threads` option is forwarded to HiGHS; runtime tests verify that forwarding. Neither warning is suppressed. Historical test totals, screenshots and per-step reports live in Git, not in this guide.
