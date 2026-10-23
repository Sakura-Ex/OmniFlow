# Regression testing

The active calculation path is the versioned sparse LP path. The frontend compiles final ports and explicit network policies; the backend no longer accepts the old graph-node payload. Historical PR-01–05 validation records describe earlier implementations, not the current API.

## Setup and commands

Documentation navigation: [index](README.md). Manual browser validation now lives in [tests/browser](../tests/browser/README.md); its documents are under `fixtures/canvas/`, and executable report/fixture helpers are under `scripts/validation/`. Recorded measurements and screenshots remain in `docs/validation/`. The normal build type-checks browser harness code and shared TypeScript fixtures without adding a production entry point.

Use the locked npm dependencies and pinned Python dependencies. The current measurement environment is Windows 11, Node 24.13.0, Python 3.14.0, SciPy 1.17.1 and Pydantic 2.13.3. No browser automation runner or coverage threshold is configured.

```powershell
npm ci
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
npm test
.venv/Scripts/python.exe -m pytest backend/tests -q
npm run build
npm run lint
git diff --check
```

For runtime-only dependencies install `backend/requirements.txt`. Start the backend with `python -m uvicorn backend.main:app --reload --port 7998`; match `VITE_BACKEND_URL` to its port. The local npm shim has previously pointed at a missing roaming installation; directly invoking `node node_modules/vitest/vitest.mjs run`, `node node_modules/typescript/bin/tsc -b`, or the installed npm CLI avoids that shim. A local sandbox may require permission to execute the virtual-environment interpreter; an execution restriction is not a failing test.

## v2 closeout — 2026-10-23

This stage closes reliability and engineering gaps; the compact/standard/detailed node display modes remain next-stage design work, with no production implementation in this change.

- Full frontend run: **317 tests in 39 files passed**. Full backend run: **183 passed**, no skips. ESLint passed with no warnings; TypeScript, production build and diff whitespace checks passed. Main JS is 772.06 kB raw / 234.64 kB gzip and retains the bundle-size warning.
- Independent test design added 31 regression cases covering saved identity, leave protection, stale save acknowledgements, atomic import/rollback, TPS/registry/installed-marker history, batch completion and system clipboard precedence. Eleven ESLint configuration tests verify that real imports obey module boundaries. HTTP policy/runtime coverage adds origin, body-limit and exception logging cases.
- Save identity excludes selection, measurements and calculation output. Successful local save acknowledges the captured document only; undo to the saved content becomes clean again. Import validates before replacement, rolls back failed application and clears old-document history on success. Export does not acknowledge local save, because a download click does not prove disk persistence.
- Settings drafts register leave protection; TPS commits valid blur/Enter as one edit. Existing batch completion precomputes the entire change before one history entry. Clipboard read success always wins over cache, including empty/invalid content; only unavailable/failed reads fall back.
- Backend defaults to exact local development/preview origins, no credentialed cross-origin requests and a cumulative 16 MiB request-body cap. Oversize input returns 413 in the LP envelope. Set OMNIFLOW_ALLOWED_ORIGINS and OMNIFLOW_MAX_BODY_BYTES in the backend process environment; copying .env.example for Vite does not export these to Python. Full model validation runs in bounded workers; JSON decoding remains on the event loop with the body cap. Exceptions log request identity and traceback without logging full submitted models.
- CI configuration now installs locked dependencies and runs frontend lint/build/tests plus backend tests; local verification does not claim a hosted GitHub Actions run. See [CI](ci.md).
- Browser smoke on an isolated frontend port confirmed TPS 20 → 30 commit, enabled undo, unsaved/stale indicators, preserved displayed results after the edit, and undo restoring TPS 20. Returning with a network draft triggered an automation timeout at the native confirmation boundary; cancellation and native unload/file-picker behavior remain unverified in the browser. Unit tests cover the guard decisions, not native dialogs. The running backend used for this UI smoke was not a newly launched backend-policy acceptance server.
- Review found no additional disposable test files: shared fixtures, browser harnesses, report generators and benchmark inputs remain useful regression/reproduction assets. The obsolete empty lint output was removed during directory cleanup. No useful test was deleted merely because it was originally written for one bug.
- Known limitations remain explicit: no autosave/crash recovery, no hosted browser automation, incomplete cross-browser/accessibility acceptance, and no new large-graph UX or performance guarantees. The SciPy warning documents forwarding the server-owned threads option to HiGHS; it is not suppressed. Current work does not add authentication, multi-user hosting or a distributed service architecture.

## Active HTTP and result contract

### v2 directory cleanup verification — 2026-10-23

After moving application shell components, recipe settings, shared drawer chrome, calculation UI, browser tooling and canvas fixtures to their owning directories:

- TypeScript build and ESLint passed; browser harness and shared TypeScript fixtures are now included in type checking.
- Frontend regression suite: 275 passed across 31 files. Backend suite: 168 passed; the existing SciPy/HiGHS thread-option warnings remain.
- Production Vite build passed; the existing main-bundle size warning remains (768.75 kB raw at this snapshot).
- The new `tests/browser/browser.html` entry built separately in memory; all 10 relocated canvas fixtures passed `readCanvasDocument` validation/migration. Validation helper scripts passed syntax checks, and relative documentation links passed existence checks.
- This was a structural cleanup, not a new interactive browser acceptance pass or new performance measurement. The three display modes remain a design/prototype only. No document schema or HTTP contract migration was introduced.

### Runtime contract

- `/api/calculate` and `/api/debug` accept only `omniflow.lp.v1`. Both delegate to the same solver runtime and return `LPResponse`, including identity, stage and residual evidence. Debug does not rebuild a second business-node matrix. It currently performs the same solve; it is not a free inspection request.
- Requests carry `request_id`, `document_revision` and `compiler_fingerprint`. The client validates the entire response and matches all identities and the variable vector to the exact request. A calculation session additionally rejects late responses after edits or newer requests. Edits mark results stale and clear dependent evidence.
- Invalid models or malformed JSON return HTTP 422; solver execution errors return 500. Mathematical success/infeasible/unbounded/limit outcomes normally return 200. Runtime overload is 503 with `queue_full`; duplicate active request IDs are 409 with `duplicate_request_id`. All use the LP envelope.
- `limit_reached` can contain a verified feasible solution with incomplete optimality evidence. A deadline can also return no solution. Neither outcome is presented as fully optimal. Infeasible/unbounded/invalid/error outcomes cannot carry a normal solution.
- `GET /api/health` is a lightweight responsiveness probe. `DELETE /api/calculate/{request_id}` removes only queued work and returns `{cancelled: boolean}`. Running native calls retain a worker slot until they actually finish; an HTTP abort does not kill Python or HiGHS.
- The runtime defaults to two solver workers, eight queued requests and one native HiGHS thread per solve. Request parsing, validation, queue waiting and solver stages consume the same wall-clock deadline. Native preprocessing/calls are not forcibly terminated at that deadline. Server model caps and bounded admission prevent an unlimited native backlog.
- Supply, delivery and spill summaries come from their explicit boundary variables. Net summaries remain separate from resource aggregates; conservation residuals are validation evidence, not throughput totals. Installation/BOM/startup results are frontend domain projections from the same compiled snapshot.
- Infeasibility diagnostics use a separate bounded elastic LP and the original run's remaining deadline. The diagnostic vector never replaces normal logistics or BOM, and failure never replaces the original infeasible state. Active limits report slack and binding status; binding alone does not establish useful expansion.

Full mathematical details and limits: [solver contract](solver-lp.md). Case-by-case evidence and outstanding acceptance boundaries: [T01–T24 matrix](validation/v2-completion/acceptance-matrix.md).

## Test ownership

| Tests | What they actually prove |
|---|---|
| `backend/tests/test_calculate_api.py` | Versioned HTTP envelope, old-graph rejection, invalid models/numbers/identity, fractional throughput, health and debug parity |
| `backend/tests/test_solver_status.py` | Real infeasible/unbounded outcomes plus deterministic native limit/error/malformed-vector handling through HTTP |
| `backend/tests/test_v2_acceptance.py` | The four former skipped mathematical counterexamples now run against explicit LP models: boundary values, no Void supply, no implicit waste and slow-recipe objective priority |
| `backend/tests/test_sparse_solver.py`, `src/common/types/lp.test.ts` | Sparse schema and cross-language evidence, duplicate sums, free/finite bounds, lexicographic locks, precision/scale invariance, shared solver budget and verified timeout incumbents |
| `networkCompiler.test.ts`, `backend/tests/test_network_compiler.py`, `fixtures/compiler/` | Current TypeScript compilation matches 31 saved models; actual SciPy solves them, including independent same-resource Nets, display-unit invariance, fixed splitter allocation, fractional/idle installation and dispatchable power |
| `diagnostics.test.ts`, `backend/tests/test_diagnostics.py`, `fixtures/diagnostics/` | Separate diagnostic requests, unchanged original bounds/status, row permission and stale/deadline handling; actual solver evidence for T03 supply and T04 outlet deficits |
| `backend/tests/test_solver_runtime.py` | Admission/overload, queued cancellation, deadline accounting, native-slot retention, off-loop execution, HTTP health responsiveness and actual native thread-option forwarding |
| `installation.test.ts`, `capEx.test.ts`, `fixtures/compiler/installation-responses.json` | Final-condition BOM and installation/startup projections; real solver response projections for 1.2/2, idle automatic/fixed installation and 100-capacity/60-load dispatch |
| `calculationClient.test.ts`, `calculationResult.test.ts`, `canvas.calculation.test.ts` | Full response acceptance, request/model mismatch rejection, boundary projection and calculation state lifecycle |
| `UnitSystem.test.ts`, `recipe.environment.test.ts` | Unit algebra, explicit TPS/cycle conversion, finite validation, display-only cache behavior and JSON reconstruction |
| `ports.test.ts`, `canvas.history.test.ts` | Persistent node-local port identities, dynamic ports, authoritative recipes and environment/registry restoration |
| `canvasDocument.test.ts`, `clipboardDocument.test.ts`, `networkCopy.test.ts`, `splitterDocument.test.ts`, `useClipboard.test.ts` | File and clipboard validation/migration, explicit policy remapping, independent copied ratio groups, splitter identity/ratio persistence and asynchronous clipboard selection safety |
| `modifier.pipeline.test.ts`, `modifier.isolation.test.ts` | Read-only Context → Effect, deterministic final ports, eligibility, dependencies, probability/occupancy/cache behavior; pure calculation entry point excludes React and UI cards |

Frontend test names in the table are under their domain feature directories. The matrix links exact paths. Schema/identity tests alone do not establish conserved graph behavior; Python LP fixtures alone do not establish browser interaction.

## Saved documents and migration

The current file format is **5**, independent of design v2 and LP schema v1. It includes plain JSON environment/units, resource registry, `pluginApiVersion: 2`, persistent ports and explicit `networkConfiguration`. Versions 2–4 migrate through the shared document reader. v3+ require a saved environment; v4+ require the modifier API version and persistent port identities; v5 requires network configuration. Validation/migration finishes before store replacement.

Legacy visible Source/Target nodes become explicit boundary policies. Old implicit Global/Void supplies and automatic waste disposal are not silently recreated: the migration warning explains that inputs need explicit sources and unconnected outputs are closed. Ambiguous legacy handles retain repair evidence. Missing TPS produces a visible default-20-TPS warning; unknown unit labels remain independent registered atoms rather than guessed conversions. Unsupported versions fail explicitly.

The same network policies must travel through export/import, clipboard remapping, database canvas save/load and undo/redo. Port policies use structured `(nodeId, portId)` addresses, not derived Net IDs. Selection copies only applicable policies and gives copied ratio groups independent identities. Old and new files use one strict compiler after migration; there is no legacy mathematical fallback.

## Historical calculation validation and browser boundary

The final integrated run reported by the coordinating agent on 2026-10-23 verified **212 frontend tests in 22 files** and **163 backend tests**, with **no skipped backend acceptance cases**. This includes 31 real compiler/solver cases, installation projections from actual solver responses and splitter-diagnostic follow-ups. ESLint passed without warnings and the production build passed with the existing main-bundle warning at approximately 677 kB; see the [continuation ledger](validation/v2-completion/README.md) for exact commands and final release status. The backend emits the documented SciPy warning that the server-owned `threads` option is forwarded to HiGHS.

Browser checks use the real application, stores and HTTP backend through the development fixture harness in `tests/browser/`. The harness is validation tooling, not an additional product calculation endpoint. Observed browser scenarios include baseline 10/s, fractional operation 1.2 with installation 2/utilization 60%/BOM 2, infeasible supply gap 1 and waste outlet gap 1, and splitter blocked/spill/capacity/zero-branch behavior. Screenshots and browser compilation/render timing belong to the continuation ledger. These observations do not claim that every UI path, native file chooser or delayed-response race was exercised.

Reproducible backend benchmarks and measured hardware/latency/memory are in [backend performance](validation/v2-completion/performance-backend.md). They use an owned temporary-port server, not an old running backend. Python fixture generation is not browser compilation, and loopback HTTP overhead is not remote network-transfer latency.

Earlier evidence remains available in [PR-01–04 validation](validation/pr-02-04/README.md) and the [historical audit repair record](technical-debt-audit-2026-10-23.md); those records do not override the active contracts above.

## 菜单与全应用 i18n 增量验证（2026-10-23）

本轮前端 Vitest 为 31 文件、275 测试通过；完整 ESLint 和 TypeScript/生产构建通过。主包约 760 kB，仍有体积提示。回归覆盖翻译键一致性、参数替换、内置名称与用户名称隔离、诊断信息保真、选中连线删除和只删除节点语义。此轮未重新运行后端 pytest。

浏览器验证中英文菜单、禁用的未实现入口、语言即时切换、配方编辑器及原料/目标/配方节点翻译。截图见 validation/ux-2026-10-23/i18n-recipe-en.png。用户数据名称与已保存单位符号保留原值。此轮不宣称覆盖所有浏览器、窄屏尺寸或每一类未知插件错误。

## 设置页与供应状态增量验证

2026-10-23：275 项前端测试（31 文件）、完整 ESLint、生产构建通过；构建仍提示主包约 766 kB。浏览器确认标题栏供应入口打开当前机器配置、资源行恢复名称与数值、设置直接进入完整页面、中英文及深浅主题即时切换、产线目标草稿从 10 改为 12 后切换分区仍保留、重置恢复 10，以及 Escape 返回画布后原计算结果保留。截图：settings-page-zh.png、settings-page-en-light.png、supply-status-compact.png，均位于 validation/ux-2026-10-23/。此次未进行窄屏实机或后端回归；该历史快照返回画布会结束未应用草稿，后续 v2 收尾已增加离开保护，分区切换仍保留草稿。
