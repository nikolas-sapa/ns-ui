# Installing a component

```bash
npx shadcn add https://design.helpmarq.com/r/<name>.json
```

That writes the source to `components/ui/<name>.tsx` and installs whatever npm
dependencies the component declares in its `meta.json`. There is nothing else
to import and nothing to keep in sync afterwards.

## Prerequisites

**React 19.** `package.json` in this repo pins `react` / `react-dom` to
`19.2.7`, and components are written against React 19 (`"use client"`, the
React 19 `ref` handling, no `forwardRef` where it is no longer needed).

**Tailwind CSS v4.** This repo builds against `tailwindcss` `4.3.2` with
`@tailwindcss/postcss`. The token contract below depends on Tailwind v4's
`@theme` mechanism, which does not exist in v3.

**Node 22.18+** is a requirement for working *in* this repo (`engines.node` in
`package.json`, because the build scripts are TypeScript executed directly by
Node's native type stripping). It is not a requirement for consuming an
installed component.

## The token contract

Components reference CSS custom properties rather than hex literals. Which
properties they may reference is fixed and is enforced by a gate
(`scripts/test-source-invariants.ts`).

There are two groups, and they behave differently on install.

### Group 1 — tokens the registry ships to you

These are written into your project by the `shadcn` CLI, because each registry
item carries a `cssVars` block:

| Token | Meaning here | Light value | Dark value |
|---|---|---|---|
| `--ns-muted` | secondary **text** colour | `#4d4d4d` | `#8f8f8f` |
| `--ns-accent` | the accent, electric blue | `#006bff` | (inherits light) |
| `--ns-accent-hover` | accent hover state | `#0059d1` | (inherits light) |
| `--surface` | raised surface behind cards/panels | `#fafafa` | `#171717` |
| `--error` | status red | `#ea001d` | `#ff6369` |
| `--warning` | status amber | `#7a5200` | `#f5a623` |
| `--success` | status green | `#2d7a2d` | `#47a447` |

Values are read out of `app/globals.css` by the build; they are not restated
in the build script, so there is no second copy to drift.

Why `--ns-muted` / `--ns-accent` / `--ns-accent-hover` carry a prefix: shadcn
already defines `--muted` and `--accent`, and means *the opposite thing* by
them. shadcn's `--muted` is a light **background**; ns-ui's is a **text**
colour. shadcn's `--accent` is a grey surface; ns-ui's is electric blue.
Shipping unprefixed versions would have overwritten the host project's own
tokens with incompatible meanings, so they were namespaced. `--surface`,
`--error`, `--warning` and `--success` have no shadcn equivalent and kept
their plain names.

Four of these — `--ns-muted`, `--ns-accent`, `--ns-accent-hover`, `--surface`
— are also lifted into Tailwind's colour namespace, so `text-ns-muted`,
`bg-surface` and friends compile. `--error`, `--warning` and `--success` are
**not**: a bare `bg-success` compiles to nothing. Components that need them
write `bg-[var(--error)]`.

### Group 2 — tokens deliberately NOT shipped

`--background`, `--foreground` and `--border` are **not** emitted in `cssVars`,
on purpose. They inherit from your theme. A component that brought its own
page colours would look foreign in every host project, so the registry leaves
those three to the consumer.

The consequence: your project must already define `--background`,
`--foreground` and `--border`. A `shadcn init`-ed project does.

### How the CLI knows what to write

`scripts/build-registry.ts` scans each `component.tsx` for token usage and
emits a `cssVars` block containing only what that component actually
references — a `theme` map (the `--color-*` aliases, for the four
theme-mapped tokens), a `light` map, and a `dark` map carrying only the tokens
the `.dark` block genuinely overrides.

Detection is textual, against the installed file's own source: a `var(--x)`
reference, or the Tailwind utility the `@theme` mapping lifts it into.

As of commit `cadbed47`, 266 of the 298 registry items carry a `cssVars`
block; the remainder reference none of the seven tokens, so they need nothing
written. Re-derive with:

```
node -e "const r=require('./registry.json');console.log(r.items.filter(i=>i.cssVars).length,'/',r.items.length)"
```

## If a component renders wrong after install

1. Check `--background` / `--foreground` / `--border` exist in your theme.
   They are the three the registry never writes.
2. Check your Tailwind is v4. The `@theme` mapping the components rely on is
   a v4 feature.
3. Check the `cssVars` block landed. Open
   `https://design.helpmarq.com/r/<name>.json` and compare its `cssVars`
   against your stylesheet.

## Reference

- `scripts/build-registry.ts` — the `cssVars` emission, with the reasoning inline.
- `app/globals.css` — the single source of the token values.
- The MCP server's `get_conventions` tool returns this same contract to an agent.
