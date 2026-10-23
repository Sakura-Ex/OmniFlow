# Current v2 implementation and remaining gaps

The active calculation path compiles explicit resource networks in the frontend and sends a versioned sparse LP to the backend. Old graph-node solver requests are rejected. This page records current scope; historical implementation stages are available in Git.

## Implemented boundaries

- Persistent ports separate resource identity from graph identity. Wired connections and explicit scoped buses determine networks; supply and disposal are explicit.
- Modifiers compute read-only Context → Effect without importing their React cards. Units and operating environment are explicit inputs.
- The solver validates conservation, bounds and objective layers, uses bounded workers and queue admission, and returns request/model identity with verified result evidence.
- Installation/BOM projections, fixed-ratio splitters and separate infeasibility diagnostics use the compiled model. Continuous operation is distinct from installed quantities.
- Save identity, replacement protection, import rollback, synchronous history, batch completion and system-clipboard precedence have regression coverage.

## Remaining work and limits

| Area | Boundary / next decision |
|---|---|
| Node display | Compact, standard and detailed modes, document display preferences and a persistent core result summary are implemented; category folding and semantic zoom remain separate planned work. See the [interaction handbook](interaction-design-handbook.md). |
| Large graphs | Search, network tracing, grouping and broader batch actions remain as marked in the handbook. Full-document snapshot and serialization costs need measurement before architectural changes. |
| Recovery | Browser save is a single local slot. No autosave/crash recovery; viewport persistence and database upgrade/corruption recovery need dedicated work and verification. |
| Diagnostics | Legacy text matching remains in translation compatibility. Prefer stable diagnostic codes and parameters when extending the protocol. A diagnostic is not a unique/minimal conflict proof. |
| Runtime | Running native solves cannot be forcibly cancelled. JSON decoding runs on the event loop under the body cap. Public hosting needs authentication and deployment controls. |
| Model | Continuous steady-state LP, not integer installation optimization, inventory simulation, dynamic startup proof or automatic operating-condition selection. |
| UI verification | No automated browser runner; native file/leave dialogs, accessibility, cross-browser and narrow-screen behavior are not comprehensively verified. |
| Delivery | The main bundle still emits a size warning. Split by measured usage needs rather than hiding the warning. SciPy forwards the explicit native thread option to HiGHS with a documented warning. |

See [testing](testing.md) for executable coverage and [v2 design](technical-design-v2-proposal.md) / [solver contract](solver-lp.md) for semantics. Passing tests do not imply every planned feature or untested browser workflow is complete.
