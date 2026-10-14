// Measure the two facts v4 changes 1 and 5 need, for files whose prose states
// neither. One pass per URL, no screenshots.
//
// RATIO DEFINITION, stated so a second rater can re-run it: largest visible
// text font-size divided by getComputedStyle(document.body).fontSize, both
// nominal px. That is the convention the corpus prose already uses
// ("63.4/16 = 3.96:1"). Nominal rather than cap-height because the two only
// diverge when display and body use different faces, and where they do the
// evidence states both -- see the v4 proposal, change 1.
//
// Top five sizes are reported, not just the max, so a stray oversized glyph
// (a stat figure, a decorative numeral) is visible rather than silently
// setting the ratio.
//
// Usage: node ladder.cjs <slug>@@<url> [...]
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
      // Failure mode 3, which this script walked straight into on its first
      // run: documentElement.scrollHeight can report the viewport while the
      // content lives in a child element. grep.ai reported 900 against a real
      // 17890. Probe for it, and scroll the right container so lazy content
      // mounts before the ladder is read.
      const probe = await p.evaluate(() => {
        const docH = document.documentElement.scrollHeight;
        let best = null;
        document.querySelectorAll('*').forEach((e) => {
          if (e.clientHeight <= 300) return;
          if (e.scrollHeight <= e.clientHeight + 200) return;
          if (!best || e.scrollHeight > best) best = e.scrollHeight;
        });
        if (best && best > docH * 1.5 && best > 1500) {
          let hit = null;
          document.querySelectorAll('*').forEach((e) => {
            if (!hit && e.scrollHeight === best) { e.setAttribute('data-ns-l', '1'); hit = true; }
          });
          return { docH, inner: best, sel: hit ? '[data-ns-l]' : null };
        }
        return { docH, inner: null, sel: null };
      });
      const realH = probe.sel ? probe.inner : probe.docH;
      // Walk it so reveal-gated and lazily-mounted type is present in the ladder.
      for (let y = 0; y < realH; y += 1200) {
        await p.evaluate((a) => {
          if (a[0]) document.querySelector(a[0]).scrollTop = a[1];
          else window.scrollTo(0, a[1]);
        }, [probe.sel, y]);
        await p.waitForTimeout(250);
      }
      await p.waitForTimeout(1200);
      const r = await p.evaluate(() => {
        const body = parseFloat(getComputedStyle(document.body).fontSize);
        const nodes = [];
        document.querySelectorAll('*').forEach((e) => {
          const direct = [...e.childNodes]
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim()).join(' ').trim();
          if (direct.length < 3) return;
          const c = getComputedStyle(e);
          if (c.visibility === 'hidden' || c.display === 'none') return;
          if (parseFloat(c.opacity) < 0.1) return;
          const bb = e.getBoundingClientRect();
          if (bb.width < 20 || bb.height < 6) return;
          // The display term must be PROSE. grep.ai's two largest nodes are
          // "$ 2.89" and "$ 0.25" -- price figures in a pricing comparison, not
          // a headline -- which set a 4.0 ratio on a page whose headline is
          // smaller. A stat figure set large is a different decision from a
          // display headline and the corpus convention compares headlines.
          const words = direct.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w));
          const isProse = words.length >= 2;
          nodes.push({
            fs: Math.round(parseFloat(c.fontSize) * 10) / 10,
            ff: c.fontFamily.split(',')[0].replace(/["']/g, ''),
            t: direct.slice(0, 38), prose: isProse,
          });
        });
        nodes.sort((a, z) => z.fs - a.fs);
        const prose = nodes.filter((n) => n.prose);
        const big = [...new Set(nodes.filter((n) => n.fs >= 26).map((n) => n.ff))];
        const small = [...new Set(nodes.filter((n) => n.fs <= 18).map((n) => n.ff))];
        return {
          docH: document.documentElement.scrollHeight,
          bodyFs: body,
          top: nodes.slice(0, 5),
          topProse: prose.slice(0, 3),
          nodeCount: nodes.length,
          bigFamilies: big, smallFamilies: small,
        };
      });
      const maxFs = r.topProse.length ? r.topProse[0].fs : (r.top.length ? r.top[0].fs : 0);
      const rawMax = r.top.length ? r.top[0].fs : 0;
      const ratio = r.bodyFs ? +(maxFs / r.bodyFs).toFixed(2) : null;
      console.log(JSON.stringify({
        slug, url, ok: true, ratio, maxFs, rawMax,
        realH, innerScroller: probe.sel ? probe.inner : null, ...r,
      }));
    } catch (e) {
      console.log(JSON.stringify({ slug, url, ok: false, err: String(e.message).slice(0, 90) }));
    }
    await p.close();
    await new Promise((s) => setTimeout(s, 1500));
  }
  await b.close();
})();
