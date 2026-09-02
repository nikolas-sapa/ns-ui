// The token/theming contract every ns-ui component is built against — see
// AGENTS.md and CONTRIBUTING.md at the repo root ("The token rule"). This is
// what makes get_conventions worth having as its own tool: an agent that
// installs a component but ignores this will produce code that looks wrong
// the moment the host app's theme differs from whatever the agent assumed.
//
// The token line below (between the generated markers) is NOT hand-typed —
// scripts/build-mcp-conventions.ts rewrites it from lib/css-tokens.ts, which
// reads the real names out of app/globals.css. Hand-editing between the
// markers gets silently overwritten on the next `npm run registry:build`;
// if a token is missing here, add it to app/globals.css and lib/css-tokens.ts,
// not to this string. See that script for how the marker pair works.
export const CONVENTIONS = `# ns-ui conventions

These hold for every component in the registry. Match them in any code you
write alongside an installed component, so it doesn't look like a foreign
element in the same UI.

## Color tokens (hard constraint, not a suggestion)

Colors come from CSS custom properties already in scope on the host app —
never a hardcoded hex, in JSX/markup OR in canvas/SVG draw code:

<!-- generated:tokens start -->--background   --foreground   --border   --ns-muted   --ns-accent   --ns-accent-hover   --surface   --error   --warning   --success<!-- generated:tokens end -->

If a component derives ink for a <canvas>, it reads these via
getComputedStyle at mount and on theme change, it does not bake in a color
literal. A component that violates this breaks the light theme silently,
because dark is usually whichever theme the author's terminal defaulted to.
Both themes must render correctly and are not byte-identical.

Three of those tokens have a job narrower than their name suggests. Getting
these wrong produces code that type-checks, renders, and is still wrong:

- --border is a separator, not a fill. In light theme it is 1.19:1 against
  --background. As a fill, a stroke, or canvas ink it is invisible in light
  while looking fine in dark (1.46:1). For a faint but legible mark, use
  --foreground at low alpha instead.
- --ns-accent is interaction chrome only: buttons, links, focus rings, active
  states. Not ambient highlights, not pointer trails, not a component's
  climactic moment. Pointer highlights vary luminance, never hue.
- --ns-muted is a second ink at full strength, for secondary text and
  captions. Do not fade it to an arbitrary alpha. Its contrast ceiling is
  theme-dependent, 8.45:1 light against 6.12:1 dark, so a mid-strength wash
  passes in both themes now and fails in dark first the moment anyone
  strengthens it. Use it as-is, or use --foreground at an explicit alpha.

## Stack assumptions

- React 19+.
- Tailwind CSS v4 — components are styled entirely with Tailwind utility
  classes, no shipped CSS file, no CSS-in-JS.
- Fonts assumed Geist Sans / Geist Mono. Components inherit font-family from
  the host app rather than setting it themselves; where one needs a monospace
  face explicitly (canvas text, tabular labels) it reads the font tokens
  --font-mono or --font-geist-mono, with a generic monospace fallback.
- "use client" on every component; each ships with zero or minimal npm
  dependencies (per-component deps are returned by get_component /
  search_components).
- No runtime package: a component installs as plain source you own
  (components/ui/<name>.tsx), not an import from a library. There is nothing
  to keep in sync after install — edit the installed file directly.

## Motion and accessibility

- prefers-reduced-motion: reduce must be honored — components either turn
  their animation off entirely or replace it with an equivalent static/
  discrete-step affordance (never just "make it faster").
- Every exposed, non-disabled interactive control has an accessible name.
  role=switch|checkbox|radio carries aria-checked. A visible dialog has an
  accessible name. If a component renders any control at all, Tab reaches
  something.
- Destructive or state-changing actions typically fire a visually-hidden
  aria-live announcement naming what happened (see a given component's
  instruction/props for specifics).

## Install

Every component installs via the standard shadcn CLI protocol, pointed at
this registry's origin — see install_command(name) or the installCommand
field returned by get_component / search_components. No account or API key
needed.
`;
