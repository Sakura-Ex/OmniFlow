# Regression testing

PR-01 establishes Vitest for frontend calculation logic and pytest for the current FastAPI contract. No browser automation runner or coverage threshold is configured.

## Setup and commands

Validated on Windows with Node 24.13.0, Python 3.14.0, Vite 8.0.10, Vitest 5.0.1, Pydantic 2.13.3 and pytest 9.1.1. The backend now explicitly uses Pydantic 2; the old Pydantic 1 parsing fallback is removed. npm dependencies are locked in `package-lock.json`; Python runtime and test dependencies, including transitive dependencies, are pinned in the two requirements files.

```powershell
npm ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
npm test
.\.venv\Scripts\python.exe -m pytest -q
npm run build
npm run lint
git diff --check
```

Use `npm run test:watch` while editing frontend tests. For a runtime-only backend installation, use `backend/requirements.txt`. Start the backend with `python -m uvicorn backend.main:app --reload --port 7998` in the activated environment.

## Current API contract

- `/api/calculate` and `/api/debug` validate the entire graph before building matrices. Invalid requests return HTTP 422 with `status: invalid_model`, a message, and issues containing `node_id`, `path`, `code`, and `message`. Outer request errors use the same envelope. Invalid input values are not echoed into error JSON.
- Finite nonnegative JSON numbers are required for rates and capacities; booleans and numeric strings are rejected. Node IDs must be nonblank and unique, resource IDs nonblank, and edge endpoints must exist. Limited recipes require `manual_machines`. Omitted/null modes retain the existing defaults; unknown modes are rejected.
- The existing `Virtual_Global_Source` / `global_source` and `Virtual_Global_Target` / `global_target` helper pairs are accepted as metadata, not supply variables. Unknown helpers and node types are rejected.
- Solver statuses 0/1/2/3 map to `success` / `limit_reached` / `infeasible` / `unbounded`. Other statuses, execution exceptions, and invalid solution vectors return HTTP 500 with `solver_error`. Non-success results do not publish partial solutions.
- Recipe installation counts use `machines_actual`; `machines_exact` remains the continuous operating quantity. Missing or invalid installation counts fail BOM construction rather than falling back to fractional quantities. Source/Target throughput remains in `actual_amounts`.
- The frontend displays structured failures, clears previous node results and BOM on reset/failure, and clears errors on success. HTTP errors are distinguished from network failures. Full success-response schema validation and request revision checks remain PR-07 work.

PR-01 itself needs no saved-file migration. PR-02–04 now upgrade canvas documents to file version 4, described below. Clients submitting previously ignored invalid nodes or modes now receive errors. Deploy the corresponding frontend and backend changes together to expose all error details. The solver formulation, objective, automatic spill and system summary algorithm remain unchanged.

## Test ownership

| Tests | Coverage |
|---|---|
| `backend/tests/test_calculate_api.py` | Whole-graph rejection, invalid numbers/modes, helper compatibility, 1.2/2 installation and 0.25/s flow |
| `backend/tests/test_solver_status.py` | Real capacity infeasibility/unboundedness, deterministic mocked limit/error statuses and malformed vectors |
| `src/features/calculation/capEx.test.ts` | Installation BOM, idle exclusion, aggregation, zero-loss occupancy, incomplete results |
| `src/features/calculation/calculationClient.test.ts` | HTTP errors, validation locations, solver status and fractional response preservation |
| `src/features/canvas/canvas.calculation.test.ts` | Success → failure → success, stale node/BOM clearing and fractional endpoint mapping |

The six historical cases from the gap assessment are retained: installation and invalid Source cases run normally; four future mathematical cases live in `backend/tests/test_v2_acceptance.py` with executable intended assertions and explicit skip reasons:

- Boundary summaries (T06): PR-07.
- Implicit supply through Void: PR-06/07.
- Unpermitted waste disposal (T04): PR-06/07.
- Slow-recipe objective priority (T09): PR-05/07.

These skips are unfinished acceptance cases, not successful v2 validation. PR-01 covers T15 and the current API's numeric-validation portion of T23; duration, LP indices, versioning, and complete residual checks belong to later PRs.

## PR-01 validation record

- Before implementation: build and lint passed; build already reported a bundle-size warning.
- After implementation: 17 frontend tests passed; 67 backend tests passed and 4 future cases skipped. Build and lint passed. The bundle-size warning remains.
- On this machine the default npm shim points at a missing roaming installation. Commands were run through `node 'D:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run <script>`. Python execution and the final lint scan required execution outside the sandbox; the latter encountered sandbox access restrictions on pytest's cache directory.
- Browser smoke checks used a temporary fixture loader mounting the real App, stores, calculation hook and HTTP backend. It was removed after verification; no browser-test dependency was added. Observed 1.2 running equivalents with catalyst BOM 2, a node-located invalid-capacity error clearing previous results, and recovery to Source 0.25/s without the previous error.

Screenshots: [BOM](validation/pr-01/bom.png), [invalid model](validation/pr-01/invalid-model.png), [fractional source after recovery](validation/pr-01/fractional-source.png). System input/output summary panels remain empty under the known pre-v2 algorithm and are not claimed fixed here.

## PR-02–04 units, identity and modifier regression scope

The current file format is **4** (independent of the technical design version), with `pluginApiVersion: 2`, a plain JSON unit/environment snapshot, a resource registry snapshot, and persistent node-local `portId` handles. Version 2 is migrated using explicit legacy unit mappings and a visible default-20-TPS warning. Version 3 is accepted with its saved environment. Ambiguous legacy edges retain their original handles and repair metadata; missing current port identities and unsupported file/plugin API versions fail validation. Read/migration completes before stores are changed.

| Tests | Coverage |
|---|---|
| `src/common/units/UnitSystem.test.ts` | Prefixes, dimensions, derived relations, integer powers, affine rejection, TPS/cycle/numeric errors, JSON reconstruction, native rates without double time scaling |
| `src/features/recipe/recipe.environment.test.ts` | TPS cache invalidation, custom-category units, endpoint unit capture, display-only changes reusing physical calculations |
| `src/features/file-io/canvasDocument.test.ts` | v2/v4 migration, exact unknown-label preservation, ambiguous edge repair data, environment/schema errors, real browser-export fixture |
| `src/features/calculation/ports.test.ts` | Independent processing/cooling water, gross input/output ports, deterministic net identities, reorder/copy/round-trip stability, dynamic ports and stale-edge failure |
| `src/features/calculation/autoFillEndpoints.test.ts` | Separate endpoint identities and correct canonical-to-input-unit conversion for autofill |
| `src/features/canvas/canvas.history.test.ts` | Authoritative recipe snapshots, port identity restoration for undo/redo and database graph migration |
| `src/features/modifier/modifier.pipeline.test.ts` | Read-only Context → Effect, execution dependencies, deterministic final ports/traces, stopped eligibility, parallel/overclock order, occupancy scaling, custom-category preservation and versioned cache keys |

Native rates such as W are explicitly declared with `nativeRate` in the registry. Explicit time denominators such as EU/tick also count as complete rate expressions. A physical dimension containing seconds (for example a derived joule definition) alone is not treated as evidence that an amount is already a rate.

These steps retain the current backend formulation. T07/T08/T22 are covered here for **port and Net identity**, not for the future strict-conservation solver. Full T10 invariance of the optimized solution, T01–T06 boundary semantics and version-safe result writeback remain in their planned later steps. PR-05 now proves T09 at the independent solver boundary; its route-level acceptance remains skipped until PR-07. BOM occupancy is now a final-pipeline output; its full installation/startup interpretation remains PR-08.

Detailed implementation, migration and UI evidence: [PR-01–04 validation](validation/pr-02-04/README.md).

## PR-05 sparse LP contract and solver

`backend/tests/test_sparse_solver.py` runs **89 tests** against the independent `backend.solver.solve_lp` function. `src/common/types/lp.test.ts` runs **66 tests** against the matching Zod request/response contract. Both consume `fixtures/lp/models.json` and `responses.json`; no second HTTP calculation route is introduced. Coverage includes true lexicographic priority, explicit bounds, sparse duplicate sums, normalization invariance, infeasible/unbounded outcomes, shared budgets, verified timeout incumbents, complete objective-lock residuals and non-finite/inconsistent response rejection. See [contract, migration and fixture instructions](solver-lp.md).

The final integrated suite passes **147 frontend tests** and **156 backend tests**, with the four route-level future acceptance skips above. TypeScript, ESLint and the production build pass; the existing bundle-size warning remains. The shared CSS library also passes source colour scans and dark/light browser checks recorded in the validation document. Shared colour roles preserve existing typography and control styling. The recipe editor uses the user-requested four-block arrangement; persistent technical trace/eligibility texts are hidden while domain validation remains active.
