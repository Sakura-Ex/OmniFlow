# Documentation maintenance status

Updated 2026-10-23. This file records documentation entry points and validation scope; it does not claim universal docstring coverage. Follow [AGENTS.md](../AGENTS.md) and [DOCSTRING_GUIDELINES.md](DOCSTRING_GUIDELINES.md).

## Active configuration

TypeScript uses the JSDoc rules in `eslint.config.js`, including required public documentation, parameter-name checks and return documentation. Python conventions are specified in `pyproject.toml` and the repository guidelines. The final coordinated v2 ESLint run passed without warnings; a lint result is not a manual proof that every comment remains semantically accurate.

## Current calculation and backend entry points

| Area | Active documentation targets |
|---|---|
| Versioned HTTP | `backend/main.py`: `calculate`, `debug`, health, queued cancellation and runtime lifetime |
| Mathematical contract | `backend/solver/schema.py`, `src/common/types/lp.ts`: sparse LP request, response, identity, stages and evidence |
| Solver/runtime | `backend/solver/service.py`, `runtime.py`: lexicographic objectives, residual checks, bounded admission and total deadlines |
| Frontend compiler | `src/features/calculation/networkCompiler.ts`: `compileNetwork`, final ports, deterministic Nets, explicit boundaries, configuration and provenance |
| Results | `calculationResult.ts`, `installation.ts`, `capEx.ts`: continuous operation, selected installation, final occupancy BOM and startup conditions |
| Diagnostics | `diagnostics.ts`, `DiagnosticsPanel.tsx`: permitted elastic assumptions, separate hypothetical deficits, active-limit slack and location controls |
| Modifiers | Computational `modifier.registry.ts` / `modifier.pipeline.ts`; separate `modifier.ui.registry.ts`; readonly Context → Effect and shared pure GT rules |
| Persistence | `canvasDocument.ts`, network migration/copy and history snapshots: document v5, plugin API v2, units and explicit network policies |

The former `payloadBuilder.ts` business-payload module has been removed. New calculation documentation belongs to `networkCompiler.ts` and its domain modules; do not recreate the deleted builder merely to match an older status list. Old backend graph-node classes, Void/Net helper modeling and `calculate_flow`/`debug_matrix` are also no longer active API documentation targets.

## Maintenance checks

- Keep comments aligned with actual ownership and caller contracts. Unit conversion belongs to the explicit unit system, game rules to modifiers, graph compilation to the frontend compiler and mathematical solving to the backend.
- Document assumptions and limits where they matter: continuous LP, numeric tolerances, no forced native termination, no automatic proof of startup or useful expansion.
- Use real relative documentation links and current file paths. Avoid machine-specific `file://` links.
- Run relevant ESLint, TypeScript and Python regression checks after changing public contracts. The [testing guide](testing.md), [solver contract](solver-lp.md) and [acceptance matrix](validation/v2-completion/acceptance-matrix.md) are the current behavioral references.

The previous 2026-05-28 “100% coverage” file list was a historical snapshot of a different architecture. It is superseded by the entry points above and is not a current coverage guarantee or task list.
