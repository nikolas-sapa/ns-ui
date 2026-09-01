# former-fold

- **slug:** former-fold
- **tier:** loud (full-bleed section transition)
- **surface:** section-to-section transition / layout transition

## 1. Surface it replaces + the real process
Section transition. Borrowed from the **folder on a web offset press**. The printed web runs over the
**former** — a triangular sheet-metal board, apex down, half-angle typically 30-45 degrees — which
folds the flat web in half along its centre line *as it travels*. The folded web passes through nip
rollers, is cut to length by a cutting cylinder, and is quarter-folded by a **chopper**: a thin blade
descending onto the folded sheet between two rollers, driving it into the nip. The signature artifact
is **former offset**: the two halves of the web travel different path lengths around the former, so
one half arrives short and the fold lands off centre unless a lead-in roller is shifted to
compensate. A folder also runs empty — the chopper cycles whether or not paper is present.

## 2. Nearest existing slug + why this is not a restyle
Nearest: `transition-panel-crumble` (the outgoing panel breaks into token-coloured grains that fall,
funnel toward the incoming panel and settle) and `transition-ascii-dissolve` (a drag-reversible
dissolve front with a band of glyph noise); also `crease-fall` (a concertina nav overlay whose
creases release and panels swing down). The two transitions **destroy** the outgoing content, and
crease-fall **unfolds** a stationary sheet in place. Here the outgoing section is neither destroyed
nor unfolded: it is a travelling web that is folded in half over a fixed former as it moves, so both
halves of the outgoing content survive intact, face each other, and are carried away as a folded
signature — while the incoming section is simply the next stretch of the same web arriving behind
the fold.

## 3. One-sentence mechanic
The outgoing section is a moving paper web folded in half over a triangular former board and
chopper-folded away, and the incoming section is the next stretch of the same web behind it.

## 4. Rendering approach
CSS 3D on real DOM. The outgoing section is cloned into 16 vertical strips (8 per half) sharing a
`perspective: 2.1*L` parent; each strip carries its own `rotateY` about the fold axis plus a
`translateZ`. Text stays real DOM inside the strips (so it degrades to readable content), with a
one-time per-strip rasterisation fallback only if dsf-2 subpixel shimmer is measured. The web
texture, roller flutes, former outline and chopper are one canvas layer behind the strips.
`L = max(W, H)` (the fold axis runs along the longer dimension so the V is legible in a card);
`M = min(W, H)` for the mechanism parts.

## 5. Real numbers
- **Former half-angle:** 35 degrees, apex at the transition line.
- **Transition duration:** 1.45s, over a travel distance of `1.9*L`, so `v = 1.31*L/s`.
- **The fold propagates inward, not as a hinge.** For a column at lateral position `u` in [-1, 1]
  measured from centre, and arc-length `s` past the former apex:
  `phi(u, s) = 90deg * smoothstep(0, 0.42*L, s - |u| * 0.42*L * tan(35deg))`.
  The web's outer edges reach the former first, which is why a real former produces a **curved**
  leading fold edge, not a straight one.
- **Former offset:** the two half-paths differ by `delta = 0.031*L`, so one half lands short. The
  component does not hide this — the folded edge sits `0.031*L` off centre and a lead-in roller
  visibly shifts by that amount over **240ms** mid-transition to correct it.
- **Chopper:** blade thickness `0.012*L`, descending at `2.4*L/s`, arriving at the 3/4 point of the
  transition. The sheet buckles at the blade over **90ms** and is pulled through the nip over
  **160ms**.

## 6. Unconditional resting loop (no transition running)
Critical: the gate never triggers a route or section change, so the **idle press** is the entire
graded read. Always-running rAF, whether or not a transition is in flight:
- **(a) the web never stops:** a 2-octave value-noise ink/fibre texture with feature size `0.018*L`
  scrolls at `v` across the whole surface, so every pixel of the panel is in motion. This alone makes
  t0 / 2.5s / 5s differ.
- **(b) lead-in rollers rotate** at `v / (pi * d)` with `d = 0.055*L` -> **7.6 rev/s**, each carrying
  6 visible flutes so the rotation reads rather than blurring to a grey disc.
- **(c) web wander:** the web wanders laterally `+/-0.009*L` on two non-resonant sines (6.7s, 2.9s),
  so the former's apex position drifts and the V's symmetry visibly changes.
- **(d) the chopper runs empty:** every **3.2s** the blade descends and returns even with no section
  change, giving a discrete legible mechanical beat.

- **t = 0s:** chopper up; roller flutes at 0 degrees; wander at `+0.004*L`.
- **t = 2.5s:** the texture has advanced `3.3*L` (completely turned over); rollers have made 19
  revolutions; the chopper is 78% through a descent; wander at `-0.007*L`, so the V's left arm is
  visibly wider than at t0.
- **t = 5s:** the chopper has completed one cycle and is 56% into the next; wander is back near
  `+0.003*L` but its 2.9s component is in antiphase with t0; the texture is unrecognisable against
  either earlier frame.

## 7. Reduced-motion freeze frame
`STATIC_TIME = 2.42s`. The chopper at full extension with the folded sheet buckled over the blade and
the web mid-wander: this single frame shows the former V, the folded edge, the blade, the nip and the
buckle simultaneously. **Not t0** — chopper parked and web straight is a picture of a triangle.

## 8. Scroll behaviour (top, bottom, card viewport)
The transition can be scroll-driven when a host wires it, or event-driven on a route change.
- Progress read **once per rAF from layout**, exactly as `registry/loud/ebb-flat/component.tsx:613`:
  `s = rect.height - innerHeight; p = s <= 0 ? 0 : clamp(-rect.top / s, 0, 1)`.
- **Top (p=0):** the outgoing section is flat and upstream of the former, fully readable.
- **Bottom (p=1):** the incoming section is flat and downstream. Mapping is clamped so overscroll
  cannot run past either end.
- **Hysteresis:** the chopper is not scrubbable. Once a stroke starts it completes on the clock
  independent of `p`, so a rubber-band scroll cannot reverse the blade mid-stroke.
- **Card viewport:** `rect.height - innerHeight <= 0` on `/preview/<name>` and
  `/preview/<name>/embed`, so `p` pins at 0, the transition never runs, and section 6 is the whole
  read. Geometry from `L` and `M` derived from the card's own box, so the former, rollers and chopper
  scale with the card rather than being tuned for a full page.

## 9. Hue -> luminance, both themes
- Web: one mid sheet value, `mix(bg, fg, 0.12)` light / `mix(bg, fg, 0.18)` dark.
- Fold depth is a per-strip Lambert term from one fixed lamp at azimuth 118 degrees:
  `L_strip = L_sheet + 0.22 * cos(phi_strip - lamp)`. A strip rotating through 90 degrees therefore
  sweeps a **0.44 L range in both themes** — the fold is carried entirely by value.
- The nip and the underside of the fold take a contact-occlusion darkening of **-0.17 L**, toward
  `--foreground` in light theme and toward `--background` in dark: in both cases a loss of local
  contrast under the fold.
- Content text keeps `--foreground` and is dimmed only by the same Lambert factor, so it stays
  readable until its strip is edge-on.
- `--ns-accent`: nothing at all in the render; only focus rings on any host-supplied controls.
- `--border`: the former's outline hairline only.
Tokens via `getComputedStyle` + `MutationObserver`, no literal fallbacks, no paint before the first
read.

## 10. Interaction
None required. If a host wires a trigger, it is a real button with an accessible name. No pointer
highlight anywhere on the web.

## 11. Kill criteria
- If the strips read as a generic 3D card flip, kill. The two things that make this a former board
  are the **inward-propagating fold** (outer edges first, curved leading edge) and the **former-offset
  correction**; if either is dropped for simplicity, the component is a flip and fails as a restyle.
- If real DOM text in rotated strips shimmers at dsf 2, rasterise per strip once at mount — do not
  abandon the fold.
- If, un-transitioned, the panel is not visibly different at t0/2.5s/5s, the idle press is not
  running and the component is dead however good the transition is.
