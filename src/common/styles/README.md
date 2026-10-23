# Shared styles

`tokens.css` is the only source of UI colour values. It defines dark and light
themes, one blue primary accent, neutral surfaces, and green/amber/red status
roles. Status colours convey meaning; use labels or icons as well as colour.
Change a theme here rather than adding component-specific light-theme rules.

The theme hook sets `data-theme` on both the document root and the app shell.
This makes the body, native form controls, dialogs and portal content inherit
the same theme. Derived tokens are declared on the app shell too so they track
scoped theme changes. Keep `color-scheme` in sync with the active theme.

Feature CSS Modules own layout. Shared classes in `primitives.module.css` only
provide colours and colour states. They must not introduce `font` shorthands,
font sizes, display modes, padding, gaps, dimensions, border widths or radii.
Keep each existing component's typography, spacing and geometry unchanged when
adopting the library:

```css
.applyButton {
  composes: button primary from '@/common/styles/primitives.module.css';
  /* Keep this component's existing size and typography declarations here. */
}

.input {
  composes: control from '@/common/styles/primitives.module.css';
}
```

Use semantic variables such as `--panel`, `--input-bg`, `--text`, `--muted`,
`--accent`, `--warning` and `--danger`. Font size tokens use the original pixel
values (11, 12, 13 and 14px); introducing a token must not change the existing
computed size. Spacing, radius and motion tokens are available for new work,
not an instruction to restyle existing layouts. Do not put hex, RGB/HSL or named palette colours in component
CSS, JSX, inline styles or SVG attributes. `transparent`, `currentColor` and
data-driven resource colours are appropriate. Existing shell and menu rules in
`index.css` retain their original layout. New feature layout rules belong in
CSS Modules. Do not move or auto-collapse HUD panels, convert resource tables
into cards, or add responsive layout changes as part of a colour-token migration.

Resource colours are persisted domain data, separate from theme colours.
`common/utils/resourcePalette.ts` owns the bounded default category palette;
the registry remains authoritative for users' custom colours. Components may
pass these dynamic values to SVG/edge/handle styles. Use CSS `color-mix` for
transparency rather than manipulating hex or RGB strings. Never rewrite saved
custom colours on theme changes.

Keep the original built-in category palette. Badges consume `--resource-color`;
`--resource-ink-weight` preserves that colour in dark mode and blends it with
theme text in light mode for readability. Node error outlines take precedence
over selection decoration and must remain visible in both selection states.

Verify both themes, keyboard focus, disabled and active controls, popup/portal
backgrounds, selection outlines and error states when changing shared styles.
Run the frontend build and lint. A source scan for hex and RGB/HSL values should
find UI values only in `tokens.css` and persisted resource defaults only in
`resourcePalette.ts`; standalone branded SVG artwork and test fixtures are not
theme definitions.
