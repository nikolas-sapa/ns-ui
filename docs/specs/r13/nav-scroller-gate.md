> **CUT — do not build.** The theme toggler is on GAP-MAP.md section 4's explicitly closed list ("do not re-open", `toggle-theme-ascii`). Mechanism strength does not reopen a closed surface.
>
> Spec retained in full below only so the orchestrator can overrule with the
> full argument in hand. See `INDEX-nav.md`.

# scroller-gate — theme switcher as a stage-lantern colour scroller

## 1. Surface replaced + real process

**Surface:** the landing page's **theme switcher** (Light / System / Dark),
sitting in the header as page furniture — not a settings panel.

**Real process:** the **theatrical colour scroller** fitted to a stage lantern
(Wybron Coloram, Rainbow, and similar). Gel frames are taped end-to-end into a
single continuous **gel string**, wound between two spools that sit in the
lantern's colour-frame slot. A stepper motor winds the string past the
**gate** — the lantern's aperture. Three properties are the reason to steal it:

1. **No random access.** To reach a distant frame the string must physically
   pass through every frame between, tape joins and all.
2. **The packs trade mass.** As the string winds, one spool's pack radius
   grows while the other's shrinks, so holding a constant *string* speed forces
   the two spools to rotate at **different and continuously changing** angular
   rates. Real scrollers solve this in firmware; here it is the visual.
3. **The gate never rests.** Gel in the gate ripples continuously in the
   lantern's cooling airflow, and the take-up spool dithers to hold tension.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`toggle-theme-ascii`** — the only existing theme control.

`toggle-theme-ascii` is a **static chip**: it reads the resolved
`--background`/`--foreground` at mount and on theme change and repaints itself
in their negative. It has no motion at rest, no transition, no intermediate
state and no geometry — its idea is *preview by inversion*, and it is complete
the instant the paint lands. `scroller-gate`'s idea is *transition as
traversal*: the mechanism's whole content is what happens **between** two
theme states — passing through the middle option and two taped joins, with the
two packs visibly trading mass and desynchronising as it goes. Remove the
traversal and the two-spool geometry and there is nothing left, which is the
test. This spec also deliberately does **not** paint a negative preview, so
the two components do not overlap visually either.

## 3. The mechanic — numbers

Geometry from `S = min(hostW, hostH)`.

- **Gate:** `44 x 26` px at `S >= 520`, `34 x 20` below. 1px `--border`
  aperture edge, 2px corner radius, hard clip.
- **Spools:** two circles flanking the gate, hub radius 6px, outer bound 18px.
  **Pack radius** `R_i = 6 + 9 * f_i` px where `f_left + f_right = 1` is the
  fraction of string on each spool. 3 hub spokes each, so rotation is legible.
- **Gel string:** **7 frames** — `Light`, spacer, spacer, `System`, spacer,
  spacer, `Dark` — each frame `44 px` wide (one gate width), separated by a
  **3 px opaque tape bar**. Spacer frames are real: gel strings are taped with
  unexposed frames between colours.
- **Wind:** constant string speed **169 px/s** (= 0.26 s per frame). Adjacent
  named frames are 3 frames apart, so Light→System is **0.78 s** and
  Light→Dark is **1.56 s**, with 2 and 4 tape bars crossing the gate
  respectively.
- **Stepper ramp:** accelerate 0→169 px/s over 90 ms, decelerate over 130 ms,
  **overshoot 1.4 px** and correct back over one 60 ms step. Motors under load
  overshoot and micro-correct; a CSS transition does not, and that difference
  is the tell.
- **Pack divergence during a wind:** `ω_i = v / R_i`. At the Light end
  (`f_left = 0.06`) the left spool spins at `169/6.5 = 26.0 rad/s` and the
  right at `169/14.4 = 11.7 rad/s` — a **2.2x** split, visibly reversing by the
  Dark end. This runs for free from the radii; no extra state.
- **The theme itself flips at t = 0 ms**, on activation, *before* the wind
  starts. The scroller is a **readout catching up with the machine**, never a
  gate in front of it. Making a user wait 1.56 s for their own theme change so
  an ornament can finish is exactly the failure this repo punishes.

**Ambient loop (unconditional):**

```
gate flutter    lower edge of the framed patch displaced vertically
                A * sin(2*pi*3.10*t),  A = 1.6 px peak
                envelope: A *= 0.4 + 0.6*(0.5 + 0.5*sin(2*pi*0.44*t))
tension hunt    whole patch translates horizontally +/- 1.1 px,
                period 2.30 s   (take-up spool dithering to hold tension)
```

3.10, 0.44 and 1/2.30 are mutually incommensurate, so the combined state never
repeats — unbounded, not a short loop.

**Perceptual budget (explicit):** the only things that move at rest are a
`44 x 26` tone patch's lower edge (1.6 px) and the patch itself (±1.1 px),
inside a hard-clipped aperture — total moving area **1,144 px²**, about
**1.2%** of a 96x40 control. **No text ever moves:** the three option labels
are laid out *outside* the gate and are never drawn on the gel. Peak
per-frame luminance change on any pixel is **0.07 L**, and the aperture's
1px `--border` edge is static, so the control's outline — the thing the eye
uses to place it next to copy — is rock solid.

## 4. t = 0 / 2.5 / 5 s, zero input

Flutter phase `φ_f = 3.10 t mod 1`, envelope phase `φ_e = 0.44 t mod 1`,
hunt phase `φ_h = t/2.30 mod 1`:

- **t=0:** `φ_f = 0.00`, `φ_e = 0.00` → A = 0.64 px, displacement **0.00 px**;
  hunt **0.00 px**.
- **t=2.5:** `φ_f = 0.75`, `φ_e = 0.10` → A = 0.90 px, displacement
  **−0.90 px**; hunt `φ_h = 0.087` → **+0.59 px**.
- **t=5:** `φ_f = 0.50`, `φ_e = 0.20` → A = 1.20 px, displacement
  **0.00 px** but the *envelope* has grown, and hunt `φ_h = 0.174` →
  **+1.03 px**, so the patch sits a full pixel right of its t=0 position with
  a different edge curvature.

Three distinct rasterised frames. One always-running rAF loop; no autoplay
descriptor, no hover, focus, or scroll gating.

## 5. Reduced-motion freeze frame

**`STATIC_TIME` = 0.55 s into a Light→Dark wind**, with ambient phases pinned
at `φ_f = 0.71`, `φ_e = 0.71`, `φ_h = 0.71`.

At 0.55 s the string has travelled 93 px, so the gate straddles **two frames
at once with a tape bar sitting 62% across it**; the left pack is at
`R = 11.4 px` and the right at `R = 12.6 px` with their spokes at visibly
different angles. This is the only frame that shows the three claims
simultaneously — no random access (two frames in one gate), a taped join, and
unequal packs. A resting frame (t=0) shows one uniform patch and two equal
spools with aligned spokes, and would read as a static chip.

All values are constants, so the frame is byte-stable. Under reduced motion
the wind itself is instantaneous — the theme flips and the scroller jumps to
the target frame with no travel — and the frozen frame is what the static
demo renders.

## 6. Hue carried by luminance, both themes

Each named frame is a **6-step luminance ladder** built from `--background`
and `--foreground` only. What differs between frames is which part of the
ladder is exposed in the gate:

| frame | ladder exposure | reads as (light) | reads as (dark) |
|---|---|---|---|
| Light | steps 1-3 (high L) | pale, 3 near-white bands | pale, 3 near-white bands |
| System | steps 1-6 (full range) | full ramp | full ramp |
| Dark | steps 4-6 (low L) | 3 near-black bands | 3 near-black bands |

Because the ladder is built from the *live* token pair, the frames keep the
same **structure** (3 or 6 bands, fixed 4px band height) in both themes while
their absolute tone follows the page. So the distinction survives a theme
flip: the difference between frames is band **count and position**, which is
geometric, not tonal.

| element | token | light | dark |
|---|---|---|---|
| tape bar | `--foreground` @ 0.85 | 0.85 | 0.90 |
| aperture edge | `--border` | 1px stroke only | 1px stroke only |
| spool hub + spokes | `--ns-muted` | 1.0 | 1.0 |
| pack ring | `--foreground` @ 0.34 | 0.34 | 0.40 |
| option labels | `--foreground` / `--ns-muted` | — | — |

Light theme is checked first: the `Light` frame is 3 near-white bands on a
light `--background`, which is the component's worst-case legibility. It is
kept readable by the **static 1px aperture edge and the tape bars** at 0.85,
never by the bands alone. `--ns-accent` appears **only** on the
`:focus-visible` ring of the checked radio.

## 7. Accessibility

**Structure.** `<div role="radiogroup" aria-label="Colour theme">` containing
three `<button role="radio" aria-checked>` with **visible text labels**
(`Light`, `System`, `Dark`) rendered outside the gate. The gate, spools,
string, tape bars and flutter are one
`<svg aria-hidden="true" focusable="false">`, `pointer-events: none`.

**Focus order.** The radiogroup is **one Tab stop** (roving `tabindex`): Tab
enters at the checked radio, Tab again leaves the group entirely. This is the
APG radio pattern and it is why the switcher does not cost header users three
tab presses.

**Keyboard.**
- `ArrowRight` / `ArrowDown` → next radio, `ArrowLeft` / `ArrowUp` → previous,
  both **wrapping** and both selecting on move (APG radio semantics).
- `Home` → Light, `End` → Dark.
- `Space` selects the focused radio (no-op if already checked).
- `Escape` is a **no-op and is not consumed** — nothing here is dismissible,
  and a header control that eats Escape breaks every dialog on the page.
- No focus trap: this is not a popup.

**aria-live — exactly one case, deliberately.** Selecting a radio is already
announced through `aria-checked`, so there is **no** live region for user
selection; adding one would double-announce every press. There is one genuine
gap: when `System` is checked and the **OS preference changes with no user
action**, the resolved theme changes while `aria-checked` does not. That case,
and only that case, fires one `aria-live="polite"` message: *"System theme
changed to dark."* The flutter, the hunt, the wind and the tape bars are never
announced.

**What a screen reader hears.** "Colour theme, radio group" → "System, radio
button, checked, 2 of 3" → ArrowRight → "Dark, radio button, checked, 3 of 3".
Identical in both motion modes.

**Contrast.** Option labels are `--foreground` (checked) / `--ns-muted`
(unchecked) on `--background`, both >= 4.6:1 in both themes — the checked
state is carried by **label weight (500 → 620) plus a 2px underline rule**,
not by tone alone, so it survives for low-vision users and in forced-colours
mode. Focus ring 2px `--ns-accent` at 2px offset.

**Forced colours.** In `forced-colors: active` the gate ladder is replaced by
`CanvasText` bands with the tape bars at `Highlight`; the mechanism survives
as pure geometry.

## 8. Behaviour in a short /preview card viewport

At 400x260: `S = 260`, so the gate drops to `34 x 20`, frames to 34 px wide,
tape bars to 2 px, spools to a 14 px outer bound (`R_i = 5 + 7 f_i`). String
speed scales with frame width to **131 px/s**, holding 0.26 s per frame, so
Light→Dark stays at 1.56 s and the traversal is still legible in a card.

The three labels stack **below** the gate in a single row at `hostW >= 300`
and in a vertical column below it under 300 px — the labels are never
abbreviated or replaced by icons, because the radiogroup's accessible names
are its whole contract. The ambient flutter and tension hunt are independent
of width and run unchanged, so the card's t=0/2.5/5 gate passes with zero
interaction and without the `autoplay` flag.
