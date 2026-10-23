# Browser validation harness

This manual harness mounts the real application with a fixture picker and browser benchmark controls. It is not an automated end-to-end test suite and is not a production build entry point.

1. Start the backend using [the testing guide](../../docs/testing.md); configure `VITE_BACKEND_URL` to match it.
2. Run `npm run dev` from the repository root.
3. Open `http://localhost:5173/tests/browser/browser.html`.
4. Select a fixture and load it, then use the normal application controls to calculate and inspect results.

Canvas documents live in `fixtures/canvas/`. The picker resolves their URLs relative to the harness module. Do not use a valuable working document in this harness: loading fixtures and running the benchmark replace its in-memory graph.

## Checks and measurements

`npm run build` type-checks the harness and TypeScript fixtures along with the application; `npm run lint` also checks the harness. The production bundle still starts from the root `index.html` and does not include this tool.

Run **Run browser benchmark** only when measurements are needed. Record its raw JSON in `docs/validation/v2-completion/performance-browser.json`, then run `node scripts/validation/report-browser.mjs` from the repository root. This regenerates the report from recorded samples; it does not run a new benchmark. Record configuration changes rather than presenting incomparable runs as identical workloads.

`node scripts/validation/generate-splitter.mjs` regenerates the five splitter documents in `fixtures/canvas/` from compiler fixtures. Inspect the resulting diff before accepting new fixture data.

The harness previously lived under `docs/validation/v2-completion/`. Historical screenshots and reports remain there; their recorded results have not been rerun merely because the files moved.
