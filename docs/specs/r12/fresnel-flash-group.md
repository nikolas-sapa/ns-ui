# fresnel-flash-group

**tier:** loud

**product surface it replaces:** full-bleed hero / section-background showpiece (same
bucket as `weld-pool`, `dye-whorl`, `flyback-tear` — not a settings surface, a hero or
divider background).

**the real mechanic:** a rotating first-order Fresnel lens drum in a lighthouse lantern
room. Multiple glass bullseye panels are arranged around a fixed lamp; as the whole
optic assembly rotates on rollers, each panel's beam sweeps past the horizon in turn,
and one panel (or a designated group) is built brighter/larger to produce the station's
identifying "characteristic" — a fixed flash pattern published in the List of Lights
(e.g. `Fl 8s`, one flash every 8 seconds). Source: historical Chance Brothers /
Barbier first-order Fresnel optics; IALA/USCG characteristic-light notation.

**one-sentence mechanic description:** a glass lens drum keeps turning at a steady rate
and, once per rotation, its brightest panel sweeps a beam across the viewer.

**rendering approach:** 2D canvas, full-bleed, `w-full h-full`. Drum radius =
`min(width,height) * 0.42`, geometry recomputed on `ResizeObserver`. 8 facet panels
placed evenly around the drum (45° spacing); one facet flagged "primary" bullseye,
1.4x brighter and 1.2x wider than the other 7. All colour from the 5 tokens via
`getComputedStyle` + `MutationObserver`, luminance ramp only.

**REAL NUMBERS:**
- Rotation: constant 45°/s → full lap every **8.0s**.
- Facet spacing: 45° → a facet glint crosses the camera-bearing marker every
  **1.0s** (8.0s / 8 facets).
- Primary-bullseye flash (the "characteristic"): fires once per 8.0s lap = `Fl 8s`.
- Beam falloff: Gaussian in angle-space, sigma = 6°, so the flash ramps in and out
  over roughly ±0.5s either side of peak — a visible sweep, never a single-frame blink.
- Ambient haze: independent drifting gradient behind the drum, 4px/s horizontal
  offset, wraps continuously — gives the dark interval its own slow structural change.
- Facet dwell before/after glint: ~0.27s core bright window per facet.

**the resting loop:**
- t0: drum mid-rotation, one non-primary facet mid-glint off-axis, haze at some offset.
- t2.5s: a different facet has swept past (2-3 facet crossings have occurred since
  t0), haze has drifted ~10px, drum orientation visibly rotated ~112°.
- t5s: the primary flash has very likely fired once somewhere in the window (period
  8.0s), drum has completed 5/8 of a full lap (225°) from t0 — clearly different
  silhouette from both prior frames.

**the reduced-motion freeze frame:** `STATIC_TIME = 3.4` (drum frozen at 153° into
its 8.0s cycle) — three facets partially lit at different values, none fully
saturated (as the primary flash peak would be, which blows out to a near-flat white
lobe) and none in the fully-dark inter-facet gap. Most structure per frame.

**interaction:** none required to read the mechanic; optional subtle pointer-linked
parallax (drum's apparent camera bearing shifts ±3° with pointer x) is allowed but
must NOT retint, must NOT change rotation speed, and must NOT be the thing that makes
it "alive" — the rotation alone already satisfies Filter 2 with zero input.

**light vs dark theme:** dark theme reads as the expected night scene — bright glint
and flash against a near-black sky, luminance ramp runs low→high. Light theme inverts
the value relationship rather than re-hueing: overcast daytime tower/drum silhouette
rendered as darker mechanical structure against a pale sky, so the "flash" reads as a
brief loss of contrast/flare-out (the drum washing toward the light background) instead
of a bright spot — check this explicitly early, since a literal dark-glint-on-light-sky
copy of the dark-theme composition is the failure mode this note exists to prevent.

**kill criteria:** if the primary flash is the only thing that reads as motion (i.e.
the inter-facet glint travel is imperceptible at card... at full-bleed scale) it
collapses into an on/off blink and fails the round-9 cadence rule — kill. If light
theme's drum reads as a flat grey disc with no perceptible rotation, kill.

**legibility:** the one thing to follow is the bright facet glint traveling around the
drum's rim; cadence is one facet crossing the 12-o'clock marker every 1.0s, a full lap
(and the identifying primary flash) every 8.0s.
