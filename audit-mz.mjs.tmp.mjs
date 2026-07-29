import { chromium } from "playwright";
import sharp from "sharp";
import fs from "fs";

const BASE = "http://localhost:3100";

const core = `magnetic-dock margin-cite mat-crop meniscus-hold meniscus-meter mercury-minimap moire-dial mortise-slip needle-stepper nib-check oxbow-turn packet-trace particle-hero particle-tunnel-scrub patina-ledger patina-pip pawl-click pawl-lift pawl-tick pencil-hedge penumbra-tip phase-swing pin-tumbler plimsoll-gauge plumb-sway points-throw proof-rise punch-list quick-key ration-rule redline-parley reed-vu relay-lane respire-field retract-ink ridge-walk riffle-edge ripple-unfold rule-sparkline sash-cord sash-weight scan-sweep-stats scissor-reach scroll-caliper scroll-island seam-diff sediment-stack selvage-fold shadow-board shear-band shelf-cant shim-fit shingle-course short-fuse shunt-tray sieve-facets signal-terrain siphon-lift slack-rail slide-to-shatter slip-cast solargraph-hero solari-flap solder-bridge sounding-rail span-tape spine-stack sprocket-scrub stake-line stem-sift stipple-year strandline tackle-board tally-notch taproot-trace tear-stub tear-tab terminator-date-field thinking-glyph tide-gauge-password topple-run torsion-wind tremor-trace trestle-gap tumbler-gate umbra-toggle under-ink undertow-drift updraft-dropzone vacuum-seal vanish-taper vapor-countdown vernier-slip warp-lattice wet-ink wick-run wind-spool wire-feed worn-path`.split(/\s+/);

const loud = `mesh-text-drag pen-lag periscope-sweep plumb-true pressure-front prism-drag-split quoin-lock scree-pour seed-crystal signet-drop singularity-text spark-gap stitch-pick vortex-street`.split(/\s+/);

const items = [...core.map(n => ({ n, c: "core" })), ...loud.map(n => ({ n, c: "loud" }))];

const OUT = "/private/tmp/claude-503/-Users-nikolassapalidis/5683baee-68ff-429a-89ee-b918c2bd66ab/scratchpad";
fs.mkdirSync(`${OUT}/shots`, { recursive: true });

async function checkOne(page, name, theme) {
  const consoleMsgs = [];
  const pageErrors = [];
  const failedReqs = [];
  const onConsole = (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
    }
  };
  const onPageError = (err) => pageErrors.push(String(err));
  const onReqFailed = (req) => failedReqs.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  const onResp = (resp) => {
    if (resp.status() >= 400) failedReqs.push(`${resp.status()} ${resp.url()}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onReqFailed);
  page.on("response", onResp);

  await page.addInitScript((t) => {
    try { localStorage.setItem("ns-ui-theme", t); } catch {}
  }, theme);

  let navError = null;
  try {
    await page.goto(`${BASE}/preview/${name}`, { waitUntil: "networkidle", timeout: 20000 });
  } catch (e) {
    navError = String(e);
  }
  await page.waitForTimeout(600);

  let bbox = null;
  let variance = null;
  try {
    const shotPath = `${OUT}/shots/${name}-${theme}.png`;
    await page.screenshot({ path: shotPath });
    const img = sharp(shotPath);
    const { data, info } = await img.resize(64, 64, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
    // compute stddev across pixels as a blank-detector
    let sum = 0, sumSq = 0, n = data.length;
    for (let i = 0; i < n; i++) { sum += data[i]; sumSq += data[i] * data[i]; }
    const mean = sum / n;
    variance = Math.sqrt(sumSq / n - mean * mean);
  } catch (e) {
    variance = `ERR:${e}`;
  }

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("requestfailed", onReqFailed);
  page.off("response", onResp);

  return { name, theme, navError, consoleMsgs, pageErrors, failedReqs, variance };
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const { n, c } of items) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
    const page = await context.newPage();
    const light = await checkOne(page, n, "light");
    const dark = await checkOne(page, n, "dark");
    results.push({ name: n, collection: c, light, dark });
    await context.close();
    process.stdout.write(`.`);
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  console.log("\ndone");
})();
