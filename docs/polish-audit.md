# Interface polish audit — 2026-08-01

Walked the running site (home in both themes, a `/preview/<name>/play` page, mobile at
390×844) against `~/.claude/reference/design-dna.md` (Geist Sans, accent `#006bff` used
sparingly, no orange, no emoji, hairline borders, physics easing, generous whitespace,
light and dark both first-class). Findings are ranked by how much each would change a
first impression, not by how easy the fix was. Every fixed item was verified live over
CDP, both themes, desktop and mobile, plus a real-Tab keyboard pass for the focus item.

Scope note: `registry/` and `/preview/[name]` (the bare screenshot-gate route) were not
touched, per standing constraint — none of the findings below required touching either.

## Findings

### 1. Fixed — keyboard focus ring didn't cover the card's actual hit area
**Files:** `app/_components/preview-card.tsx`, `app/_components/featured-card.tsx`

Every catalog and featured card is one giant hit target — the title `<a>` stretches an
`after:absolute after:inset-0` over the whole card, so a mouse click anywhere on the card
opens it. But `focus-visible:ring-2` lived on that same `<a>`, whose own box is just the
title text. Tab through the grid and the ring was a small rectangle in a corner, not "this
card is focused" — the one control on the page where the keyboard affordance didn't match
the mouse one, on a page that is *mostly* a grid of these cards. Not cosmetic: this is an
accessibility defect on the primary content of the site.

Fix: moved the ring to the preview box (the thing hover already highlights) via a
`group-has-[a:focus-visible]/focus:` selector — group named so it doesn't collide with the
plain `group` already used for hover. The title link keeps `outline-none` (suppresses the
default browser outline) but no longer carries its own ring. Verified with real
`Input.dispatchKeyEvent` Tab presses over CDP (not `.focus()`, which doesn't reliably
trigger `:focus-visible`) on both card types, both themes.

### 2. Fixed — footer read as three disconnected fragments at desktop width
**File:** `app/_components/showcase.tsx`

`justify-between` on three `<p>` elements ("For AI agents: …", "Changelog · Writing ·
GitHub · Built by Nikolas", "Built with love…") pinned them to the edges of the 1600px
content column. At a normal desktop window that's a lot of dead air between three lines
that are all footer — it stopped reading as one component. Fix: wrapped the two link
clusters in a shared flex-wrap div with a bounded gap, dropped `justify-between` in favor
of a fixed `gap-x-12` on the footer itself, so the "built with" line still sits apart from
the links (a real gap, not glued on) without being pinned edge-to-edge across the full row.

### 3. Fixed — mobile filter chips left a ragged, half-empty column
**File:** `app/_components/catalog-controls.tsx`

Category chips are content-sized pills in a `flex-wrap` row. At 390px that's fine at
desktop density but produces mostly one (occasionally two) chips per line at mobile width,
left-aligned, with the rest of each row empty — a jagged column next to the tightly packed
desktop version, and the kind of asymmetry that reads as unfinished. Fix: `grid
grid-cols-2` below `sm`, reverting to the original `flex flex-wrap` row at `sm:` and above,
where pills already had enough width to pack densely on their own. The 44px touch target
(`min-h-11`) is unchanged in both layouts — that constraint was explicitly defended earlier
in this project and still applies.

### 4. Fixed — two visually-identical search boxes do different things and didn't say so
**Files:** `app/_components/site-shell.tsx`, `app/_components/catalog-controls.tsx`

The sidebar's nav filter and the catalog's own search sit in near-identical bordered
fields, same muted placeholder styling, same general position (top of their respective
panel). Before this they were labelled "Filter components" and "Search" — generic enough
that typing in one and expecting the other to react was a reasonable, wrong guess. They
weren't merged (they narrow genuinely different things: one the nav tree, one the grid,
and wiring them together would break the nav's own job) — instead each now names its own
scope: "Filter sidebar" and "Search catalog".

### 5. Fixed — the Sort select rendered the browser's own arrow, not the site's
**File:** `app/_components/catalog-controls.tsx`

Every other disclosure control on the page — the sidebar's `<details>` chevrons, the
mobile menu icon — uses the same hand-drawn SVG chevron at the same stroke weight. The
`<select>` had no `appearance-none`, so it fell back to whatever arrow glyph the OS/browser
draws for a native select — a different icon language on the one page that otherwise keeps
its iconography consistent. Fix: `appearance-none` plus the same chevron SVG used
elsewhere, positioned absolutely inside a wrapping `relative` div.

### 6. Fixed — card hover feedback was easy to miss on dark/near-black demos
**Files:** `app/_components/preview-card.tsx`, `app/_components/featured-card.tsx`

The only hover cue was `group-hover:border-muted/40` — a 1px hairline brightening by a
small amount. On a lot of this registry's "loud" components (full-bleed canvas/WebGL,
often near-black at rest) that's below the threshold of what's perceptible at normal
viewing distance, so hovering a card could produce no visible change at all. Fix: a flat
(non-gradient — the design-dna ban is specifically on gradients, not translucency),
low-opacity `bg-foreground/[0.04]` wash layered above the demo, faded in on hover with the
same `transition-colors duration-200` already used for the border, `motion-reduce:` gated
to skip the animation (state still changes, just without the transition) same as the rest
of the codebase. No scale transform on the card, per the constraint — it holds a live
iframe and scaling it would jitter whatever's running inside; also strengthened the border
brightening itself (`border-muted/40` → `/60`) since it's now working alongside the wash
rather than carrying the whole effect alone.

### 7. Skipped — card grid `gap-y-14` (56px) isn't on the design-dna spacing scale
**File:** `app/_components/showcase.tsx`

design-dna.md's spacing rhythm is 4/8/12/16/24/32/40/64/96; 56px sits between two of those
steps. Not fixed: it's a deliberate, already-documented value (the file's own comment
explains the wide 2-up grid is what keeps a full-viewport demo readable rather than reading
as a smudge), and "it isn't on the token sheet" isn't something a visitor can perceive —
there's no visible seam or inconsistency it produces, just a number that doesn't match a
list. Not a real finding, just a nitpick; recorded here so it isn't silently dropped.

## Not flagged (already reads as finished)

- **Empty/no-results state** (`app/_components/showcase.tsx`) — centered, offers rescue
  queries that are real working searches, and a "Show all" escape hatch. No changes needed.
- **Card type hierarchy** — already addressed in the prior round of this work (title bumped
  from `text-sm font-medium` to `text-[15px] font-semibold` against the muted kind caption).
