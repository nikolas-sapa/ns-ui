# automat-wall — mega-menu as a serviced automat wall

## 1. Surface replaced + real process

**Surface:** the marketing-site **mega-menu** — the wide multi-column panel
that drops from a top-level nav item.

**Real process:** the **Horn & Hardart Automat** (Philadelphia 1902, New York
1912-1991). A wall of small compartments, each behind its own glass door in a
chrome frame. A customer drops a nickel, turns the knob, the door opens, the
dish comes out. The part worth stealing is the **back of house**: each
compartment is open at the rear onto the kitchen, and staff restock
compartments from behind, one at a time, in a continuous round — so the wall
is *serviced whether or not anyone is buying*. A compartment is never
"closed"; it is either stocked, being restocked, or empty.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`menu-nested-trays`**, **`context-menu-unfold`**, **`dropdown-drape`**,
and `crease-fall` on the `feat/lab-menu` branch.

All four make the same class of claim: *one panel, one continuous surface,
revealed by a folding or draping geometry* — telescoping trays, a hinged
pocket-knife spine, a verlet cloth awning, a concertina sheet. `automat-wall`
claims the opposite structure: the panel is **not one surface**, it is an
array of independent cells with per-cell state, and its defining behaviour is
a **service cycle that runs while the panel is shut**. None of the four has
any behaviour at all in the closed state, and none has a per-cell state
machine — take the restock round away and this is a plain grid, which is
exactly why the restock round is the component.

## 3. The mechanic — numbers

Geometry from `S = min(hostW, hostH)`.

- **Cell:** `168 x 40` px at `S >= 520`; `132 x 36` below. Chrome frame 1px,
  corner radius 3px, inner glass inset 3px.
- **Closed state (the front rank):** the nav bar carries a horizontal strip of
  **3 cells** beside the trigger. This strip is the component's resting form
  and it is always visible.
- **Open state (the wall):** `cols = clamp(2, floor((hostW - 64) / 176), 4)`,
  `rows = ceil(itemCount / cols)`, capped at 3 rows with internal scroll.
- **Restock round (unconditional):** cells are serviced in raster order,
  **one at a time, one every 1500 ms**, each restock lasting **900 ms**:
  - 0-260 ms: the cell's **back door** (a 1px `--border` rule at the cell's
    inner top edge) slides down 4 px, `cubic-bezier(.4,0,.2,1)`.
  - 260-720 ms: the **plate** — a 10px-diameter disc behind the label,
    `--foreground @ 0.16` — translates **6 px** from the cell's rear inset to
    its seated position, easing `cubic-bezier(.22,.8,.3,1)`, overshooting
    0.8 px and settling on `k = 480, c = 34, m = 1`.
  - 720-900 ms: the back door slides back up 4 px.
  - The strip's 3 cells share the same round, so a full cycle over the closed
    strip is **4.5 s**; over a 12-cell open wall it is **18.0 s**.
- **Glass:** each pane carries a fixed 1px inner highlight at its top edge,
  `--foreground @ 0.10`. Static — no travelling specular sweep, because a
  moving highlight over a label is precisely the thing this slice must not do.
- **Empty cells** (a cell whose restock has not yet come round after a wall
  open) draw no plate; the label still reads at full contrast. Emptiness is
  the *plate*, never the *text*.
- **Opening:** the frame draws in from the trigger cell outward in the **same
  raster order as the restock round**, 34 ms per cell, each cell's glass
  fading `0 → 1` over 190 ms with scale `0.985 → 1` on `k = 420, c = 30, m = 1`.
  A 12-cell wall is fully drawn in `11*34 + 190 = 564 ms`.
- **Closing:** reverse raster, 18 ms per cell, glass fade 120 ms — 320 ms
  total. Closing is faster than opening because a shut door is not an event.

**Perceptual budget (explicit):** exactly **one** cell is in motion at any
instant. Its moving region is a 10px disc over 6px of travel plus a 1px rule
over 4px = **~140 px²**, i.e. **2.8%** of the closed 3-cell strip (504x40) and
**0.7%** of a 4x3 open wall. **No label, heading or meta line ever
translates, fades, or reflows** — the plate is drawn behind the text at
`--foreground @ 0.16` and the text is drawn at full `--foreground` on top.
Peak per-frame luminance change on any pixel is **0.11 L**. Cell boxes never
resize after the open animation completes, so nothing under the panel reflows.

## 4. t = 0 / 2.5 / 5 s, zero input (closed strip)

- **t=0:** cell 0 at 0 ms of its restock — back door starting down, plate at
  its rear inset. Cells 1 and 2 stocked, plates seated.
- **t=2.5:** cell 0 finished at 900 ms and is stocked; cell 1 started at
  1500 ms and is at 1000 ms of... (its 900 ms round ended at 2400 ms) — so at
  2.5 s cell 1 is freshly stocked with its plate still 0.3 px above seat on
  the settle spring, and cell 2 is 500 ms from starting. **Two of three cells
  have changed state since t=0.**
- **t=5:** the 4.5 s round has wrapped; cell 0 is at 500 ms of its **second**
  restock — back door fully down, plate mid-travel at 3.1 px of 6 px. A
  different cell is open at the back than at t=0 and than at t=2.5.

One always-running rAF clock drives the round. Nothing is gated on hover,
scroll, focus, open state, or `autoplay`; the closed strip is what the gate
screenshots and it is what moves.

## 5. Reduced-motion freeze frame

**`STATIC_TIME = 7.35 s`** of the 18.0 s open-wall round, rendered with the
wall **open** (the demo's reduced-motion path renders the open state, since a
frozen closed strip would hide the panel entirely).

At 7.35 s: cell index 4 is at 450 ms of its restock — back door fully down
(4 px), plate mid-travel at **3.4 px of 6 px**. Cells 0-3 show seated plates;
cells 5-11 show none. Chosen because it is the only frame class in which
**all three cell states are simultaneously on screen** — stocked, servicing,
empty — plus a visible back door, which is the mechanism's entire premise and
is invisible in every resting frame. t=0 shows a uniform wall of identical
stocked cells and reads as a plain grid of links.

All quantities at 7.35 s are constants (`4`, `4 px`, `3.4 px`), so the frame
is byte-stable across runs.

## 6. Hue carried by luminance, both themes

| element | token | light | dark |
|---|---|---|---|
| cell frame | `--border` | 1px stroke only | 1px stroke only |
| glass highlight | `--foreground` @ 0.10 | 0.10 | 0.14 |
| glass fill | `--background` | — | — |
| plate (stocked) | `--foreground` @ 0.16 | 0.16 | 0.20 |
| back door rule | `--border` | 1px | 1px |
| cell label | `--foreground` | 1.0 | 1.0 |
| cell meta line | `--ns-muted` | 1.0 | 1.0 |

Stocked vs empty is carried by **presence of a disc**, not by tone — a
binary shape difference that survives at any contrast, which matters because
`--foreground @ 0.16` on a light `--background` is a genuinely faint mark.
Light theme is checked first for exactly this reason; the plate's readability
floor is set by its **edge** (a 1px `--foreground @ 0.28` ring on the disc) so
it never depends on the fill alone. `--ns-accent` is used **only** on the
`:focus-visible` ring and on any CTA cell's button fill — never on a plate,
pane, frame, or door.

## 7. Accessibility

**Roles.** The trigger is `<button aria-expanded="false" aria-controls="automat-wall">`.
It carries **no `aria-haspopup`** — the panel contains links, not menu items,
so this is a **disclosure**, not a menu. Declaring `haspopup="menu"` here
would promise arrow-key menu semantics the panel does not implement and is a
common real bug in mega-menus.

The panel is `<div id="automat-wall">` containing one `role="group"` per
column, each `aria-labelledby` its own `<h3>` (real headings, so heading
navigation works), each holding a `<ul>` of `<li><a>`.

**Focus order.** Trigger → (on open) first cell link → cells in DOM order,
which is column-major and matches the visual columns → out of the panel to
the next nav item. **No focus trap.** A nav disclosure must not trap: the
user has to be able to Tab past it into the rest of the header. Tabbing off
the last cell closes the wall silently and continues to the next header
control.

**Keyboard.**
- `Enter` / `Space` on the trigger toggles; `aria-expanded` follows.
- `Escape` anywhere inside the panel closes it and **returns focus to the
  trigger**. `Escape` when the panel is shut is a no-op and is not consumed.
- `ArrowRight` / `ArrowLeft` / `ArrowUp` / `ArrowDown` move focus through the
  wall using its real 2D geometry (right from the last column wraps to the
  next row's first column; up from the top row returns to the trigger).
  `Home` / `End` go to the first / last cell. These are **additive**: Tab is
  never blocked, so a user who does not know the arrow affordance is never
  stuck.
- Arrow keys are **not** bound while the panel is closed — the page keeps
  its scroll keys.

**Pointer.** Opens on **click**, not hover. An optional hover-open path is
gated on `(pointer: fine)` with a **220 ms** intent delay and a **380 ms**
close delay; touch and keyboard never take the hover path.

**aria-live: none, deliberately.** `aria-expanded` already conveys open and
closed; adding a live region would double-announce every toggle. The restock
round carries **zero** information and is never announced. A screen reader
hears: "Products, button, collapsed" → activate → "Products, button,
expanded" → "Platform, group" → "Overview, link" ... and hears nothing at all
from the servicing cells, in either motion mode.

**Gate descriptor.** `openBy: "button[data-automat-trigger]"`,
`expect: "[data-automat-marker]"` — a dedicated 8x8 `<rect>` placed inside
cell 0's glass, genuinely occluded by the closed strip's clip rect and
genuinely clear once open. Per `docs/review-workflow.md`, `expect` must not
point at the frame or the trigger, both of which render identically open and
shut.

**Contrast.** Labels `--foreground` on `--background` (>= 12:1 both themes);
meta lines `--ns-muted` (>= 4.6:1 both themes, checked, since meta text is
body-size). Focus ring 2px `--ns-accent` at 2px offset; cell padding is 8px
so the ring never clips against the 1px frame.

## 8. Behaviour in a short /preview card viewport

At 400x260: cells drop to `132 x 36`. The **closed strip shortens to 2 cells**
(`floor((400 - 64 - triggerW) / 136)`), and the restock round shortens to
3.0 s — still well inside the t=0/2.5/5 gate. On open, `cols = clamp(2,
floor(336/176), 4) = 2` and the wall renders 2 columns x 3 rows, height-capped
at `hostH - navH - 12 = 200 px` with the grid scrolling internally and the
service round continuing across off-screen cells (they are restocked whether
or not they are in view — which is what a real kitchen does, and it means
scrolling the panel reveals a wall in mixed state rather than a frozen one).
Under 300 px wide the closed strip drops to **1 cell**; a one-compartment
automat is still an automat, and the round becomes a 1.5 s single-cell cycle,
so the resting loop survives at the narrowest card the registry renders.

## 9. Addendum — where this sits in GAP-MAP's axis map

Not exposed to §3.5 (the small mechanism metaphor, 15 of 59 removals): there is
no ratchet, pawl, gear train, cam or capstan here, and no mechanism drawn
beside a control. The restock round is a **service schedule over an array**,
not a machine badge.

It lands instead on an axis `GAP-MAP.md` §3 explicitly names as *not*
exhausted: **multi-element choreography** — "components where N discrete blocks
negotiate with each other are rare and all sit in the thin buckets". A wall of
independently-stocked cells serviced in raster order is exactly that shape, on
the surface (#9, mega-menu) the gap list says the registry has zero of.

Also clear of the closed list: this is not a preloader, curtain, 404, empty
state or theme toggler, and it is not a restyle of `gel-wash` or
`footing-course`'s failure mode — the mechanic is a documented real operation
(back-of-house restocking through open-backed compartments), not a house-style
answer invented for the category.
