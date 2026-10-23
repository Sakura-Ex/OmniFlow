# v2 continuation: implementation and verification ledger

Status: implementation and automated acceptance complete in the local working tree (2026-10-23). Browser observations and measurement limits are explicitly listed below; this is not a claim of exhaustive UI coverage or a published release.

The user authorized GPT-6.1-sol subagents to isolate modifier modules and continue the remaining implementation-plan stages on 2026-10-23. Existing working-tree changes are preserved. PR numbers below refer to local implementation-plan stages, not published GitHub pull requests.

## Required delivery gates

| Stage | Required evidence | Status |
|---|---|---|
| Modifier isolation | Pure calculation import graph excludes React/UI/stores; renderer consumers migrated; shared GT rules; behavior regressions | Implemented; isolation regression passed |
| PR-06 | Explicit boundaries and configuration; final-port IR; conserved sparse model; provenance; compiler-to-real-solver fixtures for T01–05/07–11/17/18/22 | Implemented; 31 real-solver compiler fixtures passed |
| PR-07 | Single versioned HTTP LP path; old business model removed; validated/stale-safe results; Net/boundary summaries; migration and usable editors; browser evidence | Implemented; real HTTP/browser baseline verified |
| PR-08 | Operating/installed/existing counts; final-condition BOM; fixed loads; startup/cycle warnings; T12/14/19/24 and UI evidence | Implemented; automated acceptance and relevant browser checks passed |
| PR-09 | Budgeted elastic diagnostics; provenance navigation; honest infeasible status; capacity slack; T03/04 | Implemented; automated acceptance and relevant browser checks passed |
| PR-10 | Real splitter node, editor and compiler; ratios/capacity/no integer cost; degenerate-Net checks; copy/save/undo; T13 and UI evidence | Implemented; automated acceptance and relevant browser checks passed |
| PR-11 | Bounded queue/execution/threads; total budget including queue and diagnostics; explicit overload; concurrency and cancellation tests | Implemented; automated acceptance and relevant browser checks passed |
| PR-12 | Traceable T01–24; migration and version mismatch; fixed-dataset/hardware P50/P95 and memory; build/lint/frontend/backend/browser verification; current docs | Validated; see acceptance matrix, measurements and limits below |

## Starting evidence

The preceding corrective turn verified 160 frontend tests, 160 backend tests with four future acceptance skips, lint and build. These results are a historical baseline, not proof for the work in this continuation. The four skips must be replaced by active v2 acceptance evidence when their stages land. UI interaction and release performance require new evidence.

## Validation rules

Record actual commands and outcomes after each stage. Passing schema/shape tests alone does not prove graph conservation: compiler-produced models must be solved by the real PR-05 service. Existing LP unit tests do not prove HTTP or UI behavior. A browser screenshot alone does not prove persistence, race rejection or quantitative results; pair it with executable assertions and observed UI behavior. Do not remove effective regressions merely to make a contract switch pass; migrate their scenario to the new contract.

## Current browser observations (2026-10-23)

The test-only [browser harness](../../../tests/browser/README.md) mounts the real App. Its current entry is `tests/browser/browser.html`, with saved documents in `fixtures/canvas/`. In this recorded run, saved v5 fixtures were loaded through `readCanvasDocument`, then the normal Solve menu called the real HTTP backend on port 7999. This verifies that snapshot's calculation UI; it does not claim successful operation of the native file chooser or a new run after the directory move.

- Baseline: bounded source 10 produces input 10, delivery 10 and operation 10, with verified optimum status.
- Fractional: exact delivery 1.2 produces operation 1.2, recommended/planned installation 2, utilization 60%, catalyst BOM 2. Screenshot: [fractional](browser-fractional.png).
- Shortage: exact delivery 11 with source capacity 10 remains infeasible; separate diagnostic reports supply gap 1, with no throughput result. Screenshot: [shortage](browser-shortage.png).
- Closed coproduct: exact delivery 1 with unconnected waste remains infeasible; diagnostic reports missing outlet 1. Screenshot: [waste](browser-waste.png).

## Data-flow review

The current path is snapshot → pure modifier evaluation → final ports and canonical rates → explicit Net compilation → sparse LP → validated response → snapshot-derived installation/BOM/UI. `modifier.types.ts`, the computational registry and pipeline do not import React, stores or card renderers. Renderers are registered separately in `modifier.ui.registry.ts`; serializable UI schema metadata on a modifier definition is not a runtime UI dependency. The isolation regression rejects React/UI imports. The v1 technical-design document is now explicitly historical so its mutable Context and flat business-payload diagrams are not mistaken for current implementation.

## Final checks and integration corrections

- `npm run lint`: passed, zero errors/warnings.
- `npm run build`: passed, with Vite main-bundle size warning (676.67 kB raw / 204.07 kB gzip).
- `npm test` (direct Vitest runner in this Windows installation): 212 tests passed in 22 files.
- `.venv\Scripts\python.exe -m pytest -q`: 163 passed, no skips. SciPy emits its documented forwarding warning for the explicit HiGHS threads=1 option; this is covered by the runtime test.
- Acceptance mapping: [T01–T24](acceptance-matrix.md); measurements: [backend](performance-backend.md) and [browser](performance-browser.md).

Screenshot review caught a solved-splitter configuration/result mix-up. Runtime fields now use one shared stripping helper at compilation/persistence/copy boundaries; strict config validation remains intact. A real solver-response regression covers result→store→second compilation and clean snapshot/copy/save. The browser repeated the explicit-spill solve twice with 10→4+6, verified optimum and no broken-edge warning. Splitter edge labels now resolve real resource ports. Recipe cards now show actual per-second gross throughput separately from per-machine coefficients and catalyst occupancy.

Browser splitter cases: closed 60% branch blocks all flow; explicit spill restores input10/output4/spill6; capacity2.5 yields1+1.5; a zero-ratio closed branch does not block output10. Screenshots are linked in the acceptance matrix.

Known verification limits: native file chooser could not be automated reliably, so import/export and clipboard roundtrips are established by executable domain tests, not claimed as native-dialog evidence. Browser measurements use a development build; 5000-node rendering and browser native memory were not measured. Native backend memory is measured separately. No remote PR, commit, deployment, integer optimization or dynamic-startup proof is implied. Future MILP/time-domain acceptance remains outside v2 scope.

A final editor interaction saved fixed installation3 and existing1 for the 1.2-throughput fixture. Recalculation showed recommended2, planned3, existing1, additional2, utilization40% and catalystBOM3: [fixed-installation screenshot](browser-fixed-installation.png). The fixture-control overlay can cover lower dialog controls in the narrow validation viewport; keyboard activation was used for Save.
