# UX validation — 2026-10-23

## Reading this historical record

This file records successive implementation snapshots, not one current UI specification. Statements such as “now”, dimensions, test counts, and screenshots apply only to the associated pass. Later passes supersede earlier presentation choices; they do not retroactively validate later code. The early solid-red delete controls, 380 px recipe cards, tinted endpoint headers, and settings entry points are historical.

Use the [interaction handbook](../../interaction-design-handbook.md) for the current design contract and implementation gaps, and [testing](../../testing.md) for subsequent recorded checks. The three node display modes and their external prototype are planned design work, not implemented or browser-validated by this ledger.

### Later screenshot references

| Area | Evidence |
|---|---|
| Unified node appearance | [Dark](unified-nodes-dark.png), [light](unified-nodes-light.png) |
| Settings page | [Chinese](settings-page-zh.png), [English/light](settings-page-en-light.png) |
| Supply entry and compact status | [Supply status](supply-status-compact.png) |
| Editor translation | [English editor](i18n-recipe-en.png) |
| Initial canvas | [Steel line](starter-steel-line.png) |

Earlier screenshots remain attached to the observations they support. They are retained as historical evidence rather than examples of the latest approved design.

## Initial UX pass

The main workflow is now: choose resources and recipes, set supply/demand on their cards, calculate, then inspect results. The toolbar's **产线设置** opens the full configuration. Endpoint condition buttons open only that endpoint; **安装设置** on a recipe opens its installation settings. Network semantics, buses, priorities and ratios remain in advanced sections.

Recipe editing uses input/output panels on the left and machine/modifier panels on the right. Below 1100 px these become a single scrolling column, with actions outside the scrolling body. Empty utility tables are omitted; populated utility details can be expanded. Resource selection no longer exposes a second throughput field competing with explicit boundary policies.

## Observed browser checks

- Real application and backend through the v2 validation harness, fractional fixture.
- Changed demand from 1.2/s to 2.4/s through the endpoint condition button, saved and recalculated: both endpoints 2.4/s, machine operation 2.4, installation 3, utilization 80%.
- Opened the toolbar configuration, endpoint demand settings and machine installation settings independently.
- Inspected the recipe editor at 1920 × 855 and 1000 × 800; the latter uses one column with reachable fixed actions. Restored the original viewport afterward.
- Fixed native focus scrolling of the app/canvas containers, which could hide the toolbar and crop nodes after resizing or focusing controls. Canvas panning remains owned by React Flow.
- Inspected the final empty-utility recipe layout; no empty table header or horizontal scrollbar remains.

Screenshots: [canvas](canvas.png), [demand settings](demand.png), [recipe editor](recipe.png).

Frontend regression suite: 212 tests across 22 files passed. ESLint and production build passed; the existing bundle-size warning remains. Backend behavior was not changed by this UX pass, so its full test suite was not rerun. These checks do not establish exhaustive mobile, keyboard or screen-reader accessibility coverage.

## Follow-up: partial supply chains and pre-v2 interaction compatibility

The [interaction handbook](../../interaction-design-handbook.md) now records the historical baseline and remaining differences. The earlier layout-only checks above are historical, not the final test count for this follow-up.

- Loaded `unconnected-input.json`: recipe and demand only, with no input source node or incoming edge. Enabled the bulk supply action through the recipe input, saved and calculated: 1.2/s output, 1.2 operating machines, 2 installed, 60% utilization.
- Restored endpoint inline controls. Enter committed demand 2.4; Escape discarded a draft of 9 and retained 1.2. Recalculation yielded 2.4/s, 3 installed, 80% utilization, and external ore supply 2.4/s in the result panel.
- Undo restored demand 1.2 and redo restored 2.4, invalidating stale calculation results as expected.
- Screenshot: [unconnected input and inline target editing](input-supply-inline.png).
- New endpoint mode mapping follows legacy migration: demand is at-least, overflow is spill, maximize has an explicit objective. Existing exact/export policies retain their distinct meanings.

Compiler/solver regression cases cover unlimited, finite and zero external supply, independent same-resource networks, and truly unbounded maximization. Remaining legacy machine-card shortcuts and other interaction differences are explicitly listed in the handbook rather than claimed as fully restored.

Final follow-up checks: 246 frontend tests in 26 files passed; 36 real compiler/solver tests passed; full ESLint and production build passed. Existing bundle-size and SciPy forwarded-thread-option warnings remain. The full backend suite was not repeated for this focused change.

## Fixed editor quadrants and routing switches

- Wide-screen editor sections have equal row heights and aligned row boundaries; at 1920 × 1080 all four measured 369 px internally. Adding twelve input rows did not change section sizes. At 1000 × 800 all four measured 286 px and stacked vertically.
- Shared routing controls now show 有线/全局 with a pressed state and explain locked archetype ports. Switching recipe input/output to Global and saving removed exactly their physical edges without leaving invalid-edge diagnostics. Undo restored both physical edges and visible handles, including the output handle previously missed by React Flow's cached measurements.
- Endpoint routing was switched and saved separately. A user-added utility was switched, saved, reopened and remained Global. Naming a new utility no longer collapses its editor.
- Screenshots: [fixed quadrants and routing controls](fixed-grid-routing.png), [narrow editor](fixed-grid-narrow.png).
- Routing transition regression tests cover recipe/utility/endpoint ports, unrelated invalid-edge preservation, no invented connections when returning to Wired, and undo/redo. Final frontend suite: 254 tests across 27 files passed; lint and production build passed, with the existing bundle-size warning. No backend calculation changes were made in this follow-up.

## Unified searchable controls

- All production dropdown selects now share the themed Combobox, including resource IDs/categories, units/prefixes, machine settings, modifier fields, boundary/network configuration and endpoint modes. The validation harness retains its native fixture selector.
- Browser checks: category search and ArrowDown/Enter selection; invalid enum search discarded on blur; custom ID typing; selecting a qualified ID then reopening and pressing Escape preserves the committed ID; nested unit candidates remain above the unit editor and selecting one keeps that editor open; Global checkbox changes checked state; endpoint mode switches to at-least while retaining quantity 1.2.
- The Global column uses checkboxes, category width is compact, delete buttons are solid red, and computed rates have a separate numeric treatment. Screenshot: [unified controls](unified-controls.png).
- Removed obsolete row-specific native select and suggestion styles. Shared candidate logic regression tests cover filtering, wraparound navigation and disabled options.
- Final checks: 257 frontend tests across 28 files, ESLint and production build passed. Existing bundle-size warning remains. Backend tests were not rerun for this UI-only follow-up; exhaustive touch/mobile and assistive-technology testing remains outside these checks.

## Restore compact v1 node presentation

Compared against historical commit `ab53eed`: restored horizontal category/name/rate rows, mirrored output ports, and header shortcuts for implemented status, autofill and editing. Retained v2 actual-vs-single-machine rates, inventory tags, explicit supply entry, installation summary and collapsible equipment details. Endpoint modes and quantities now share one row. No solver semantics changed.

Browser fractional fixture: recipe measures 380 × 251 CSS px with two inputs/one output; each endpoint 320 × 119. Demand Enter committed 2.4, Escape discarded 9 and retained 2.4; equipment details expanded and collapsed correctly. Recipe handles now override the global inward offset so they sit at the card boundary. Screenshot: compact-nodes.png. Frontend suite: 257 tests passed; lint and build passed (existing bundle-size warning). No backend suite rerun for this presentation change. Legacy auto/limit machine shortcuts remain a separate outstanding compatibility item.

## Category hierarchy and v1 wireless icons

Input/output headings are 13px semibold; stable category groups use one 10px label with an inline rule, and resource rows are inset by 6px. No repeated per-row category badges or extra group border. Restored the exact circular port and two SVG arcs from `ab53eed`, including left/right paths and placement, through a shared GlobalPortIcon for recipe and endpoint nodes. Inspected the real demo canvas with multi-category input and global utility ports; screenshot: [category hierarchy and wireless icons](category-hierarchy-wireless.png). Build and lint passed. This CSS/icon-only follow-up did not rerun solver tests.

## SVG icons and v1 source/sink styling

Replaced emoji and character icons in production menus, nodes, editors, dropdown checks, checkbox checks, disclosure controls and error toast with shared SVG Icon. Preserved the v1 wireless SVG. Source/sink styling follows `ab53eed` role colours, 16px rounding, tinted header, settings button and mirrored resource placement; latest searchable mode controls and grouped categories remain intentional differences. Unlimited source uses dashed border, maximize gold, spill neutral dashed; mixed policies retain normal role appearance.

Browser checks: file menu and recipe editor accessible controls; switched source to unlimited, target exact → maximize → spill → exact, confirmed borders and retained demand 1.2. Screenshots: svg-icons.png and source-sink-v1.png. Build, ESLint and 257 frontend tests passed; existing bundle-size warning remains. No backend changes or solver-test rerun.

## Unified node visual language (supersedes source/sink styling above)

Shared solid panels, 12px rounding, header and SVG buttons now apply to recipe, endpoint and splitter cards. Endpoint titles are 原料/目标; role colours remain without gradients. Modes and settings live in the header, resources use one mirrored row each. Batch boundary updates validate atomically and preserve individual quantities/non-flow constraints. Splitter ratios use a whole-group draft and one save/undo transaction. The interaction handbook reflects these conventions.

Validation: 259 frontend tests passed; full ESLint and production build passed (existing bundle-size warning). Browser checks confirmed source 10 survives unlimited-to-limited and Escape cancellation; invalid splitter total 110% is rejected; valid 60/40 saves and one undo restores 40/60. Dark/light layouts inspected. Screenshots: unified-nodes-dark.png, unified-nodes-light.png. Two new regression cases cover independent batch quantities and atomic rejection of non-flow updates. Multi-port mode interaction and calculated shortage tooltips were not browser-tested; backend tests were not rerun for this UI change.

## Starter steel line

Replaced the incomplete demo and unrelated crafting branch with eight connected nodes: ore/water sources, three production recipes, steel demand at 10 items/min and two explicit coproduct spills. The document owns its minute definition; default unit fixtures remain unchanged. Power inputs have explicit source policies and the furnace has an MV hatch. Startup requests a normal calculation once; no synthetic result is seeded. Old backend responses produce a brief restart instruction.

Validation: 260 frontend tests, full ESLint and build passed (existing bundle warning). The new starter test compiles the actual graph and checks a feasible witness against every conservation row, demand inequality and variable bound. Browser inspection confirmed 10 items/min and non-crossing oxygen/hydrogen lines. Screenshot: starter-steel-line.png. The running backend is still 0.1.0 and returns HTTP 422; successful browser solving against v2 remains unverified.

## Retain the last verified result

Calculation edits now mark results stale without deleting node quantities or result sections. Running and failed requests retain the previous verified snapshot; successful/verified feasible results replace all projected fields so removed outputs cannot linger. History restoration and node edits reattach prior results by node identity. Import/reset/clear still discard the previous document result. Construction checkmarks are excluded from calculation identity; physical inputs and targets still invalidate in-flight requests.

Validation: 261 tests, ESLint and build passed (existing bundle-size warning). Regression coverage includes stale preservation, history-style node replacement, running/failure retention, complete success replacement and explicit reset. No successful live backend calculation was performed in this follow-up.
