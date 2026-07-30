// GENERATED OUTPUT — writes public/posters/<name>-<theme>.png
//
// A featured card is a live 1440x900 iframe that the parent CSS-scales to a
// ~380px thumbnail. Measured: with those iframes rendered the homepage blocks
// the main thread ~5-6s per 10s indefinitely; with them not rendered at all it
// measures 0ms. Each one also re-downloads the whole Next runtime, React, the
// stylesheet and the fonts into its own document.
//
// So the rail shows a still until you point at it, and the still is the
// screenshot the quality gate already produces for every component — no new
// artwork, no new source of truth to drift. `next/image` re-encodes these to
// AVIF/WebP at the card's real width on request, so the ~120KB PNG on disk is
// not what ships.
//
// Only FEATURED components are copied. Catalog cards below the fold never mount
// an iframe in the first place (measured), so posters would buy nothing there
// and would put all 444 screenshots (97MB) into the deploy.
import { copyFileSync, mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "posters");
const THEMES = ["light", "dark"] as const;

/** Read FEATURED without importing TS — this runs as plain node. */
function featuredNames(): string[] {
  const src = readFileSync(path.join(ROOT, "lib", "featured.ts"), "utf8");
  const body = src.slice(src.indexOf("FEATURED"));
  return [...body.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

function findScreenshot(name: string, theme: string): string | null {
  for (const collection of ["core", "loud"]) {
    const p = path.join(ROOT, "registry", collection, name, "screenshots", `${theme}-default.png`);
    if (existsSync(p)) return p;
  }
  return null;
}

// Rebuilt from scratch each time so a slug dropped from FEATURED does not leave
// a stale poster shipping forever.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let copied = 0;
const missing: string[] = [];
for (const name of featuredNames()) {
  for (const theme of THEMES) {
    const src = findScreenshot(name, theme);
    if (!src) {
      missing.push(`${name}/${theme}`);
      continue;
    }
    copyFileSync(src, path.join(OUT, `${name}-${theme}.png`));
    copied++;
  }
}

// A missing screenshot is not fatal: the card falls back to the placeholder and
// still goes live on hover, exactly as it did before posters existed.
console.log(`posters: ${copied} file(s)${missing.length ? `, ${missing.length} missing (${missing.slice(0, 3).join(", ")}…)` : ""}`);
