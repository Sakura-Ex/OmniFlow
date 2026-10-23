# Documentation index

| Need | Reference |
|---|---|
| First use | [English README](../README.md), [中文 README](README_CN.md), [Windows launcher](starting.md) |
| Development | [Contributing](../CONTRIBUTING.md), [repository guidelines](../AGENTS.md), [docstring conventions](DOCSTRING_GUIDELINES.md) |
| Interaction and next-stage plans | [Interaction handbook](interaction-design-handbook.md) |
| Calculation architecture | [v2 design](technical-design-v2-proposal.md), [solver contract](solver-lp.md) |
| Current implementation limits | [Gap assessment](v2-code-gap-assessment.md) |
| Verification | [Testing](testing.md), [CI](ci.md), [manual browser harness](../tests/browser/README.md) |

Application shell code belongs in `src/app/`, domain code in `src/features/`, and shared controls, schemas and utilities in `src/common/`. Automated tests live beside the behavior they protect; configuration tests live in `tests/config/`. Shared mathematical inputs and migration documents belong in `fixtures/`, not in documentation folders.

The [original technical design](technical-design.md) remains solely as the v1 interaction reference used by the handbook. Its old calculation interfaces are superseded by v2. Implementation diaries, intermediate screenshots and historical measurements can be recovered from Git before the repository cleanup; they are not current specifications.

Keep documentation focused on usage, contracts, decisions and unresolved limits. Update the owning document instead of adding a report per change. Store disposable screenshots, benchmark output and local reports under ignored `artifacts/`; retain a fixture only when a maintained test or reproduction tool uses it.
