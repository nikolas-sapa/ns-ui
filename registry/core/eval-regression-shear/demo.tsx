"use client";

import { ShearProfile, type ShearCase } from "./component";

// One nightly eval sweep: three suites, 64 cases, scored 0..1 on both runs.
// The shape of the data is the point — a handful of real gains at the top, a
// long quiet waist of cases that did not move at all, and a short regressed
// tail with three cases that crossed the pass threshold and now fail.

type Tuple = [id: string, baseline: number, candidate: number];

const SWE_BENCH: Tuple[] = [
  ["astropy-12907", 0.41, 0.6],
  ["sympy-20590", 0.34, 0.47],
  ["django-11039", 0.55, 0.63],
  ["pytest-7373", 0.72, 0.75],
  ["matplotlib-23913", 0.68, 0.68],
  ["requests-2317", 0.81, 0.812],
  ["sphinx-10325", 0.52, 0.52],
  ["pylint-6506", 0.47, 0.469],
  ["flask-5063", 0.9, 0.9],
  ["seaborn-3010", 0.63, 0.632],
  ["django-13401", 0.58, 0.58],
  ["sympy-16988", 0.44, 0.443],
  ["astropy-14365", 0.71, 0.71],
  ["mwaskom-3187", 0.36, 0.359],
  ["psf-black-2313", 0.66, 0.66],
  ["django-15738", 0.74, 0.742],
  ["scikit-25747", 0.5, 0.5],
  ["sympy-18189", 0.61, 0.608],
  ["pytest-11148", 0.43, 0.43],
  ["matplotlib-25311", 0.57, 0.572],
  ["requests-1963", 0.86, 0.86],
  ["xarray-3364", 0.39, 0.388],
  ["xarray-4094", 0.49, 0.45],
  ["sphinx-8721", 0.38, 0.29],
  ["scikit-13497", 0.44, 0.29],
  ["django-16819", 0.6, 0.47],
];

const TAU_BENCH: Tuple[] = [
  ["exchange-item-2f1", 0.44, 0.59],
  ["return-refund-b73", 0.51, 0.6],
  ["cancel-order-9c4", 0.66, 0.7],
  ["order-status-8dd", 0.93, 0.93],
  ["address-change-51e", 0.78, 0.782],
  ["track-parcel-9a3", 0.88, 0.88],
  ["resend-receipt-2b8", 0.95, 0.949],
  ["apply-coupon-0c7", 0.72, 0.72],
  ["subscribe-plan-7c2", 0.64, 0.642],
  ["update-payment-6e1", 0.7, 0.7],
  ["size-swap-8f5", 0.58, 0.578],
  ["close-ticket-1b4", 0.83, 0.83],
  ["bulk-order-7d9", 0.46, 0.462],
  ["verify-identity-5f8", 0.69, 0.69],
  ["split-shipment-5d4", 0.53, 0.528],
  ["warranty-claim-3a6", 0.61, 0.61],
  ["reship-damaged-2c3", 0.57, 0.572],
  ["escalate-agent-4b2", 0.75, 0.75],
  ["cancel-subscription-1e9", 0.67, 0.668],
  ["price-match-6ab", 0.33, 0.29],
  ["gift-card-3f0", 0.35, 0.23],
  ["refund-partial-4a1", 0.61, 0.42],
];

const GPQA: Tuple[] = [
  ["chem-0142", 0.47, 0.58],
  ["phys-0087", 0.62, 0.67],
  ["bio-0078", 0.54, 0.54],
  ["chem-0417", 0.39, 0.392],
  ["phys-0026", 0.71, 0.71],
  ["bio-0163", 0.66, 0.658],
  ["chem-0289", 0.48, 0.48],
  ["phys-0311", 0.59, 0.592],
  ["bio-0205", 0.43, 0.43],
  ["chem-0060", 0.75, 0.748],
  ["phys-0248", 0.52, 0.52],
  ["bio-0132", 0.64, 0.642],
  ["chem-0198", 0.36, 0.36],
  ["phys-0194", 0.68, 0.678],
  ["chem-0355", 0.29, 0.22],
  ["bio-0231", 0.58, 0.4],
];

function toCases(suite: string, rows: Tuple[]): ShearCase[] {
  return rows.map(([id, baseline, candidate]) => ({ id, suite, baseline, candidate }));
}

const CASES: ShearCase[] = [
  ...toCases("swe-bench-verified", SWE_BENCH),
  ...toCases("tau-bench-retail", TAU_BENCH),
  ...toCases("gpqa-diamond", GPQA),
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
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Nightly eval sweep · run 2481
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Regression shear
            </h2>
          </div>
          <p className="font-mono text-[11px] tabular-nums text-muted">
            candidate 2.4.1-rc3 <span className="text-foreground">vs</span> baseline 2.3.0
          </p>
        </div>

        <ShearProfile cases={CASES} />

        <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted">
          Each hairline is one case, anchored left and offset right by its score delta. Move the
          pointer down the stack — or Tab in and use the arrow keys — to fan the rows apart and read
          the cases under the caliper.
        </p>
      </div>
    </div>
  );
}
