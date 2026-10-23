# Repository Guidelines

## Scope & References

Explicit user instructions take precedence. Tool-specific rules link here. Historical specs/status reports are references, not tasks. Verify code/configuration; consult [v2 design](docs/technical-design-v2-proposal.md) and [gap assessment](docs/v2-code-gap-assessment.md) for calculation changes.

For UI entry points, defaults and workflows, read the [interaction design handbook](docs/interaction-design-handbook.md) and inspect the pre-v2 behavior before changing them. Preserve established inline editing and shortcuts; integrate v2 capabilities into existing workflows and document necessary deviations.

## Implementation Strategy

Prefer the smallest architecturally sound change.

- Inspect existing abstractions first. Explain substantial changes, interface/caller impacts, and migrations; proceed within authorized scope without routine reconfirmation.
- Prefer localized changes; extend the abstraction that naturally owns the behavior.
- Avoid one-off branches, duplicated logic, special-case fields, and ad-hoc abstractions merely to minimize the diff.
- When workarounds create meaningful debt or inconsistency, explain local versus structural alternatives and prefer the structural solution.
- Consider extension costs without speculative abstractions. Do not refactor unrelated code.
- Preserve unrelated working-tree changes.

## Structure & Architecture

- `src/features/`: domain-owned components, hooks, stores, and services.
- `src/app/`: application-level UI composing feature entry points; shared controls stay in `src/common/components/`.
- `tests/browser/`: manual browser validation harness; `fixtures/`: shared test data; `scripts/validation/`: validation helpers. Keep observations and screenshots in `docs/validation/`.
- `src/common/`: shared types, schemas, utilities, and database infrastructure.
- `src/data/archetypes/`: machine templates; `features/modifier/modifiers/`: game-specific rules.
- `backend/main.py`: FastAPI and SciPy LP; `public/`: assets; `dist/`: generated output.

Respect `eslint.config.js` boundaries. Keep calculations deterministic with explicit environment inputs; hooks orchestrate, domain functions compute. Keep recipe data authoritative in its store. Use focused Zustand selectors and semantic actions. Validate external data with Zod/Pydantic. Reuse ID/formatting helpers; retain precision until display.

## Commands & Configuration

- `npm ci`: install locked dependencies.
- `npm run dev`: Vite on port 5173.
- `npm run build`: TypeScript checks and production bundle.
- `npm run lint`: ESLint, module boundaries, hooks, and JSDoc.
- `npm run preview`: preview the bundle.
- `npm test`: Vitest regression tests (`npm run test:watch` for watch mode).
- `python -m pytest`: backend HTTP/solver regression tests.

In an activated Python environment, run `python -m pip install -r backend/requirements-dev.txt` (or `backend/requirements.txt` for runtime only), then run `python -m uvicorn backend.main:app --reload --port 7998`. Match `VITE_BACKEND_URL` to this port using `.env.example`; never commit secrets. See [testing](docs/testing.md) for setup and regression scope.

## Style & Documentation

TypeScript: two spaces, single quotes, no semicolons, `unknown` over `any`, and `@/` imports. Components/types use PascalCase; functions use camelCase; hooks start with `use`. Follow `recipe.store.ts` and `resource.schema.ts` naming.

Use CSS modules; reserve global CSS for resets and shared overrides. Python: four spaces, snake_case, type hints, Google-style docstrings. Write concise English JSDoc/docstrings; see [examples](docs/DOCSTRING_GUIDELINES.md).

## Validation & Delivery

Vitest and pytest are configured; no coverage threshold is imposed. Run relevant checks; report actual results and explicitly skipped future acceptance cases. Cover conservation, capacity, units, and infeasible/unbounded solver cases. Use `*.test.ts` or `test_*.py` for new tests and document their runner.

Use Conventional Commits, e.g. `fix(calculation): preserve net isolation`. PRs describe the problem, behavior, validation, migrations, and related issues; include UI screenshots.
