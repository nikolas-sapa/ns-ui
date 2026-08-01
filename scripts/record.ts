// Records a component preview as an X-ready MP4. Drives a generic interaction
// pass (pointer sweep + gate open) so pointer-driven components actually move,
// then trims the load/settle head and transcodes to H.264.
// Requires the dev server running (BASE_URL) and ffmpeg on PATH.
// Usage: node scripts/record.ts [component-name ...]
//        node scripts/record.ts --collection loud
//        DURATION=15 node scripts/record.ts button-glass
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = join(ROOT, "recordings");
const RAW_DIR = join(OUT_DIR, ".raw");
// 1280x720: 16:9, the aspect X gives the most timeline height to.
const SIZE = { width: 1280, height: 720 };
const DURATION = Number(process.env.DURATION ?? 12); // seconds of final video
const SETTLE = Number(process.env.SETTLE ?? 2); // seconds trimmed off the front

type Item = { name: string };
type Meta = { gate?: { openBy?: string; expect?: string } };

// registry.json items carry no `collection` field — it is the folder they live
// in, same as verify.ts resolves it.
function componentDir(name: string): string {
  for (const c of ["core", "loud"]) {
    const dir = join(ROOT, "registry", c, name);
    if (existsSync(dir)) return dir;
  }
  throw new Error(`no registry folder found for ${name}`);
}

function collectionOf(name: string): string {
  return existsSync(join(ROOT, "registry", "loud", name)) ? "loud" : "core";
}

const registry = JSON.parse(readFileSync(join(ROOT, "registry.json"), "utf8"));
const argv = process.argv.slice(2);
const collectionFlag = argv.indexOf("--collection");
const collection = collectionFlag !== -1 ? argv[collectionFlag + 1] : undefined;
// guard the -1 case: without --collection there is no value index to skip, and
// `collectionFlag + 1 === 0` would silently swallow the first component name
// (which is how a one-component test run recorded all 170).
const valueIndex = collectionFlag === -1 ? -1 : collectionFlag + 1;
const names = argv.filter((a, i) => !a.startsWith("--") && i !== valueIndex);

const items: Item[] = registry.items.filter((i: Item) => {
  if (names.length) return names.includes(i.name);
  if (collection) return collectionOf(i.name) === collection;
  return true;
});

if (!items.length) {
  console.error(`no components matched (names: ${names.join(", ") || "-"}, collection: ${collection ?? "-"})`);
  process.exit(1);
}

function readMeta(name: string): Meta {
  const p = join(componentDir(name), "meta.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
}

// Generic motion pass: a slow diagonal sweep across the frame, so hover states,
// cursor-tracking canvases and magnetic/parallax effects all fire without any
// per-component choreography. If a component declares a gate in meta.json, its
// characteristic state gets opened partway through.
// ponytail: one motion path for all 170. Add a `record` block to meta.json if a
// specific component ever needs bespoke choreography.
async function perform(page: import("playwright").Page, meta: Meta, ms: number) {
  const steps = Math.floor(ms / 100);
  const gateAt = Math.floor(steps * 0.45);
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    // lissajous-ish sweep: covers the frame without retracing the same line
    const x = SIZE.width * (0.5 + 0.35 * Math.sin(t * Math.PI * 2));
    const y = SIZE.height * (0.5 + 0.3 * Math.sin(t * Math.PI * 4));
    await page.mouse.move(x, y);
    if (i === gateAt && meta.gate?.openBy) {
      const opener = page.locator(meta.gate.openBy).first();
      if (await opener.count()) await opener.click({ timeout: 3000 }).catch(() => {});
    }
    await page.waitForTimeout(100);
  }
}

function transcode(webm: string, mp4: string) {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-ss", String(SETTLE), // drop the blank/loading head so frame 1 is the thumbnail
      "-i", webm,
      "-t", String(DURATION),
      "-vf", `scale=${SIZE.width}:${SIZE.height}:flags=lanczos,fps=30`,
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "20",
      "-pix_fmt", "yuv420p", // required or X/iOS refuses to decode
      "-movflags", "+faststart",
      "-an",
      mp4,
    ],
    { stdio: "pipe" }
  );
}

mkdirSync(OUT_DIR, { recursive: true });
rmSync(RAW_DIR, { recursive: true, force: true });
mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch();
const failures: string[] = [];

for (const item of items) {
  const { name } = item;
  console.log(`recording ${name}`);
  const context = await browser.newContext({
    viewport: SIZE,
    colorScheme: "dark",
    recordVideo: { dir: RAW_DIR, size: SIZE },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  try {
    await page.goto(`${BASE_URL}/preview/${name}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.mouse.move(0, 0);
    await page.waitForTimeout(SETTLE * 1000);
    await perform(page, readMeta(name), DURATION * 1000);
  } catch (err) {
    failures.push(`${name}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }

  // the .webm is only flushed to disk once the context closes
  await context.close();

  const webm = readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => join(RAW_DIR, f))[0];
  if (!webm) {
    failures.push(`${name}: playwright wrote no video`);
    continue;
  }
  const mp4 = join(OUT_DIR, `${name}.mp4`);
  try {
    transcode(webm, mp4);
    console.log(`  -> recordings/${name}.mp4`);
  } catch (err) {
    failures.push(`${name}: ffmpeg failed — ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
  rmSync(webm, { force: true });

  if (consoleErrors.length) {
    // not fatal: the clip may still be usable, but a console error usually means
    // the component half-rendered, so it needs a human look before posting
    console.warn(`  ! console errors during ${name}: ${consoleErrors.slice(0, 2).join(" | ")}`);
  }
}

await browser.close();
rmSync(RAW_DIR, { recursive: true, force: true });

if (failures.length) {
  console.error(`\nrecord FAILED: ${failures.length} problem(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nrecorded ${items.length} clip(s) to recordings/`);
