# offset-fountain-split

- **slug:** `offset-fountain-split`
- **tier:** loud (full-bleed WebGL showpiece)

## Product surface it replaces
Hero / full-bleed background.

## The real mechanic
Web-offset lithography ink train. Ink drawn from a fountain reservoir passes through a train of rollers (fountain roller → ductor → oscillating distributor rollers → form rollers); at every roller nip the ink film approximately halves in thickness ("ink splitting"), and the oscillating distributor rollers rock axially to smear that split film and prevent it from reproducing the printing plate's repeating image as visible banding ("ribbing"/ghosting). A press operator's fountain-key settings, one per printing zone across the sheet width, are never perfectly stable and drift slightly during a run. Source: offset-press ink-train roller kinematics and fountain-key metering, standard commercial print-shop process.

## One-sentence mechanic description
A cascading train of counter-rotating rollers repeatedly halves and smears a film of ink, fighting the ribbed banding pattern each split leaves behind.

## Rendering approach
WebGL shader, full-bleed, backing store DPR capped at 1.5. Ink-train modeled as 6 stacked horizontal roller bands. Each band's ink-film thickness is a 1D field along x (≥256 samples across container width), updated per frame: `value(x, i) = 0.5 * value(x, i-1) + smear(x)`, where smear is an oscillating horizontal blur applied only on bands 2-5 (distributor rollers; fountain and form rollers, bands 0 and 5, are not oscillated).

## Real numbers
- 6 roller bands, split factor 0.5 per band.
- Distributor oscillation: amplitude 14px, period 2.6s, bands 2-5 only.
- Fountain roller (band 0) driven by 24 discrete fountain-key zones across the width; each zone's target ink level follows a slow sine drift, period 40s, amplitude 0.18 — this drift is what keeps the field from ever converging to flat.
- Per-band relaxation constant tau = 180ms so a fountain-key shift visibly ripples down the train rather than snapping.
- Frame update at 60Hz.

## The resting loop
- t0: coarse vertical ribbed banding (~40px wide bands) from the seeded initial condition.
- 2.5s: fountain-key sine drift has moved several zones; coarse band density on part of the width is visibly different from t0.
- 5s: the split/smear cascade has visibly evened one band that was dark at t0 while a new uneven band has emerged elsewhere — never settles flat because the fountain-key drift never stops.

## Reduced-motion freeze frame
Freeze at t = 8.4s (`FREEZE_PHASE = 3/4-through-first-fountain-drift`), the point in the 40s drift cycle where measured banding variance peaks — most structured, not near-flat.

## Interaction
Pointer x-position may nudge the nearest fountain-key zone's target level +0.1 for 1.2s (simulating a key tweak), decaying back on its own. Luminance only, no permanent trace, no `--ns-accent`.

## Light vs dark theme
Ink-film thickness maps to luminance departure from `--background` toward `--foreground` in both themes (thin film near `--background`, thick near `--foreground`) — adjust bias/contrast per theme, never invert the mapping direction (per the dye-whorl precedent). Check light theme early: full-bleed sheets full-bleed in both themes, there's no "invert a thin band" escape hatch.

## Kill criteria
Reject if the roller-split simulation reads as generic Perlin cloud noise with no legible "band forms, then evens out, then reforms elsewhere" story. Reject if it needs an obvious color gradient to read (fails the monochrome-native test).
