# Documentation index

Start here when developing or reviewing OmniFlow. Design proposals describe intent; implementation status and validation evidence must be checked separately.

## Active references

| Task | Reference |
|---|---|
| Development rules | [Repository guidelines](../AGENTS.md), [contributing](../CONTRIBUTING.md) |
| UX, defaults and workflows | [Interaction design handbook](interaction-design-handbook.md) |
| v2 domain and calculation contract | [v2 technical design](technical-design-v2-proposal.md), [LP contract](solver-lp.md) |
| Implementation status | [Gap assessment](v2-code-gap-assessment.md), [implementation plan](v2-implementation-plan.md) |
| Running and validating changes | [Testing](testing.md), [CI](ci.md), [local startup](starting.md) |
| Comments and documentation | [Docstring guidelines](DOCSTRING_GUIDELINES.md) |

## Code and evidence locations

| Location | Responsibility |
|---|---|
| `src/app/components/` | Application-level menus, settings page and shortcut help; composes feature entry points |
| `src/features/` | Domain-owned code; `components/` contains UI and `contexts/` contains React entry-point coordination |
| `src/common/components/` | Reusable, domain-independent controls and shells |
| `tests/browser/` | Manual browser validation harness mounting the real application |
| `fixtures/canvas/` | Saved canvas documents used by the browser harness |
| `fixtures/compiler/`, `fixtures/diagnostics/` | Shared frontend/backend regression inputs and recorded solver responses |
| `scripts/validation/` | Canvas fixture generation and browser report generation |
| `backend/benchmarks/` | Python benchmark runners and their raw measurements |
| `docs/validation/` | Observations, acceptance records, screenshots and measured results; not executable application code |

Unit tests remain beside the modules they cover. Browser validation instructions are in [the harness guide](../tests/browser/README.md). File moves do not change the document schema or backend API.

## Historical and supporting material

- [Original technical design](technical-design.md), [storage reform proposal](phase2-storage-reform.md) and [whitepaper](whitepaper.md): background; reconcile with current contracts before using as implementation instructions.
- [Technical debt audit](technical-debt-audit-2026-10-23.md): historical findings and later incremental review, with explicit snapshot boundaries.
- [v2 acceptance ledger](validation/v2-completion/README.md), [UX validation ledger](validation/ux-2026-10-23/README.md): evidence for their recorded snapshots, not proof that later changes passed.
- [Docstring status](DOCSTRING_STATUS.md): documentation review notes, not a substitute for current checks.

Keep old evidence when it explains an accepted result. Update active links when files move; label superseded statements rather than rewriting historical observations as new validation.
