# foil-block — CTA lockup as hot foil blocking

**Collection:** loud · **Surface:** closing CTA band — gap-map gap #2 (count today: 0)

## 1. Surface and the real process

Replaces the **closing CTA band**: the full-width final section of a landing page
carrying one headline and one button. `GAP-MAP.md` puts the registry's count of this
surface at **zero** — 17 slugs sit in the CTA bucket but 13 are destructive confirms and
success payoffs and the rest is button chrome. This is a full-bleed band, not a button:
the foil web runs the whole width of the section and the die strikes the headline's
terminal word as well as the button.

Borrowed process: **hot foil blocking (hot stamping)**. A heated brass or magnesium
die is pressed against a polyester foil web onto stock. The web is a stack —
PET carrier / release coat / lacquer / vacuum-metallised aluminium / heat-activated
size. Above the release temperature and above a pressure floor the metallised layer
transfers and stays; below either, nothing transfers. The carrier is then peeled and
the spent web **indexes forward** by one image length plus a gap, so the used web
carries a running negative record of every strike made. Standard trade numbers: die
110-130 °C, 0.3-0.8 MPa, dwell 0.2-0.5 s.

## 2. Nearest existing slug and why this is not a restyle

Nearest: `seam-gild` (loud) and `hero-letterpress-lockup` (loud).

`seam-gild`'s mechanic is fracture-then-refill along a biased random walk, and it is a
post-commit ornament that persists for the session; foil-block's mechanic is a
**transfer with a hard threshold** — a pixel either receives foil or does not, so a
strike has a visible cold-edge failure band and a make-ready void pattern that differs
between strikes, which a continuous refill cannot produce. `hero-letterpress-lockup`
ends in a terminal lock-up event and then holds; foil-block has no terminal state at
all because the spent web keeps indexing, which is the thing carrying its aliveness.

## 3. Mechanic

Die temperature field over the CTA type:

- Base die temperature 118 °C. Edge losses: temperature falls 9 °C linearly over the
  outer 6 px of the die outline (real — a die perimeter runs cold).
- Contact pressure field: a low-frequency make-ready field, 3 gaussian lobes,
  amplitude ±0.11 MPa about a 0.42 MPa mean, drifting at 0.014 Hz. Nothing about it
  resets between strikes, so consecutive strikes fail in different places.
- **Transfer rule:** a pixel receives foil iff `T >= 96 degC AND p >= 0.34 MPa`.
  Hard threshold, no soft ramp. This produces the characteristic ragged cold edge.

Strike cycle, 4.60 s total:

| Phase | Duration | What moves |
|---|---|---|
| approach | 420 ms | die descends 14 px, ease-out cubic |
| dwell | 300 ms | transfer mask evaluated once, at dwell end |
| peel | 280 ms | die lifts 14 px; last 90 ms the carrier still clings and the foil edge stretches <= 2 px |
| tail pull | 90 ms (overlaps peel) | 3-7 hairline filaments, 0.5 px, stretch from the trailing edge then part |
| web index | 1550 ms | spent web scrolls left 71 px at 46 px/s |
| idle | 1960 ms | web still, specular band still sweeping |

- **Ghost record:** the spent web carries the negative of the last 9 strikes across the
  band; ghost alpha decays 1.0 -> 0.18 over the visible run (9 x 71 px = 639 px).
- **Foil anisotropy:** vacuum-metallised aluminium is directional. A specular band
  24 px wide at 31° sweeps across every transferred area at 0.19 cycles/s,
  unconditionally and forever, independent of the strike cycle.
- Geometry derives from `min(w, h)`: die descent = `0.037 * min(w,h)` floored at 10 px;
  band width = `0.064 * min(w,h)` floored at 16 px.

## 4. Alive at rest (no input)

- **t = 0.0 s** — die is up, web mid-index at 18 px into its scroll, CTA type sits as an
  un-foiled outline, specular band at 4% across.
- **t = 2.5 s** — a strike has landed (die down at 1.9 s, transferred at 2.2 s); the type
  is foiled with the current make-ready's void pattern, specular band is left of centre
  at 43%, web has advanced 71 px so a ninth ghost has entered from the right.
- **t = 5.0 s** — second strike in progress at a different make-ready phase, so a
  visibly different set of micro-voids; specular band right of centre at 91%; the ghost
  train has shifted another 71 px and the oldest ghost has cleared the frame.

Nothing here is loud enough to fight the headline: the strike is confined to the button's
type, and the only motion crossing the whole band is the 24 px specular band at
0.19 Hz, which is slower than a reading saccade and never changes local contrast by
more than 0.16 L.

## 5. Reduced-motion freeze frame

**Freeze at t = 1.14 s of the cycle** (0.42 s approach complete, 0.30 s dwell complete,
0.42 s into peel).

Why: the die is 3 px off the type, foil is transferred, the tail filaments are at maximum
extension, the specular band is centred on the CTA word, and 9 ghosts are visible
behind on the web. That single frame contains the transfer, the peel, the anisotropy
and the record. t=0 shows a die in the air over blank type and an empty web — the
component's entire story missing.

Byte-stability: the make-ready field, the void mask and the ghost train are all functions
of a fixed seed and the frozen clock, computed identically on every mount.

## 6. Hue carried by luminance, both themes

Foil in the real world reads as "bright", which a light theme cannot give you.

- **Dark theme:** transferred foil sits at L 0.94 of the `--foreground`/`--background`
  ramp — bright metal on a dark ground.
- **Light theme:** transferred foil sits at L 0.22 — a dark burnish on pale stock. This is
  not a compromise, it is what pigment foil on white board actually looks like.
- The anisotropy is specified as a **delta, never an absolute**: the specular band is
  `local_foil_L ± 0.16`, so it reads identically in both themes without a direction flip.
- Ghost web: `--ns-muted` at 0.18-1.0 alpha over `--background`, both themes.
- Cold-edge failure band: `local_foil_L` blended 0.5 toward the stock, both themes.
- `--ns-accent` appears **only** on the DOM button fill and focus ring. It must not be
  mixed into the specular band — a metal highlight is exactly where this project keeps
  smuggling accent in (`edge-yield`, `granule-churn`, `shear-billow`).

## 7. Accessibility

- Canvas is `aria-hidden="true"`. The CTA is a real `<button>` (or `<a>` when it
  navigates), the headline a real heading, both always readable regardless of what
  the canvas is doing.
- Focus order: headline (not focusable) -> primary CTA -> secondary link.
- Focus ring: 2 px `--ns-accent` with 2 px offset, drawn in DOM, never on the canvas.
- Activation (mouse **and** keyboard, identically) fires one out-of-cadence strike as
  feedback; navigation/submit is never gated on the animation completing.
- No `aria-live` — no value changes here. State is carried by the button's own
  semantics.
- Type sits on a `bg-background/78 backdrop-blur` scrim; verify >= 4.5:1 at the frame
  where the specular band is directly behind the text block.

## 8. Placeholder copy

- eyebrow: `SECTION EYEBROW`
- headline: `Headline placeholder goes here`
- primary button: `Primary action`
- secondary link: `Secondary action`

No prices, no percentages, no guarantees, no customer counts.
