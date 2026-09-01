# nonpareil-comb

- **slug:** nonpareil-comb
- **tier:** loud (full-width footer band)
- **surface:** footer — GAP-MAP gap #1 (count today: 1, and that one is a scroll instrument)

## 1. Surface it replaces + the real process
Footer. Borrowed from **paper marbling on a size bath**, the process that makes book **endpapers** —
the sheet that joins the text block to the case, and whose rear instance is literally the last
surface of a book.

The mechanics are exact, not decorative. A tray holds a **size** (carrageenan or gum tragacanth)
thickened enough that a drawn line holds its shape. Pigment is dropped onto the surface with **ox
gall**, which lowers the drop's surface tension so it **spreads and stops** at a boundary. Nothing
diffuses and nothing mixes: each drop is a 2D area-preserving disc that **displaces** everything
already on the surface outward into a ring. A **rake** (teeth at ~1 inch pitch) drawn across turns
the field of stones into waves; a **comb** (teeth at 1/8 inch) drawn across converts those waves
into the fine vertical striations called **nonpareil** — the pattern is strictly columnar, by
construction. A sheet is then laid on and lifted, taking the whole pattern off intact, and the bath
must be **skimmed** with a strip before the next sheet.

A footer is a wide, multi-column terminal band. A nonpareil comb pass *is* a multi-column band, and
the endpaper *is* the terminal sheet.

## 2. Nearest existing slug + why this is not a restyle
Nearest: `dye-whorl` (loud). Its header comment is explicit about what it is: a real incompressible
Navier-Stokes solver whose identity is **volume and diffusion** — semi-Lagrangian advection,
vorticity confinement, pressure projection, density-driven buoyancy against a local mean producing
Rayleigh-Taylor fingering, MacCormack-corrected dye transport, plumes with dense cores that
dissipate into haze.

This is the physical opposite and the code is opposite with it. A marbling bath has **no diffusion
term at all**: the pattern is a set of *material boundaries* on a 2D immiscible film, and its
defining property is that it is **conserved**, which is exactly why it can be lifted off onto paper
intact. There is no volume, no buoyancy, no dissipation, no third dimension. A drop does not billow;
it obeys the area-preserving map `r' = sqrt(r^2 + R^2)` and pushes its neighbours into an annulus.
And the two events that make it a component — the **comb pass** that imposes columns, and the
**transfer** that removes the pattern from the bath and puts it under the footer's content — have no
analogue in `dye-whorl` whatsoever.

Second-nearest: `footer-ascii-rule`, the registry's only footer, which is a back-to-top scroll
instrument with a sitemap attached; its surface is inert. Third: `background-capillary-wick` and
`fugitive-ink` (ink on paper, not on a bath, and neither is a footer).

**Explicitly not the `footing-course` failure.** That component was removed for inventing a
house-style footer. Every number below comes from the process; the comb pitch, the drop map and the
skim are not stylistic choices.

## 3. One-sentence mechanic
Pigment stones are dropped onto a size bath and displace each other as area-preserving discs, a comb
pass rakes them into nonpareil columns, and the finished pattern is lifted onto a sheet that becomes
the footer's own backing while the bath is skimmed and started again.

## 4. Rendering approach
**Boundaries, not a grid.** The pattern is a set of closed polygonal contours (the material lines
between tones), advected as vertex lists with adaptive resampling — which is what a marbling
boundary physically is, and it is far cheaper than a fluid grid. Budget: **~2,400 vertices total**
across all contours, resampled so no edge exceeds `0.004*M`. Fill by even-odd winding into 4 value
stops. 2D canvas.

The band has two registers stacked vertically: the **bath** (upper `0.58*Hb`) where the pattern is
being made, and the **finished sheet** (lower `0.42*Hb`) carrying the footer's real DOM — wordmark,
sitemap columns, legal line. Every cycle a new sheet is lifted from the bath and slides into the
lower register, pushing the previous one down onto a small accumulating stack at the right end. The
footer's content therefore always sits on a **stable, finished** surface; the bath never goes blank
underneath live text.

`M = min(bandW, bandH)`; `Hb` = band height; `W` = band width.

## 5. Real numbers
- **Drop map (this is the whole physics):** a stone of radius `R` landing at `c` maps every existing
  point at distance `d` from `c` to `d' = sqrt(d^2 + R^2)` along the same ray. Area-preserving,
  analytic, and it is what produces marbling's characteristic nested rings. Apply it to every
  contour vertex, then resample.
- **Stone-in, 4.2s:** 7 drops at **600ms** intervals, each expanding to its full `R` over **260ms**
  on an ease-out. `R` steps down across the sequence, `0.085*M -> 0.042*M`, so later drops read as
  landing *into* an established field rather than clearing it.
- **Rake pass, 1.5s:** teeth at **`0.10*M`** pitch (the 1-inch rake), drawn top-to-bottom at
  `0.9*Hb_bath/s`. Each tooth displaces the surface along the stroke with a transverse falloff
  `dy = A * exp(-(dx/w)^2)`, `A = 0.075*Hb_bath`, `w = 0.42 * pitch`.
- **Comb pass, 1.8s — the striking moment:** teeth at **`0.0125*M`** pitch (the 1/8-inch comb,
  exactly 8x finer than the rake), drawn left-to-right at `0.6*W/s`, same falloff form with
  `A = 0.030*Hb_bath`, `w = 0.42 * pitch`. This is what converts a field of blobs into **nonpareil
  columns**, and at `M = 340` the pitch is 4.25px — one column per ~4px across the band, fine enough
  to read as a texture and coarse enough not to alias at dsf 1.
- **Dwell, 2.1s:** the bath is never still. Boundaries creep under residual surface tension at
  **0.4 px/s** normal to themselves, and the whole film sways on two non-resonant sines (periods
  8.9s and 3.7s, amplitude `0.006*M`) — a real tray gets bumped and the room has air movement.
- **Lift, 1.2s:** the sheet comes down and off. The bath's contours are **removed** (not faded) over
  700ms, top edge first, exactly as a sheet peels; simultaneously the same contour set appears on
  the new finished sheet sliding into the lower register.
- **Skim, 0.9s:** a strip drags across the bath left to right, clearing the residual boundary
  fragments the lift left behind.
- **Idle, 2.3s**, then repeat. **Cycle = 14.0s, unbounded.**
- **Sheet stack:** finished sheets accumulate at the right end of the lower register, `0.006*M` of
  visible edge each, capped at 14 sheets and then the pile is jogged away over 600ms.

## 6. Unconditional resting loop
The 0-5s window falls inside stone-in and the rake, the most visibly kinetic phase — but every
phase moves, including the dwell.
- **t = 0s:** three stones landed, the fourth expanding; the field is a set of nested rings; the
  finished sheet below carries the previous cycle's nonpareil.
- **t = 2.5s:** all seven stones are in and the rake is 15% down its stroke — the top strip of the
  bath has already gone from rings to waves while the bottom is still rings. Two distinct pattern
  regimes coexist in one frame, which is the clearest possible proof of self-animation.
- **t = 5s:** the rake has finished and the comb is 40% across — the left 40% of the bath is
  nonpareil columns, the right 60% is still waves, and the comb's teeth are visible at the front.
  The finished sheet below is unchanged, so the footer's content has been stable throughout.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 6.1s`. Mid-comb: roughly **60% of the bath combed into nonpareil columns and 40%
still in raked waves**, with the comb teeth sitting at the boundary between the two states, and a
finished nonpareil sheet in the lower register below. That single frame shows the input pattern, the
tool, the output pattern and the product simultaneously. **Not t0**, which is a few concentric rings
and would read as an abstract graphic rather than a process.

## 8. Scroll behaviour
None. The footer never reads scroll — that is `footer-ascii-rule`'s mechanic and duplicating it
would collapse the distinction between the registry's only two footers. All geometry from
`M = min(bandW, bandH)`. Below `Hb = 100px` the two registers collapse to one: the bath is dropped
and only the finished sheet (with the content on it) is kept, still slowly swaying — the component
degrades to its product rather than to an empty band.

## 9. Hue -> luminance, both themes
Marbling is normally a colour art, so this is where the concept has to earn monochrome-native
status. It does, because the pattern is carried by **region partition**, not by pigment identity:
- **4 value stops** for the four pigment regions, spanning `mix(bg, fg, 0.08)` to
  `mix(bg, fg, 0.74)` in light theme and `mix(bg, fg, 0.14)` to `mix(bg, fg, 0.80)` in dark. The
  ramp direction never inverts; only bias and spacing change, per the `weld-pool` / `ebb-flat`
  precedent for a full-bleed surface.
- **Adjacent regions are never adjacent stops.** Assign stops so every shared boundary carries at
  least **0.22 L** of contrast — this is the single thing that makes a nonpareil column legible at
  4.25px width, and it must be checked in light theme first, where headroom is smaller.
- The size bath itself is the lightest stop in light theme and the darkest in dark theme, so the
  *pigment* always reads as the marked material against the unmarked bath in both.
- The comb and rake are `--foreground` silhouettes with a single **+0.20 L** highlight line on the
  tooth tips — the only specular in the component, and a value, not a tint.
- The lift is carried by geometry (contours removed edge-first) and a **-0.09 L** wet-sheet shade,
  never by an opacity fade to a colour.
- `--ns-accent`: only the footer's own controls — newsletter submit, back-to-top, focus rings. It
  never touches the bath, the comb pass or the lift, which are the climactic moments and therefore
  the highest-risk place for the standing accent defect.
- `--border`: the hairline between the footer and the page above, and the sitemap column rules.
Tokens read via `getComputedStyle(document.documentElement)` + `MutationObserver` on documentElement's
class, **no literal fallbacks**, and no paint before the first read — guard the rAF start, the
`ResizeObserver` callback and the `IntersectionObserver` resume path specifically.

## 10. Interaction
None on the bath. **No pointer stirring** — a cursor-driven fluid disturbance is `dye-whorl`'s
territory and adding it here would hand a reviewer the restyle argument for free. Footer DOM controls
behave as ordinary footer controls with accessible names; Tab from a blurred body reaches one within
12 presses. The cycle keeps running during interaction.

## 11. Canvas host
DPR cap 2 (a short band). `ResizeObserver` on the band element, not `window.resize`. Pause on
`IntersectionObserver` threshold 0 and on `visibilitychange` — a footer is offscreen for most of a
page's life. Adaptive ladder: reduce the **vertex resample density** first (edges up to `0.008*M`),
then the contour count, **never the comb pitch** — the pitch is the mechanic. Gate every step on
sustained wall-clock milliseconds over budget, never on frame count, never on a device heuristic.

## 12. Kill criteria
- **If the pattern ever reads as diffusing, mixing or billowing, kill it** — it has become
  `dye-whorl` and the entire non-duplication argument is gone. The test is direct: pause the sim and
  confirm every boundary is still a sharp material line with no gradient across it.
- If the nonpareil columns are not resolvable at `0.0125*M` pitch in **light theme** at dsf 1,
  raise the adjacent-region contrast requirement above 0.22 L first; if that fails, coarsen the comb
  to `0.018*M` and say so in the docblock as a stated departure from the 1/8-inch pitch. Do not
  silently keep the number and ship an unreadable band.
- If the finished sheet in the lower register is not visibly a *different, stable* surface from the
  bath, the two-register structure has failed and the footer's content is sitting on a moving
  backdrop — the thing this structure exists to prevent.
- If the build reaches for a fluid grid instead of advected contours, stop: the contour
  representation is not an optimisation, it is the physical claim.
