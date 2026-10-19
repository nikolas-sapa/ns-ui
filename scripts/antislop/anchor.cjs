// Measure `single-optical-anchor` as one number: in the first viewport, the
// visual weight of the heaviest mass divided by the next.
//
// The procedure is the one provenmetal's third blind rater wrote down and
// re-ran by hand (content/evidence/provenmetal.md): first viewport only,
// 1440x900 at scroll 0; each mass weighed by luminance ink, the sum over its
// box of |Y - background|, with Y = 0.2126R + 0.7152G + 0.0722B and the
// background the median Y of the whole viewport; a mass dominates at 2x or
// more of the next. Stated before this script was run on the corpus.
//
// MASSES: display text (an element with its own letters at 1.5x body size or
// more) and media (img, picture, video, canvas, svg, iframe, or a url()
// background) of 1% of the viewport or more, outside nav and the Wayback
// toolbar. Media covering 60% of the viewport or more is the field, not a
// mass. Display text is weighed per heading or paragraph, so a headline set
// in several spans is one mass. A mass wholly inside another mass is dropped, so a heading inside a
// framed media block is not counted twice. With one mass the ratio is
// reported as null and `only: true`: it dominates because it is alone, the
// caveat every rater wrote for that case.
//
// Usage: node anchor.cjs <slug>@@<url> [...]   (one JSON line per page)
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
      await p.waitForTimeout(Number(process.env.NS_LOAD_MS) || 9000);
      await p.evaluate(() => {
        document.querySelectorAll('#wm-ipp-base, #wm-ipp, #donato, #wm-ipp-print').forEach((e) => e.remove());
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(800);
      const masses = await p.evaluate(() => {
        const W = innerWidth, H = innerHeight, VA = W * H;
        const body = parseFloat(getComputedStyle(document.body).fontSize) || 16;
        const shown = (e) => {
          const c = getComputedStyle(e);
          return c.display !== 'none' && c.visibility !== 'hidden' && parseFloat(c.opacity) > 0.05;
        };
        const clip = (r) => {
          const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top);
          const x1 = Math.min(W, r.right), y1 = Math.min(H, r.bottom);
          return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1, a: (x1 - x0) * (y1 - y0) } : null;
        };
        const out = [];
        const units = new Set();
        for (const e0 of document.querySelectorAll('body *')) {
          let e = e0;
          if (e.closest('nav, [role=navigation]') || !shown(e)) continue;
          const tag = e.tagName;
          const own = [...e.childNodes].some((n) => n.nodeType === 3 && /\p{L}/u.test(n.textContent));
          const bgUrl = /url\(/.test(getComputedStyle(e).backgroundImage);
          let kind = null;
          if (own && parseFloat(getComputedStyle(e).fontSize) >= body * 1.5) {
            // One heading set in several spans is one mass: weigh the block.
            e = e.closest('h1, h2, h3, h4, h5, h6, p, blockquote') || e;
            if (units.has(e)) continue;
            units.add(e);
            kind = 'text';
          }
          else if (/^(IMG|PICTURE|VIDEO|CANVAS|SVG|IFRAME)$/i.test(tag) || bgUrl) kind = 'media';
          if (!kind) continue;
          // Text weight is its line boxes, not the block's full width.
          let box;
          if (kind === 'text') {
            const rg = document.createRange(); rg.selectNodeContents(e);
            const rs = [...rg.getClientRects()].filter((q) => q.width > 2 && q.height > 2);
            if (!rs.length) continue;
            box = clip({ left: Math.min(...rs.map((q) => q.left)), top: Math.min(...rs.map((q) => q.top)),
                         right: Math.max(...rs.map((q) => q.right)), bottom: Math.max(...rs.map((q) => q.bottom)) });
          } else box = clip(e.getBoundingClientRect());
          if (!box) continue;
          if (kind === 'media' && (box.a < VA * 0.01 || box.a >= VA * 0.6)) continue;
          out.push({ kind, tag: e.tagName, t: (e.textContent || e.getAttribute('alt') || '').trim().slice(0, 30), ...box });
        }
        const inside = (a, z) => a !== z && a.x0 >= z.x0 && a.y0 >= z.y0 && a.x1 <= z.x1 && a.y1 <= z.y1;
        return out.filter((a) => !out.some((z) => inside(a, z) && !(z.x0 === a.x0 && z.y0 === a.y0 && z.x1 === a.x1 && z.y1 === a.y1)));
      });
      const shot = (await p.screenshot({ type: 'png' })).toString('base64');
      // Decode on a blank page so the site's CSP cannot block the image.
      const q = await b.newPage({ viewport: { width: 1440, height: 900 } });
      const r = await q.evaluate(async ([b64, ms]) => {
        const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
        const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, img.width, img.height).data;
        const Y = new Float32Array(img.width * img.height);
        for (let k = 0; k < Y.length; k++) Y[k] = 0.2126 * d[4 * k] + 0.7152 * d[4 * k + 1] + 0.0722 * d[4 * k + 2];
        const hist = new Array(256).fill(0); for (const y of Y) hist[Math.min(255, y | 0)]++;
        let acc = 0, bg = 0; for (; bg < 256; bg++) { acc += hist[bg]; if (acc >= Y.length / 2) break; }
        const seen = new Set();
        const weigh = (m) => {
          let s = 0;
          for (let y = Math.floor(m.y0); y < Math.ceil(m.y1); y++)
            for (let x = Math.floor(m.x0); x < Math.ceil(m.x1); x++) s += Math.abs(Y[y * img.width + x] - bg);
          return Math.round(s / 1000);
        };
        const res = ms.map((m) => ({ ...m, ink: weigh(m) }))
          .filter((m) => { const k = `${Math.round(m.x0)},${Math.round(m.y0)},${Math.round(m.x1)},${Math.round(m.y1)}`; if (seen.has(k)) return false; seen.add(k); return true; })
          .sort((a, z) => z.ink - a.ink);
        return { bg, res };
      }, [shot, masses]);
      await q.close();
      const [m1, m2] = r.res;
      const ratio = m1 && m2 && m2.ink > 0 ? Math.round((m1.ink / m2.ink) * 100) / 100 : null;
      console.log(JSON.stringify({ slug, url, ok: true, bg: r.bg, n: r.res.length, ratio, only: r.res.length === 1,
        top: r.res.slice(0, 4).map((m) => ({ kind: m.kind, tag: m.tag, t: m.t, ink: m.ink })) }));
    } catch (e) {
      console.log(JSON.stringify({ slug, url, ok: false, err: String(e.message).slice(0, 90) }));
    }
    await p.close();
  }
  await b.close();
})();
