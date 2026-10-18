// Measure `symmetric-everything` as one number: the share of section headings
// whose rendered text sits centred on the page axis.
//
// The corpus already decided the signal on "alignment counts" (edotenv,
// tsenta, deepmark, standard-machines), but raters read it two ways where the
// two come apart: `text-align: center` on headings, or blocks placed on the
// axis. This measures what the eye sees, which settles both: each line box of
// the heading's own text, centred on the axis within tolerance. A heading
// centred by flex with `text-align: start` counts (sakura-name-sparkle's
// card); a left-aligned heading inside one of two equal columns does not
// (toolsapp-work, glowcase).
//
// HEADINGS: visible h1 and h2 outside nav, footer and dialogs. NOT outside
// <header>: heroku-2014 sets its hero and both mirrored panels inside one. A
// consent dialog's heading is not a section. When a page has
// fewer than two, the largest lettered text nodes stand in (at least 1.5x the
// body size), and `basis` says so. A heading spanning over 90% of the viewport
// is centred by construction and is skipped.
//
// Usage: node symmetry.cjs <slug>@@<url> [...]   (one JSON line per page)
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  for (const pair of process.argv.slice(2)) {
    const i = pair.indexOf('@@');
    const slug = pair.slice(0, i);
    const url = pair.slice(i + 2);
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await p.waitForTimeout(9000);
      const h = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < h; y += 1200) {
        await p.evaluate((v) => window.scrollTo(0, v), y);
        await p.waitForTimeout(250);
      }
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(1200);
      const r = await p.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const axis = W / 2;
        const tol = Math.max(16, W * 0.02);
        const body = parseFloat(getComputedStyle(document.body).fontSize);
        const shown = (e) => {
          const c = getComputedStyle(e);
          return c.display !== 'none' && c.visibility !== 'hidden' && e.getClientRects().length > 0;
        };
        const chrome = (e) => !!e.closest('nav, footer, dialog, [role=navigation], [role=contentinfo], [role=dialog], [aria-modal=true]');
        const lines = (e) => {
          const rg = document.createRange();
          rg.selectNodeContents(e);
          return [...rg.getClientRects()].filter((q) => q.width > 4 && q.height > 4);
        };
        const lettered = (e) => /\p{L}/u.test(e.textContent || '');
        let basis = 'h1-h2';
        let cand = [...document.querySelectorAll('h1, h2')].filter((e) => shown(e) && !chrome(e) && lettered(e));
        if (cand.length < 2) {
          basis = 'display-text';
          cand = [...document.querySelectorAll('body *')].filter((e) => {
            if (!shown(e) || chrome(e)) return false;
            const own = [...e.childNodes].some((n) => n.nodeType === 3 && /\p{L}/u.test(n.textContent));
            return own && parseFloat(getComputedStyle(e).fontSize) >= body * 1.5;
          });
        }
        const out = [];
        for (const e of cand) {
          // Merge fragments on one baseline into a line, so a heading set in
          // several spans reads as the line it is.
          const rows = [];
          for (const q of lines(e)) {
            const row = rows.find((w) => Math.abs(w.top - q.top) < q.height / 2);
            if (row) { row.l = Math.min(row.l, q.left); row.r = Math.max(row.r, q.right); }
            else rows.push({ top: q.top, l: q.left, r: q.right });
          }
          if (!rows.length) continue;
          const span = Math.max(...rows.map((w) => w.r)) - Math.min(...rows.map((w) => w.l));
          if (span > W * 0.9) continue;
          const centred = rows.every((w) => Math.abs((w.l + w.r) / 2 - axis) <= tol);
          out.push({ t: (e.textContent || '').trim().slice(0, 40), centred });
        }
        const n = out.length;
        const c = out.filter((o) => o.centred).length;
        return { basis, n, centred: c, share: n ? Math.round((c / n) * 100) / 100 : null, headings: out };
      });
      console.log(JSON.stringify({ slug, url, ok: true, ...r }));
    } catch (e) {
      console.log(JSON.stringify({ slug, url, ok: false, err: String(e.message).slice(0, 90) }));
    }
    await p.close();
  }
  await b.close();
})();
