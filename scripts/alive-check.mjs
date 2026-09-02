// Alive-at-rest + reduced-motion stability check.
// The project gate does not test either: a component hard-coded to paused=true
// returns GATE: PASS. This measures what the gate assumes.
import { chromium } from "playwright";
import crypto from "node:crypto";

const BASE = process.env.BASE_URL || "http://localhost:3415";
const slugs = process.argv.slice(2);
const DSF = [1, 2];
const THEMES = ["light", "dark"];

// mean absolute per-channel difference between two PNG buffers, via raw pixels
async function frames(page, waitMs) {
  await page.waitForTimeout(waitMs);
  return await page.screenshot({ type: "png" });
}
function diff(a, b) {
  // compare byte streams; identical PNG bytes => identical frame
  return a.equals(b) ? 0 : 1;
}
function hash(b) { return crypto.createHash("sha1").update(b).digest("hex").slice(0, 12); }

const results = [];
const browser = await chromium.launch();
for (const slug of slugs) {
  for (const dsf of DSF) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({
        viewport: { width: 720, height: 480 },
        deviceScaleFactor: dsf,
        colorScheme: theme,
      });
      const page = await ctx.newPage();
      const url = `${BASE}/preview/${slug}/embed`;
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(5000); // demo chunk needs >1.6s to hydrate
        const f0 = await frames(page, 0);
        const f1 = await frames(page, 2500);
        const f2 = await frames(page, 2500);
        const alive = (diff(f0, f1) || diff(f1, f2) || diff(f0, f2)) ? "ALIVE" : "DEAD";
        results.push({ slug, dsf, theme, mode: "motion", verdict: alive,
                       h: [hash(f0), hash(f1), hash(f2)] });
      } catch (e) {
        results.push({ slug, dsf, theme, mode: "motion", verdict: "ERROR: " + e.message.split("\n")[0] });
      }
      await ctx.close();
    }
  }
  // reduced motion: frames must be byte-identical over time
  const ctx = await browser.newContext({
    viewport: { width: 720, height: 480 }, deviceScaleFactor: 2,
    colorScheme: "dark", reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/preview/${slug}/embed`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(5000);
    const r0 = await frames(page, 0);
    const r1 = await frames(page, 3000);
    results.push({ slug, dsf: 2, theme: "dark", mode: "reduced",
                   verdict: r0.equals(r1) ? "STABLE" : "DRIFTS", h: [hash(r0), hash(r1)] });
  } catch (e) {
    results.push({ slug, mode: "reduced", verdict: "ERROR: " + e.message.split("\n")[0] });
  }
  await ctx.close();
}
await browser.close();

const byslug = {};
for (const r of results) (byslug[r.slug] ||= []).push(r);
let bad = 0;
for (const [slug, rs] of Object.entries(byslug)) {
  const motion = rs.filter(r => r.mode === "motion");
  const dead = motion.filter(r => r.verdict === "DEAD");
  const err = rs.filter(r => String(r.verdict).startsWith("ERROR"));
  const red = rs.find(r => r.mode === "reduced");
  const problems = [];
  if (dead.length) problems.push(`DEAD in ${dead.map(d => `dsf${d.dsf}/${d.theme}`).join(",")}`);
  if (red && red.verdict === "DRIFTS") problems.push("reduced-motion DRIFTS");
  if (err.length) problems.push(err.map(e => e.verdict).join("; "));
  if (problems.length) bad++;
  console.log(`${problems.length ? "FAIL" : "ok  "} ${slug.padEnd(16)} ${problems.join(" | ") || "alive in 4/4 contexts, reduced-motion stable"}`);
}
console.log(`\n${Object.keys(byslug).length} components, ${bad} with problems`);
process.exit(bad ? 1 : 0);
