# Repository Guidelines

## Scope & Authority

Explicit user instructions take precedence. Work within the agreed scope and preserve unrelated changes. Historical reports and planned features are references, not standing tasks. Verify the current implementation rather than assuming documentation is current; resolve discrepancies relevant to the current task and update the owning document.

This file defines repository-wide working principles. Keep domain-specific requirements in their authoritative documents:

- [Documentation index](docs/README.md): usage, architecture and contribution references.
- [Interaction handbook](docs/interaction-design-handbook.md): workflows and interaction contracts.
- [v2 design](docs/technical-design-v2-proposal.md) and [gap assessment](docs/v2-code-gap-assessment.md): calculation design and implementation limits.
- [Testing](docs/testing.md): environment, commands and verification scope.
- [Docstring guidelines](docs/DOCSTRING_GUIDELINES.md): documentation conventions.

## Approach

Prioritize correctness, coherent design and long-term maintainability over minimizing the change size. Choose the scope needed to resolve the underlying problem, rather than defaulting to a local patch.

- Understand the user's task, existing behavior and root cause before editing. Distinguish intended contracts from accidental implementation constraints; do not preserve a flawed structure merely because it already exists.
- Assess responsibilities, data flow, abstractions and affected callers together. Keep related entry points consistent and resolve problems at the layer that owns them.
- Reuse sound abstractions. When the existing design obstructs reuse or mixes responsibilities, restructure it and migrate affected callers instead of adding duplicated logic, special cases or temporary workarounds. Necessary restructuring is not limited to small edits. Record the purpose and removal conditions of temporary solutions and compatibility layers in existing tracking channels.
- Compare local and structural solutions by correctness, clarity, maintenance cost and realistic extension needs. Prefer the structural solution when it removes the cause of recurring complexity; avoid abstractions justified only by hypothetical future features.
- Explain substantial changes, tradeoffs, compatibility impacts and validation. Carry the chosen approach through implementation, caller migration, cleanup and documentation within the authorized scope. Ask when an unresolved product decision or expansion of scope requires user input, not merely because several files need to change.
- Keep changes tied to the problem being solved. Avoid unrelated rewrites, but do not use minimal-diff or scope arguments to leave necessary architectural work unfinished.

## Architecture & Code Quality

Keep responsibilities cohesive and dependencies explicit. Application composition belongs in `src/app/`, domain behavior in `src/features/`, and genuinely shared infrastructure in `src/common/`. Respect the boundaries enforced by `eslint.config.js`.

Keep domain calculations deterministic and separate from UI orchestration and external effects. Maintain authoritative data sources, validate external inputs, and preserve precision until presentation. Presentation changes must not silently alter business rules or persisted contracts. Changes to persisted data or public interfaces must define compatibility, migration and failure handling.

Follow existing naming, formatting and component conventions. Prefer readable code and explicit interfaces over compressed expressions. Comments should explain intent, constraints or non-obvious decisions rather than repeat the implementation. Never commit secrets.

## Repository & Documentation Hygiene

Every retained file should have an ongoing purpose. Extend the existing source of truth instead of adding parallel documentation, task diaries or a report per change. Keep usage documentation aligned with implemented behavior and repair references when moving or removing files.

Store disposable screenshots, local reports and measurements in ignored `artifacts/`. Keep maintained regression data in `fixtures/`; generated output is not source. Remove obsolete artifacts and redundant tests without discarding useful regression coverage or unrelated user work.

## Validation & Delivery

Match verification to the affected contracts and risks; use the testing guide for concrete checks. For bug fixes, add a regression test that reproduces the original failure where feasible. Prefer contract-focused tests in existing suites over tests that mirror implementation or exist only for one task. Automated checks do not substitute for checking actual behavior where the change requires it.

Report what changed, why, what was verified and any relevant limitations. Distinguish local results, hosted CI and unverified plans. Do not claim completion from a successful command when the requested behavior remains unchecked.

Use Conventional Commits. Keep commits focused on intended changes and PR descriptions centered on the resulting behavior and validation. When asked to submit or push, verify the target branch, outcome and remaining working-tree changes; do not infer authorization to merge or change repository policy.
