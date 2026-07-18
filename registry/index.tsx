import type { ComponentType } from "react";
import { lazy } from "react";

// One line per component. Preview pages load demos from here.
export const demos: Record<string, ComponentType> = {
  "glass-button": lazy(() => import("./core/glass-button/demo")),
  "particle-hero": lazy(() => import("./core/particle-hero/demo")),
  "decrypt-text": lazy(() => import("./core/decrypt-text/demo")),
  "ascii-dither-media": lazy(() => import("./core/ascii-dither-media/demo")),
  "glass-panel": lazy(() => import("./core/glass-panel/demo")),
  "magnetic-dock": lazy(() => import("./core/magnetic-dock/demo")),
  "dynamic-weight-text": lazy(() => import("./core/dynamic-weight-text/demo")),
  "hold-to-confirm": lazy(() => import("./core/hold-to-confirm/demo")),
  "signal-terrain": lazy(() => import("./core/signal-terrain/demo")),
  "particle-tunnel-scrub": lazy(() => import("./core/particle-tunnel-scrub/demo")),
  "slide-to-shatter": lazy(() => import("./core/slide-to-shatter/demo")),
  "mercury-minimap": lazy(() => import("./core/mercury-minimap/demo")),
  "singularity-text": lazy(() => import("./loud/singularity-text/demo")),
  "prism-drag-split": lazy(() => import("./loud/prism-drag-split/demo")),
};
