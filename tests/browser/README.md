# Browser validation harness

This manual harness mounts the real application with a fixture picker and optional benchmark. It is not an automated end-to-end suite or a production entry point.

1. Start the backend following the [README](../../README.md), with `VITE_BACKEND_URL` set to its address.
2. Run `npm run dev` from the repository root.
3. Open `http://localhost:5173/tests/browser/browser.html`.
4. Load a fixture, then use normal application controls to calculate and inspect results.

The fixture picker uses `fixtures/canvas/`. Loading a fixture or running a benchmark replaces the harness's in-memory graph; use it only for disposable test documents.

Choose **display-stress** for the three display modes: 41 nodes, a 32-machine connected line, a machine with 14 recipe resources per side plus utility ports, a capacity input and five modifiers, bilingual long names, state endpoint ports, and a capacity-limited splitter. The dense machine and endpoints are at the top left; the long line starts below them. Use View → Fit view, then zoom to the desired area. Switch View → Node display, calculate, and compare dimensions and ports; also check inline edits, language changes and save/reopen. The fixture starts in compact mode and uses explicit supplies, deliveries and spills.

**display-endpoint-capacity** isolates the dense machine and endpoints, including endpoint capacity ports, for display and error handling checks. The current compiler rejects capacity endpoints (they require a boundary while capacity pools prohibit flow boundaries); calculation failure is expected for this fixture. Use **display-stress** for successful-calculation and retained-result checks.

For endpoint quantity regression, enter `-1`, blank text, and `abc` in a finite supply or delivery field and press Enter or move focus away. The exact draft must remain visible with `aria-invalid="true"`; the configured quantity, results and node dimensions must remain unchanged. Escape restores the committed value and clears the error. A valid nonnegative value commits once on Enter or blur and is undoable. After calculation, a met target's actual value is green, an unmet target is red with an alert icon, and an unverified or retained result is neutral. Status remains accessible through focus and tooltip without a separate status row. Short minimum/exact/limit labels identify editable conditions in both languages. Changing a target must not label an old result with a current shortfall.

Check routine policy text across recipe, source, target and splitter nodes: compact and standard hide unlimited supply/spill descriptions while retaining supply icons, editable quantities and finite splitter limits; detailed restores the descriptions at the relevant resource. Machine quantities appear below the header, and no informational footer follows resources. Preserve the existing wired handles and global-port SVG shapes; global routing must not acquire a supply marker unless explicitly configured. Splitter branches show only branch identity and relative weight. Check that 2:3 saves as 40%:60% in temporary details, calculation delivers 4 and 6 from a supply of 10, all-zero/negative/blank weights stay unapplied, and Escape restores the committed group. Reopening uses equivalent weights from saved ratios; Enter/save commits atomically. Check both handle centers against the frame edges and unchanged geometry across display modes.

`npm run build` type-checks the harness and shared TypeScript fixtures; `npm run lint` checks the harness. The production bundle still starts from the root `index.html`.

Use **Run browser benchmark** when investigating performance and save the displayed raw JSON under ignored `artifacts/`. Record hardware, browser, workload and version before comparing runs. Do not commit repeated measurements or screenshots as permanent documentation.

Use **Benchmark display modes** on a loaded fixture to profile presentation changes independently of compilation. It performs one warmup and five measured rounds through compact/standard/detailed, restores the original mode, and exposes **Display benchmark JSON**. Each sample reports elapsed time through four animation frames, React Profiler render duration and commit count, and canvas node-array writes. Fixed-geometry mode changes should not write the node array. Compare the same fixture, viewport, browser and development build; this includes instrumentation overhead and is not a production latency guarantee. Keep the page visible and avoid editing during a run. The benchmark changes the local mode preference temporarily; its original value is restored on completion.

`node scripts/validation/generate-splitter.mjs` regenerates the splitter canvas fixtures from compiler cases. Review the diff before accepting fixture changes. Mathematical request/response fixtures have separate automated test consumers and must not be removed along with transient browser output.
