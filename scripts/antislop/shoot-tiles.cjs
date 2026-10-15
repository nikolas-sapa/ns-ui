// Tile walker with an inner-scroll probe in front of it. Session 3 lost a rating
// to failure mode 3: documentElement.scrollHeight reported 900 while the real
// content sat in a child element at 17890, and viewport, --full-page and
// window.scrollTo all agreed on the wrong answer with no error.
// Tiles, not fullPage: failure mode 1 is an unpainted correct-dimension PNG.
// Usage: node shoot-tiles.cjs <slug> <url> <outdir>
const { chromium } = require('playwright');
const fs = require('fs');
const [, , slug, url, outdir] = process.argv;

const STEP = 700, SETTLE = 900, MAX = 60;

(async () => {
  fs.mkdirSync(outdir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await p.waitForTimeout(8000);

  // Pick the scroller: window unless a child element scrolls materially further.
  const probe = await p.evaluate(() => {
    const docH = document.documentElement.scrollHeight;
    const cands = [];
    document.querySelectorAll('*').forEach((e) => {
      if (e.clientHeight <= 300) return;
      if (e.scrollHeight <= e.clientHeight + 200) return;
      let n = e, s = [];
      while (n && n.tagName && s.length < 4) {
        const cls = n.className && typeof n.className === 'string'
          ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        s.unshift(n.tagName.toLowerCase() + cls);
        n = n.parentElement;
      }
      cands.push({ path: s.join('>'), sh: e.scrollHeight, ch: e.clientHeight });
    });
    cands.sort((a, z) => z.sh - a.sh);
    return { docH, cands: cands.slice(0, 5) };
  });

  // window wins unless an inner candidate exceeds docH by >1.5x — the deepmark shape.
  const inner = probe.cands.find((c) => c.sh > probe.docH * 1.5 && c.sh > 1500) || null;
  let sel = null;
  if (inner) {
    sel = await p.evaluate((want) => {
      let hit = null;
      document.querySelectorAll('*').forEach((e) => {
        if (hit) return;
        if (e.scrollHeight === want) { e.setAttribute('data-ns-scroller', '1'); hit = '[data-ns-scroller]'; }
      });
      return hit;
    }, inner.sh);
  }

  const height = sel ? inner.sh : probe.docH;
  let n = 0;
  // Read back where the scroll ACTUALLY landed, every step. A sticky /
  // overflow-hidden element can clamp window.scrollTo while being too short to
  // trip the inner-scroller probe above: subvocal.company's scroll-film pin is
  // 1142/900 = 1.27x, correctly rejected as a scroller, and it still pinned the
  // window at y7109 on a 13726px page. 12 of 20 tiles came back the same frame
  // and 48.2% of the page was never captured. Neither instrument errored.
  const landings = [];
  let stuck = 0;
  for (let y = 0; y < height && n < MAX; y += STEP) {
    if (sel) await p.evaluate((a) => { document.querySelector(a[0]).scrollTop = a[1]; }, [sel, y]);
    else await p.evaluate((yy) => window.scrollTo(0, yy), y);
    await p.waitForTimeout(SETTLE);
    const at = await p.evaluate((a) => (a ? document.querySelector(a).scrollTop : window.scrollY), sel);
    const maxScroll = Math.max(0, height - 900);
    const expected = Math.min(y, maxScroll);
    // >8px short of a reachable target means something is holding the scroll.
    if (at < expected - 8) {
      stuck++;
      if (stuck >= 2) {
        landings.push({ asked: y, landed: at, aborted: true });
        break;
      }
    } else {
      stuck = 0;
    }
    landings.push({ asked: y, landed: at });
    const tag = String(n).padStart(2, '0');
    await p.screenshot({ path: outdir + '/' + slug + '-' + tag + '.png', animations: 'disabled', timeout: 90000 });
    n++;
  }
  // Re-read after the walk: a reveal-gated page grows as it mounts.
  const after = await p.evaluate(() => document.documentElement.scrollHeight);
  const deepest = landings.reduce((m, l) => Math.max(m, l.landed), 0);
  const reached = deepest + 900;
  const clamped = reached < height - 50;
  const walk = {
    slug, docH_before: probe.docH, docH_after: after,
    scroller: sel || 'window', walkHeight: height, tiles: n,
    // CLAMPED means the capture is incomplete and the tiles lie. Do not stitch
    // or rate from it: re-walk with wheel events (p.mouse.wheel) instead.
    clamped, reachedPx: reached, coverage: +(reached / height).toFixed(3),
    innerCands: probe.cands,
  };
  // Persist beside the tiles. stitch.py reads walkHeight and `clamped` from
  // here, so a parallel rater never hand-edits a shared slug->height map --
  // 26 agents editing one dict is a merge conflict, not a measurement.
  fs.writeFileSync(outdir + '/walk.json', JSON.stringify(walk, null, 2));
  console.log(JSON.stringify(walk));
  if (clamped) console.error(`CLAMPED: reached ${reached}px of ${height}px (${Math.round(100 * reached / height)}%) — tiles are incomplete, re-walk with wheel events`);
  await b.close();
})();
