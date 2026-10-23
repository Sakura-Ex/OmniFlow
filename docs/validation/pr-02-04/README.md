# PR-01–04 implementation and validation

Date: 2026-10-23. Local commits on `feat/v2-base` preserve the original HEAD and group PR-01, independent PR-05, and the integrated PR-02–04/style changes separately. The user requested keeping intertwined integration changes together rather than forcing one commit per plan step. Pre-existing unrelated documentation edits remain outside these commits. No pull request was created. The backend mathematical formulation remains the pre-v2 formulation; these changes do not claim that the strict v2 solver is live.

## Delivered behavior and evidence

| Step | Delivered behavior | Authoritative evidence |
|---|---|---|
| PR-01 | Whole-graph API validation, structured failures, truthful solver status distinctions, `machines_actual` BOM consumption and fractional endpoint throughput | Existing `backend/tests/test_calculate_api.py`, `test_solver_status.py`, frontend calculation/client/BOM tests and [PR-01 screenshots](../pr-01/) |
| PR-02 | `UnitRegistry`, immutable `Unit`/`Quantity`, explicit `UnitSystem` environment, structured factors, separate prefixes, derived expansion, compatible arithmetic, finite-value/cycle/TPS/cycle-definition validation | [Unit tests](../../../src/common/units/UnitSystem.test.ts) |
| PR-02 integration | One rate adapter for recipes, endpoints, formatting, GT capacity and tick conversion; TPS invalidates previews; display-only changes reuse physical-rate cache | [Environment tests](../../../src/features/recipe/recipe.environment.test.ts), [GT tests](../../../src/features/modifier/modifier.pipeline.test.ts), [autofill tests](../../../src/features/calculation/autoFillEndpoints.test.ts) |
| PR-02 persistence | Plain JSON environment/definitions/prefixes and resource registry; v2/v3 → v4 validation/migration; project settings retain explicit environment snapshots | [Document tests](../../../src/features/file-io/canvasDocument.test.ts), `ProjectService.saveEnvironment/readEnvironment`, real [browser export](export-roundtrip.json) |
| PR-03 | Persistent node-local port identity independent of resource identity, final-port routing before aggregation, deterministic Net identities, resource/unit compatibility checks | [Port tests](../../../src/features/calculation/ports.test.ts) |
| PR-03 editing | New copied port/modifier identities and internal-edge remapping; reorder stability; obsolete/ambiguous edges remain repairable; authoritative undo/redo recipe snapshots | [History tests](../../../src/features/canvas/canvas.history.test.ts), [port tests](../../../src/features/calculation/ports.test.ts), browser evidence below |
| PR-04 | Read-only Context → Effect, centralized application, explicit dependency/order checks, final ports, eligibility/reasons, actual parallel count, occupancy bases and trace; unknown plugins/categories are not silently discarded | [Pipeline tests](../../../src/features/modifier/modifier.pipeline.test.ts) |
| PR-04 integration | Final dynamic ports feed topology; stale handles fail with node/port location; energy-only facilities are eligible; stopped machines preserve port evidence and cannot be submitted as runnable recipes | [Port tests](../../../src/features/calculation/ports.test.ts), pipeline tests, browser evidence below |

## Contract and migration details

- `UnitExpression` is a product of `{ baseUnitId, prefixId?, exponent }` factors. A prefix replaces a factor's prefix; it is never guessed by splitting arbitrary labels. `kg` and `mL` have explicit legacy mappings. Unknown labels become separate `legacy:<label>` atoms with no prefix. The default game registry treats mB as an independent atom; games may declare an explicit relation to L.
- Registry relations normalize to a multiplier plus sorted atomic exponents. EU and RF remain separate atoms. Resource identity is checked separately before connections can share a Net.
- `tick` is a contextual time unit; `s` is the reserved canonical time atom. `cycle` remains recipe semantics. W declares `nativeRate: true`; explicit denominators such as EU/tick are already rate expressions. Explicit time factors cancel first, so W × s is an energy amount. Derived physical dimensions alone do not imply a native rate. No operation rounds physical values.
- New files use `version: 4` and `pluginApiVersion: 2`. Version 2 files without an environment visibly disclose default 20 TPS. Version 3 requires its saved environment. The file version and design-v2 name are separate version systems.
- Only uniquely resolvable legacy resource handles migrate automatically. Ambiguous edges retain handles and `legacyHandles`/`portIssue` data. The repair panel selects the affected edge and nodes. Deleted or dynamically removed ports are also located by compilation and the panel. No solver call is made with a stale handle.
- `_uid` remains a UI tracking field. Migration checks node-wide uniqueness before reusing it as an initial `portId`; persisted duplicate `portId` values fail. New editor ports, clones and autofill endpoints receive independent identities. Undo snapshots store authoritative editable recipes, not stale canvas labels or derived `_computed` payloads.
- Custom modifiers implement API 2 with a positive numeric implementation `version`, read-only Context and declarative Effect. `requires` means a mandatory earlier dependency; `after` constrains order when the dependency is present. New dynamic ports must use `dynamic:<instanceId>:<stable-local-key>`. Plugins must be deterministic for a fixed snapshot and increment their implementation version when their behavior changes. Unsupported or unknown plugins fail explicitly.
- Existing GT algorithms remain recognizable. The GT utility template now explicitly maps legacy `eu_per_tick` metadata to its energy port; previously generic key inference looked for `gt_eu_per_tick`. GT energy capacity calculations convert the declared port expression to EU/tick, so prefixes do not change eligibility or overclock behavior. The plugin owns the tick floor using the captured environment.
- Occupancy records distinguish per-slot, per-running-machine and per-installed-machine bases. The pipeline scales per-cycle/per-slot recipe work for parallel operations while preserving per-machine occupancy. Full installed-capacity/fixed-load/startup interpretation remains PR-08.
- Project environment snapshots are saved with project settings and restored on switching projects; legacy project TPS is disclosed when default definitions are used. Canvas local saves and JSON exports carry their own full environment and registry.

## Validation performed

Final integrated validation passes **147 frontend tests in 11 files** (81 for PR-01–04 and 66 for the independent PR-05 contract). TypeScript checking and ESLint pass (zero errors and zero warnings). The production bundle builds; the existing >500 kB bundle-size warning remains. The backend suite passes **156 tests** (67 existing tests and 89 for PR-05), with **4 explicitly skipped** future mathematical acceptance cases. An initial Windows native-thread diagnostic appeared during one earlier backend run; the isolated status suite and subsequent full suites passed without that diagnostic. See [PR-05 implementation and fixtures](../../solver-lp.md).

The machine's default npm launcher points at a missing roaming npm installation. Equivalent local runner commands were used:

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b --noEmit
node node_modules/eslint/bin/eslint.js .
node node_modules/vite/bin/vite.js build
.venv\Scripts\python.exe -m pytest -p no:cacheprovider
git diff --check
```

Python tests require execution outside this environment's sandbox to start the repository Python 3.14 environment. The frontend runners do not require escalation. No additional browser-test framework or dependency was introduced.

## Browser checks

The real app was tested at localhost in the in-app browser:

1. Opened the Electrolyzer editor and converted 1000 mB/cycle to 1 kmB/cycle. The canonical preview remained 200 mB/s; after saving the node correctly showed 0.2 kmB/s. [Unit editor screenshot](unit-expression.png).
2. Deleted its connected oxygen output. The graph retained the edge and showed `Missing output port: node-1/output:1` in the repair panel. [Missing-port screenshot](missing-port.png).
3. Used the normal Edit → Undo action. The original oxygen port and resource-labeled connection returned, and the repair panel disappeared. [Restored graph screenshot](undo-restored.png).
4. Verified the GT step's before/after duration and actual parallel count. Trace evidence remains in the deterministic pipeline output and tests; the user subsequently requested removal of the technical trace from the editor and eligibility text from canvas nodes. Those persistent diagnostic texts are no longer rendered. Supply failures still block calculation and use a short Chinese message when calculation is requested.
5. Added GT Parallel below GT Overclocker. Save displayed the dependency error and did not commit the invalid configuration. The draft was then cancelled. The earlier [order-error screenshot](modifier-order-error.png) includes the now-removed inline trace display; execution-order validation remains active.
6. Exported through the normal File → Export JSON action. The resulting [v4 fixture](export-roundtrip.json) has six nodes, four edges, four recipes, 20 TPS, explicit port identities/unit expressions and no `_computed` data. A regression test reads this exact browser-produced file back through the production migration/validation path.
7. Repeated the unit conversion with the final shared styles, then used Edit → Undo → Redo. The authoritative amount and unit changed from 1 kmB to 1000 mB and back to 1 kmB; the canonical rate remained 200 mB/s. Snapshot capture happens synchronously before restoration, including redo snapshots.
8. Verified the requested four-block editor at 1600 × 900 in both themes. Input/output tables have more width, and the machine-properties panel scrolls independently to expose hardware and facility settings. The compact unit picker converted 1000 mB to 1 kmB; changing only the display unit to mB/s retained that input amount and the 200 mB/s preview. Saving and reopening preserved both choices. No persistent eligibility message or technical trace appeared on the node or in the editor.
9. Fixed selection decoration overriding the invalid node's red outer ring: selected and unselected invalid nodes retain the same red border and 2px outer ring. Restored the original default category palette and explicitly retained category-badge typography (11px, normal weight, original sans-serif family). Light-theme badge ink blends with the theme text for legibility; saved category colours remain unchanged. Evidence: [selected invalid node](invalid-node-selected.png).

## Shared CSS library

The separately delegated style work centralizes UI colours in `src/common/styles/tokens.css`, with one blue primary accent, neutral surfaces and semantic success/warning/error colours. `primitives.module.css` supplies shared colour and state roles; feature CSS Modules preserve existing typography, sizes and layout. Shared roles must not introduce font shorthands, spacing, dimensions or positioning that override existing controls. The theme applies to the document root and app shell, covering native controls and portals. Persisted resource colours remain domain data in a bounded default palette and user-defined registry values. See [library usage](../../../src/common/styles/README.md).

Typography and existing control styling are preserved. The unintended HUD repositioning/automatic collapsing and resource-card layouts were removed, retaining the original menu/HUD positions and resource-table structure. The user then explicitly requested a four-block recipe editor: input above output on the left, machine properties above modifiers on the right. That authorized arrangement replaces the original three columns. Unit selection uses a compact control consistent with the existing inputs; advanced unit expressions are edited on demand. Technical pipeline traces remain internal, while repair feedback and computation validation remain functional.

Current browser evidence: [four-block editor](recipe-settings-four-panels.png), [compact unit picker](unit-picker.png), [dark editor](theme-dark.png) and [light editor](theme-light.png). The earlier `responsive-canvas.png` records the superseded layout and is not the current UI. Production TS/TSX/CSS scans find no hex/RGB/HSL or named UI palette colours outside the central theme and resource-default palette; branded SVG assets and fixtures are excluded.

## Deliberately deferred acceptance

The existing four route-level backend skips remain T06 summary correctness, implicit Void supply, unpermitted waste disposal (T04), and slow-recipe priority (T09). PR-05 now proves lexicographic priority and numerical evidence at the independent solver-function boundary; activating it requires PR-06/07. The current backend route still has its old conservation, spill, objective and summary semantics. T07/T08/T22 here prove identity and coefficient routing, not strict mathematical conservation. Full optimized-solution invariance for T10 and all PR-07 runtime revision checks remain future acceptance. MILP, inventory timing, edge capacity, automatic operating-point selection and complete startup reasoning remain out of scope as planned.
