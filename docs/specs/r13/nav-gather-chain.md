> **CUT — do not build.** Collides with `structure-collating-mark` (same bindery gathering line: pockets, chain, saddle, caliper, misgather) and `structure-foredge-trim` (same book-block fore-edge). Three components off one bindery in a 30-component round is too many; per D4 the feature-grid bucket is the thinner one.
>
> Spec retained in full below only so the orchestrator can overrule with the
> full argument in hand. See `INDEX-nav.md`.

# gather-chain — multi-section step trail as a bindery gathering machine

## 1. Surface replaced + real process

**Surface:** the **step / section trail** on a long multi-section landing page
— the persistent "section 3 of 7" chrome that also lets you jump.

**Real process:** the **gathering machine** in a bookbindery (Sheridan,
Müller Martini). A chain conveyor carries a raceway of saddles beneath a row
of **pockets**, one pocket per signature — a signature being a folded 16- or
32-page section of the book. Each pocket's rotary sucker drum peels the bottom
sheet off its stack and drops it onto the carrier as it passes. By the last
pocket a complete **book block** has been assembled, in order. Real details
worth stealing:

- **The chain never stops.** Pockets fire in time with a passing carrier; the
  raceway runs empty when nothing is being gathered.
- **A caliper** — a mechanical feeler — rides the growing block and measures
  its thickness, catching a miss or a double.
- **A misgather is visible.** A block assembled out of order has a stepped,
  uneven fore-edge. You can see the mistake in the shape of the stack.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`wizard-dovetail`**, **`wizard-canal-lock`**, **`sorter-pocket-route`**,
**`breadcrumb-fold`**.

`wizard-dovetail` is the closest and it makes the **opposite** claim.
Completed steps contribute dovetail chips that slide in and **mate** — the
idea is interlock, so the sequence is rigid and an out-of-order state cannot
be depicted. `gather-chain`'s whole payload is that an out-of-order state
*can* be depicted: read section 4 before section 3 and the block's fore-edge
is visibly stepped, exactly as a misgathered book block is. The trail records
**the path you took**, not merely how far you got, and that is not a restyle
of a progress row — it is different information.

`sorter-pocket-route` shares the word "pocket" and inverts the machine: a
Hollerith card sorter drops **one item down one chute into one of N pockets**
(routing, one-to-many). A gathering machine has **N pockets each contributing
onto one passing carrier** (assembly, many-to-one). `wizard-canal-lock` is a
validation gate for a form; `breadcrumb-fold` is a hierarchy readout with no
accumulated state. `gather-marver` is a name collision only — it is
glassblowing, unrelated.

## 3. The mechanic — numbers

Geometry from `S = min(hostW, hostH)`. Horizontal layout at `hostW >= 520`,
rotated to vertical in a 96px gutter below that.

- **Pocket pitch** `P = clamp(44, (W − blockW − 24) / N, 84)` px, `N` = section
  count (3-9).
- **Pocket:** a 3px-wide stack of 4 hairlines (waiting signatures), a **5px
  rotary sucker drum** below it with 3 lobes, and a 1px drop chute 14px long.
- **Raceway:** a 1px rail with **saddle ticks** — 3px marks at **22 px**
  spacing.

**Ambient loops (unconditional):**

```
chain      saddle ticks translate at 17.0 px/s, forever, unbounded
drums      every sucker drum turns at 0.31 rev/s (111.6 deg/s), always;
           a real drum runs with the line and only its VACUUM is gated
caliper    the 6px feeler arm riding the block chatters +/- 0.5 px at 1.9 Hz
```

17.0 px/s on a 22 px pitch (period 1.294 s), 0.31 rev/s (period 3.226 s) and
1.9 Hz are mutually incommensurate; the resting state never repeats.

**Drop event** — fires when the reader's scroll **first** crosses section
`i`'s 50% mark:

```
0-220 ms    the drum's leading lobe darkens (vacuum engaged)
0-260 ms    a 9x2 px folded-sheet glyph falls 14 px under
            a = 2*14/0.26^2 = 414 px/s^2   (gravity, not an ease)
260 ms      lands with a 1.2 px squash, k=700 c=32 m=1
then        rides the chain to the block at 17.0 px/s
```

**Block.** A side-elevation stack at the trail's trailing end. Each arrived
signature adds **2.6 px** of thickness **at the x-offset of its own section
index**, so out-of-order arrivals produce a stepped fore-edge. Maximum height
`N * 2.6` px (23.4 px at `N = 9`).

**Caliper readout.** Mono, `"3 / 7 sig"`, beside the block. It updates **only
on arrival**, so at most once per section crossing — never a nagging counter.

**Un-reading is impossible, deliberately.** Scrolling back above a section's
50% mark does **not** remove its signature; a gathered block is not
un-gathered. Current position is a separate signal: a 2px `--foreground`
bracket around the active pocket. Two facts, two marks — the trail never has
to choose between "where you are" and "what you have read".

**Jump.** Activating a pocket scrolls to that section; the signature drops
when the scroll **actually crosses the mark**, not on click, so the mechanism
cannot lie about what was read.

**Perceptual budget (explicit):** at rest the moving elements are the saddle
ticks (3x1 px each, ~14 of them = 42 px²), the drums (`N` x 5x5 px lobes) and
a 6x1 px caliper arm — under **300 px²** total, i.e. **1.6%** of a 620x30
trail. Peak per-frame luminance change is **0.10 L**, confined to the 5px
drums. **No section label ever moves**: labels sit above their pockets on a
fixed baseline and are not attached to the raceway. The block grows only
downward inside a reserved `9 * 2.6 = 24` px band, so the trail's box height
is constant from mount and nothing under it reflows.

## 4. t = 0 / 2.5 / 5 s, zero input

- **t=0:** chain phase **0.000** of its 22 px pitch; every drum lobe at
  **0.0°**; caliper arm at **0.00 px**.
- **t=2.5:** chain has translated **42.5 px** → phase **0.932**; drums at
  **279.0°**; caliper arm at `0.5*sin(2π*1.9*2.5)` = **0.00 px** — but the
  chain and drums both differ, so the frame differs.
- **t=5:** chain at **85.0 px** → phase **0.864**; drums at **198.0°**;
  caliper at **0.00 px**.

Three distinct saddle-tick alignments and three distinct drum orientations
(0° / 279° / 198°, unambiguous with 3 lobes at 120° symmetry). One
always-running rAF loop; nothing gated on hover, focus, scroll, or `autoplay`.

## 5. Reduced-motion freeze frame

**`STATIC_TIME = 6.85 s`** of a canned 12 s read-through of a 7-section page,
with the reading order **1, 2, 4, 3** already gathered.

At 6.85 s, five states of the machine are simultaneously on screen:
- four signatures **in the block**, whose fore-edge is visibly **stepped**
  because 4 arrived before 3 — the misgather, which is the component's whole
  argument;
- signature 5 **mid-fall at 9.1 px of its 14 px drop**, with its pocket drum's
  leading lobe darkened;
- one signature **riding the chain** between pocket 4 and the block;
- pockets 6 and 7 still **full** (4 hairlines each);
- the caliper arm **seated** on the block at 10.4 px, reading "4 / 7 sig".

t=0 is an empty raceway above a zero-thickness block: a row of tick marks that
explains nothing.

All values are constants, so the frame is byte-stable. Under reduced motion,
drops are instant (the signature appears in the block with no fall and no
ride), the chain and drums are frozen at the phases above, and jumps are
`behavior: 'auto'`.

## 6. Hue carried by luminance, both themes

| element | token | light | dark |
|---|---|---|---|
| raceway rail | `--border` | 1px stroke only | 1px stroke only |
| saddle ticks | `--ns-muted` | 1.0 | 1.0 |
| pocket stack hairlines | `--foreground` @ 0.24 | 0.24 | 0.30 |
| sucker drum | `--ns-muted` | 1.0 | 1.0 |
| drum lobe, vacuum on | `--foreground` @ 0.70, **filled** | 0.70 | 0.78 |
| falling signature | `--foreground` @ 0.62 | 0.62 | 0.70 |
| block signature | `--foreground` @ 0.46, 1px `--foreground` @ 0.78 edge | — | +0.06 |
| caliper arm | `--foreground` @ 0.55 | 0.55 | 0.62 |
| active-pocket bracket | `--foreground`, 2px | 1.0 | 1.0 |
| section labels | `--ns-muted` / `--foreground` | — | — |

No hue. Every state pair is a **shape or count** difference, never a tone
swap: a pocket is full or empty by **how many hairlines it has** (4 → 3 → 2);
a drum's vacuum is on by **fill vs no fill**; a section is read by **whether a
signature exists in the block**. The stepped fore-edge — the component's most
important signal — is pure geometry and survives greyscale, forced colours,
and a 0.24-alpha light-theme worst case, because each block signature carries
its own 1px 0.78-alpha edge stroke rather than relying on its fill. Light
theme is checked first for exactly that reason. `--ns-accent` appears **only**
on `:focus-visible` rings.

## 7. Accessibility

**Structure.** `<nav aria-label="Reading progress">` > `<ol>` > `<li>`, each
containing `<a href="#section-i">` with the section title as its accessible
name, plus a visually-hidden `<span>` reading **"Read"** or **"Not read yet"**.
The raceway, pockets, drums, signatures, block and caliper are one
`<svg aria-hidden="true" focusable="false">`, `pointer-events: none`.

That visually-hidden read/unread string is the a11y equivalent of the block's
fore-edge, and it is the reason the component does not need to announce
anything: the state is **exposed on demand** rather than pushed.

**Current section.** The active link carries **`aria-current="location"`**,
updated from the same observer that positions the bracket.

**Focus order.** Document order = section order = visual order. This is a
landmark with plain links, **not** a `role="toolbar"` and not a tablist, so
Tab/Shift-Tab step through every section and **arrow keys are deliberately not
bound** — a section trail that captures `ArrowUp`/`ArrowDown` breaks the main
way keyboard users read a long page, which is the exact page this sits on.

**Activation.** `Enter` jumps and, on arrival (or immediately under reduced
motion), moves focus to the destination's `<h2 tabindex="-1">`. Required, not
optional: scrolling without moving focus strands a keyboard user's tab
position in the previous section.

**Escape.** Cancels an in-flight jump, leaving focus where it is. Otherwise a
**no-op that is not consumed**. No focus trap — nothing here is modal.

**aria-live — one message, once.** Passive scroll is **not** announced: a
polite region firing at every section boundary during a long read is
relentless, and `aria-current` plus the per-item "Read" text already carry the
state to anyone who navigates to the trail. The single exception is
completion: when the **last** section is gathered, one `role="status"`
`aria-live="polite"` message fires — *"All 7 sections read."* Once per
session, at a moment that genuinely means something. The chain, drums,
drops, ride and caliper are never announced, in either motion mode.

**What a screen reader hears, end to end.** "Reading progress, navigation,
list, 7 items" → "Pricing, link, Read, current location, 3 of 7" → "FAQ, link,
Not read yet, 4 of 7" → Enter → "FAQ, heading level 2" → ... → "All 7 sections
read."

**Contrast.** Section labels are `--ns-muted` (>= 4.6:1 both themes, checked —
they are real text at body scale) and `--foreground` at weight 620 when
current. Focus ring 2px `--ns-accent` at 2px offset; each label carries 6px of
padding so a ring never clips against a pocket's chute.

**Forced colours.** In `forced-colors: active` the rail, ticks and block
render in `CanvasText`, the active bracket and a vacuum-on lobe in
`Highlight`; the fill/outline and hairline-count distinctions survive, so the
misgather remains legible.

## 8. Behaviour in a short /preview card viewport

At 400x260 the trail **rotates to vertical** in a 96px gutter down the card's
leading edge, with the pockets on one side of the raceway and the block at the
bottom. The pitch/pocket/chain relation is preserved exactly under the
rotation — only the axis changes — and gravity for the drop points *across*
the raceway rather than down, which is what a vertical gathering line
genuinely looks like.

Pocket pitch floors at **30 px**, so a 260px-tall card holds **6** pockets.
A page with more sections collapses the middle ones into a single unlabelled
**express pocket** carrying a `+N` mark, and the block still receives a
signature per section so its thickness and fore-edge stay honest. Every
section link remains in the `<ol>` in the DOM — nothing is removed from the tab
ring or from a screen reader; only the arc of pockets is abbreviated.

The card body is its own scroll container, so wheel or drag inside the card
crosses the 50% marks and fires real drops — the assembly behaviour is
exercisable inside a card, not only on a full page. The chain, drums and
caliper run regardless, so the card's t=0/2.5/5 gate passes with zero
interaction and without the `autoplay` flag.
