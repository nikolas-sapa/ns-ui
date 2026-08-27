# meter-matrix-scan

**tier:** core

**product surface it replaces (Filter 1):** a level/value meter — same
slot as `meter-quota-meniscus`, `meter-latency-capillary`,
`meter-context-window`, `meter-threshold-trip`.

## The real mechanic

Cheap commercial LED dot-matrix signage (scrolling ticker boards, gym
scoreboards, elevator floor indicators, budget character displays built on
row/column multiplex driver chips) cannot afford one continuous driver per
LED. Instead the panel **scans one row at a time** at a frequency well
above human flicker fusion, relying on persistence of vision to perceive a
complete static image — and within each row's brief active slice, an
individual LED's apparent brightness is set by **PWM (pulse-width
modulation) duty cycle**, not analog current: the LED is either fully on or
fully off at any instant, and perceived brightness is the fraction of the
row's active window it spends on, quantized to a small number of duty
steps (a driver's PWM bit depth). This is real, documented multiplex-driver
behaviour (the class of chip behind many commercial LED matrix boards),
distinct from every other ASCII/glyph-luminance component in this registry
because the luminance ramp here is a literal quantized time-division duty
cycle, not a continuous alpha or density value.

## One-sentence mechanic description

A level meter rendered as a genuinely row-multiplexed LED dot-matrix panel
— rows light in strict round-robin sequence at a real scan rate, and each
LED's brightness is the fraction of its row's active slice it was held on,
quantized into a small number of PWM steps rather than a smooth fill.

## Rendering approach

2D canvas. Grid: 5 rows (fixed) x N columns, N derived from
`floor(containerWidth / cellSize)`, `cellSize ≈ containerHeight / 5` so the
5 rows fill the container's smaller dimension (height) — square cells,
~2-4px gutter between dots.

## Real numbers

- `ROWS = 5`.
- `ROW_SCAN_HZ = 240` — each row is the active scan target for
  `1000/240 ≈ 4.17ms` before advancing to the next row. A full 5-row panel
  therefore completes one full-frame refresh every `5 * 4.17 ≈ 20.8ms`
  (≈48Hz full-panel rate), comfortably above flicker fusion, matching real
  multiplex-board practice (commonly scanned in the low-hundreds-of-Hz
  per-row range to stay invisible to the eye at full-panel refresh well
  above 24Hz).
- `PWM_LEVELS = 8` — a 3-bit duty-cycle depth, typical of budget multiplex
  driver chips. Brightness is quantized to 8 discrete bands, never a
  continuous gradient — this quantization is the component's identity and
  must remain visible, not anti-aliased away.
- The meter's underlying value drifts continuously (simulated live sensor
  read, e.g. `value += sin/noise * small amplitude` every frame) rather
  than holding a fixed static level, so which LEDs and which PWM band each
  occupies shifts over time independent of the scan itself.

## The resting loop — t0 / 2.5s / 5s

Two independent sources of change compound: the row-scan phase (always
cycling at `ROW_SCAN_HZ`) and the slowly drifting meter value. t0/2.5s/5s
screenshots land at different scan phases AND different drifted values, so
the lit pattern is visibly different at all three timestamps.

## Reduced-motion freeze frame

Freeze with the **scan phase locked at row 0, a complete full-panel read**
(all 5 rows shown as if simultaneously lit, no partial mid-scan row
visible) at whatever value the meter had drifted to at freeze time — a
fully legible static readout with the PWM quantization bands still
visible, no scan banding artifact.

## Interaction

None required. If a pointer-scrub-to-set-value affordance is added, the
scrub handle may use `--ns-accent`; the LED brightness/duty-cycle mapping
itself must never mix in accent — luminance (grayscale value against the
background/foreground tokens) only.

## Light vs dark theme

An "on" LED is a graded `--foreground` brightness (per PWM band) against
an "off" LED sitting at `--background`. Light theme is the harder case:
confirm the lowest PWM band (band 1 of 8) is still distinguishable from
background — it will be the faintest "on" pixel in the panel and is the
one most likely to disappear against a near-white background. Add a
minimum-opacity floor for the lowest band if needed rather than letting it
round to invisible.

## Kill criteria

- If the 8-step PWM quantization is imperceptible and reads as a smooth
  analog gradient, the component has lost its identity — reject or
  increase step contrast.
- If the row-scan structure (the banding from scanning one row at a time)
  is never visible at any point in the loop — i.e., it always looks like a
  simultaneously-lit static panel — reject; the scan has to be legible at
  least transiently, not purely theoretical in the implementation.
