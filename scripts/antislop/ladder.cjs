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
        const docOrder = [];
        const byKey = {};
        let seq = 0;
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
          // The display term must contain at least one LETTER. Requiring two
          // words was the first attempt and it was wrong in both directions:
          // it correctly excluded grep.ai's "$ 2.89" and "78.6" (price and
          // stat figures, which set a 4.0 ratio on a page whose headline is
          // smaller) but it also rejected anthropic.com's "Haiku 5.5", which
          // IS the display headline, dropping that page to a false 1.2:1.
          // One letter is the rule that separates a figure from a headline.
          // A letter in any script: ASCII-only skipped sakura-name-sparkle's
          // 96px kanji headline and read its 24px romaji, a false 1.5:1.
          const words = direct.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w));
          const isProse = /\p{L}/u.test(direct);
          const key = 'n' + (seq++);
          const rec = {
            fs: Math.round(parseFloat(c.fontSize) * 10) / 10,
            ff: c.fontFamily.split(',')[0].replace(/["']/g, ''),
            t: direct.slice(0, 38), prose: isProse, key,
          };
          nodes.push(rec);
          docOrder.push(key);
          byKey[key] = rec;
        });
        nodes.sort((a, z) => z.fs - a.fs);
        const prose = nodes.filter((n) => n.prose);
        // The SUBHEAD denominator. railway-com states both readings and scores
        // on this one: "54/20 = 2.7:1 against the hero subhead, 3.4:1 against
        // 16px body ... so type-scale-high-contrast is absent." Every
        // derivation-set disagreement under the body denominator is a file
        // that scored absent while measuring above the cut against body, which
        // says the raters' convention was the subhead all along.
        // Defined as: the first text node after the display node in document
        // order whose font-size is smaller than it. Document order, not DOM
        // sibling, because a hero headline and its subhead are rarely siblings.
        let subheadFs = null;
        if (prose.length) {
          const topFs = prose[0].fs;
          const after = docOrder.slice(docOrder.indexOf(prose[0].key) + 1);
          for (const k of after) {
            const n = byKey[k];
            if (n && n.fs < topFs - 0.5) { subheadFs = n.fs; break; }
          }
        }
        const big = [...new Set(nodes.filter((n) => n.fs >= 26).map((n) => n.ff))];
        const small = [...new Set(nodes.filter((n) => n.fs <= 18).map((n) => n.ff))];
        return {
          docH: document.documentElement.scrollHeight,
          bodyFs: body,
          subheadFs,
          top: nodes.slice(0, 5),
          topProse: prose.slice(0, 3),
          nodeCount: nodes.length,
          bigFamilies: big, smallFamilies: small,
        };
      });
      const maxFs = r.topProse.length ? r.topProse[0].fs : (r.top.length ? r.top[0].fs : 0);
      const rawMax = r.top.length ? r.top[0].fs : 0;
      const ratio = r.bodyFs ? +(maxFs / r.bodyFs).toFixed(2) : null;
      const ratioSub = r.subheadFs ? +(maxFs / r.subheadFs).toFixed(2) : null;
      console.log(JSON.stringify({
        slug, url, ok: true, ratio, ratioSub, maxFs, rawMax,
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
