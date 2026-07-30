// GENERATED OUTPUT — writes public/previews/<name>.mp4
//
// A short, silent, looping recording of each FEATURED component, used as the
// card's resting state.
//
// Why this exists: the featured rail used to run each component live, in a
// 1440x900 iframe CSS-scaled to a ~380px card. Measured, same build and machine,
// back to back: with those iframes rendered the homepage blocked the main thread
// ~5.3s per 10s indefinitely on an idle page; with them not rendered, 23ms. Each
// component measures 0ms alone at a full viewport, so it was never the
// components — a continuously repainting document being composited at 26% is
// expensive whatever is inside it, and each frame re-downloaded the Next
// runtime, React, the stylesheet and the fonts into its own document.
//
// A still image fixed the cost but made the rail look dead, which is worse: the
// whole point of the page is that these things move. A video loop moves, and
// video decode is GPU work that does not touch the main thread — so the card
// looks live and costs nothing to speak of.
//
// Recorded from `/preview/<name>/embed`, which already drives the autoplay
// descriptor, so pointer-driven components demonstrate themselves rather than
// sitting still. Requires a server on BASE_URL and ffmpeg on PATH.
//
// Usage: node scripts/build-previews.ts [name ...]
//        BASE_URL=http://localhost:3000 node scripts/build-previews.ts
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync, readFileSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3111";
const OUT = path.join(ROOT, "public", "previews");
const RAW = path.join(OUT, ".raw");

// 16:10 to match the card's aspect box exactly, so nothing is cropped or
// letterboxed when it is scaled down.
const SIZE = { width: 1280, height: 800 };
/** Seconds of finished loop. Long enough not to read as a stutter, short
 *  enough to stay small — measured ~72KB at these settings. */
const LOOP = Number(process.env.LOOP ?? 6);
/** Trimmed off the front: mount, fonts, first paint, and the autoplay driver's
 *  own start delay, none of which belong in a loop. */
const SETTLE = Number(process.env.SETTLE ?? 2.5);
/** 24fps is plenty for a thumbnail and meaningfully smaller than 30. */
const FPS = 24;
/** CRF 30 at 640w: visually clean at the ~380px the card displays. */
const CRF = 30;
const WIDTH = 640;

function featuredNames(): string[] {
  const src = readFileSync(path.join(ROOT, "lib", "featured.ts"), "utf8");
  return [...src.slice(src.indexOf("FEATURED")).matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

const only = process.argv.slice(2);
const names = only.length ? only : featuredNames();

mkdirSync(OUT, { recursive: true });
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const browser = await chromium.launch();
let done = 0;
const failed: string[] = [];

for (const name of names) {
  const stage = path.join(RAW, name);
  mkdirSync(stage, { recursive: true });
  try {
    const ctx = await browser.newContext({
      viewport: SIZE,
      recordVideo: { dir: stage, size: SIZE },
      // Recording the light theme: the card shows the light poster/video in
      // light mode, and the dark variant is handled by the still behind it.
      // One video per component keeps the payload honest — a second theme would
      // double it for a surface that is in motion and rarely stared at.
      colorScheme: "light",
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/preview/${name}/embed`, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout((SETTLE + LOOP + 0.5) * 1000);
    await ctx.close(); // flushes the webm

    const raw = readdirSync(stage).find((f) => f.endsWith(".webm"));
    if (!raw) throw new Error("no video produced");

    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error",
       "-ss", String(SETTLE), "-i", path.join(stage, raw), "-t", String(LOOP),
       "-vf", `scale=${WIDTH}:-2,fps=${FPS}`,
       "-c:v", "libx264", "-crf", String(CRF), "-preset", "veryfast",
       "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
       path.join(OUT, `${name}.mp4`)],
      { stdio: "pipe" },
    );
    done++;
  } catch (e) {
    failed.push(name);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  if (done % 6 === 0) console.log(`previews: ${done}/${names.length}`);
}

await browser.close();
rmSync(RAW, { recursive: true, force: true });
console.log(`previews: ${done} written${failed.length ? `, ${failed.length} failed (${failed.slice(0, 4).join(", ")})` : ""}`);
