import type { ComponentType } from "react";
import { lazy } from "react";

// One line per component. Preview pages load demos from here.
export const demos: Record<string, ComponentType> = {
  "glass-button": lazy(() => import("./core/glass-button/demo")),
};
