"use client";

import { FringeShift } from "./component";

// Two synthetic dashboard "screenshots" — deterministic inline SVG, zero
// external assets — identical except three small, realistic regressions:
// the save button moved 2px down and its label grew, and a badge count
// ticked over. That's exactly the small-drift case a side-by-side or a 50%
// onion-skin misses and the fringe field rings loudly on.
function screenshotSrc(variant: "before" | "after"): string {
  const dy = variant === "after" ? 2 : 0;
  const label = variant === "after" ? "Save changes" : "Save";
  const btnWidth = variant === "after" ? 104 : 72;
  const badge = variant === "after" ? "13" : "12";
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
  <rect width="640" height="400" fill="#f4f4f4"/>
  <rect x="0" y="0" width="640" height="56" fill="#ffffff"/>
  <rect x="0" y="55" width="640" height="1" fill="#e2e2e2"/>
  <text x="24" y="34" font-family="ui-sans-serif, system-ui" font-size="16" font-weight="600" fill="#1a1a1a">Project dashboard</text>
  <rect x="${472 - (btnWidth - 72)}" y="${14 + dy}" width="${btnWidth}" height="28" rx="6" fill="#2f6fed"/>
  <text x="${472 - (btnWidth - 72) + 14}" y="${33 + dy}" font-family="ui-sans-serif, system-ui" font-size="12" fill="#ffffff">${label}</text>
  <circle cx="600" cy="28" r="9" fill="#1a1a1a"/>
  <text x="600" y="32" font-family="ui-sans-serif, system-ui" font-size="10" fill="#ffffff" text-anchor="middle">${badge}</text>
  <rect x="24" y="88" width="280" height="120" rx="12" fill="#ffffff" stroke="#e2e2e2"/>
  <text x="44" y="118" font-family="ui-sans-serif, system-ui" font-size="12" fill="#6f6f6f">Active users</text>
  <text x="44" y="152" font-family="ui-sans-serif, system-ui" font-size="28" font-weight="600" fill="#1a1a1a">4,821</text>
  <rect x="320" y="88" width="296" height="120" rx="12" fill="#ffffff" stroke="#e2e2e2"/>
  <text x="340" y="118" font-family="ui-sans-serif, system-ui" font-size="12" fill="#6f6f6f">Conversion</text>
  <text x="340" y="152" font-family="ui-sans-serif, system-ui" font-size="28" font-weight="600" fill="#1a1a1a">3.8%</text>
  <rect x="24" y="228" width="592" height="148" rx="12" fill="#ffffff" stroke="#e2e2e2"/>
  <text x="44" y="256" font-family="ui-sans-serif, system-ui" font-size="12" fill="#6f6f6f">Weekly signups</text>
  ${[38, 61, 47, 72, 55, 80, 64]
    .map((h, i) => {
      const x = 44 + i * 78;
      const barH = h * 1.1;
      return `<rect x="${x}" y="${360 - barH}" width="46" height="${barH}" rx="4" fill="#c9c9c9"/>`;
    })
    .join("\n  ")}
</svg>`.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function FringeShiftDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-24 text-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ns-muted">
          ns-ui / fringe-shift
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Sameness costs zero attention
        </h1>
        <p className="max-w-lg text-sm text-ns-muted">
          Two builds of the same screen, blended by optical difference and
          amplified into contour fringes. Nothing moves? The field stays
          dark. Drag Phase to compensate a real sub-pixel shift, or click the
          field to inspect both sources at a point.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <FringeShift
          before={{
            src: screenshotSrc("before"),
            alt: "Dashboard screenshot, build A: header with a 72px Save button and a badge reading 12.",
            label: "Build A",
          }}
          after={{
            src: screenshotSrc("after"),
            alt: "Dashboard screenshot, build B: header with a 104px Save changes button shifted 2px down and a badge reading 13.",
            label: "Build B",
          }}
          changes={[
            'Save button shifted 2px down',
            'Save button label changed from "Save" to "Save changes"',
            "Notification badge count changed from 12 to 13",
          ]}
          changedPercent={1.4}
        />
      </div>
    </main>
  );
}
