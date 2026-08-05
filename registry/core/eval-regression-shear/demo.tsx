"use client";

import { EvalDeltaTable, type EvalCase } from "./component";

// One nightly eval sweep: swe-bench-verified, 26 cases, scored 0..1 on both runs.

const CASES: EvalCase[] = [
  { id: "astropy-12907", baseline: 0.41, candidate: 0.6 },
  { id: "sympy-20590", baseline: 0.34, candidate: 0.47 },
  { id: "django-11039", baseline: 0.55, candidate: 0.63 },
  { id: "pytest-7373", baseline: 0.72, candidate: 0.75 },
  { id: "matplotlib-23913", baseline: 0.68, candidate: 0.68 },
  { id: "requests-2317", baseline: 0.81, candidate: 0.812 },
  { id: "sphinx-10325", baseline: 0.52, candidate: 0.52 },
  { id: "pylint-6506", baseline: 0.47, candidate: 0.469 },
  { id: "flask-5063", baseline: 0.9, candidate: 0.9 },
  { id: "seaborn-3010", baseline: 0.63, candidate: 0.632 },
  { id: "django-13401", baseline: 0.58, candidate: 0.58 },
  { id: "sympy-16988", baseline: 0.44, candidate: 0.443 },
  { id: "astropy-14365", baseline: 0.71, candidate: 0.71 },
  { id: "mwaskom-3187", baseline: 0.36, candidate: 0.359 },
  { id: "psf-black-2313", baseline: 0.66, candidate: 0.66 },
  { id: "django-15738", baseline: 0.74, candidate: 0.742 },
  { id: "scikit-25747", baseline: 0.5, candidate: 0.5 },
  { id: "sympy-18189", baseline: 0.61, candidate: 0.608 },
  { id: "pytest-11148", baseline: 0.43, candidate: 0.43 },
  { id: "matplotlib-25311", baseline: 0.57, candidate: 0.572 },
  { id: "requests-1963", baseline: 0.86, candidate: 0.86 },
  { id: "xarray-3364", baseline: 0.39, candidate: 0.388 },
  { id: "xarray-4094", baseline: 0.49, candidate: 0.45 },
  { id: "sphinx-8721", baseline: 0.38, candidate: 0.29 },
  { id: "scikit-13497", baseline: 0.44, candidate: 0.29 },
  { id: "django-16819", baseline: 0.6, candidate: 0.47 },
];

export default function EvalRegressionShearDemo() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-14">
      <div
        data-shear-panel
        className="w-full max-w-3xl rounded-md border border-border bg-background p-6"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border pb-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ns-muted">
              swe-bench-verified · run 2481
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Score delta by case
            </h2>
          </div>
          <p className="font-mono text-[11px] tabular-nums text-ns-muted">
            candidate 2.4.1-rc3 <span className="text-foreground">vs</span> baseline 2.3.0
          </p>
        </div>

        <EvalDeltaTable cases={CASES} label="swe-bench-verified cases, sorted by score delta" />

        <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-ns-muted">
          Bars right of zero are gains, bars left are regressions.
        </p>
      </div>
    </div>
  );
}
