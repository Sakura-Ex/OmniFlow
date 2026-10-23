# Browser validation harness

This manual harness mounts the real application with a fixture picker and optional benchmark. It is not an automated end-to-end suite or a production entry point.

1. Start the backend following the [README](../../README.md), with `VITE_BACKEND_URL` set to its address.
2. Run `npm run dev` from the repository root.
3. Open `http://localhost:5173/tests/browser/browser.html`.
4. Load a fixture, then use normal application controls to calculate and inspect results.

The fixture picker uses `fixtures/canvas/`. Loading a fixture or running a benchmark replaces the harness's in-memory graph; use it only for disposable test documents.

`npm run build` type-checks the harness and shared TypeScript fixtures; `npm run lint` checks the harness. The production bundle still starts from the root `index.html`.

Use **Run browser benchmark** when investigating performance and save the displayed raw JSON under ignored `artifacts/`. Record hardware, browser, workload and version before comparing runs. Do not commit repeated measurements or screenshots as permanent documentation.

`node scripts/validation/generate-splitter.mjs` regenerates the splitter canvas fixtures from compiler cases. Review the diff before accepting fixture changes. Mathematical request/response fixtures have separate automated test consumers and must not be removed along with transient browser output.
