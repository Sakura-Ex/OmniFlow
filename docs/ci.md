# Continuous integration

`.github/workflows/ci.yml` runs on pushes and pull requests with read-only repository permissions.

- The frontend job uses Node.js 24, installs the committed dependency lockfile with `npm ci`, and runs `npm run lint`, `npm run build`, and `npm test`.
- The backend job uses Python 3.13, installs the pinned `backend/requirements-dev.txt` dependencies, and runs `python -m pytest`.

The Vitest suite includes `tests/config/eslint-boundaries.test.ts`. These configuration regressions exercise the actual ESLint configuration with alias imports, relative extensionless imports, explicit TypeScript extensions, and TSX files. The TypeScript resolver reads `tsconfig.app.json`, so `@/` and extensionless dependencies participate in architecture rules.

Feature patterns capture their internal paths. Additional permissions apply to specific editor components, orchestration hooks, and integration tests; calculation domain modules and shared utilities still reject canvas dependencies. Recipe resources are flattened by a shared utility, avoiding a reverse dependency from the recipe store to the canvas feature.

Browser interaction checks remain manual and are not run by this workflow. See [testing](testing.md) for the regression suites and local setup.
