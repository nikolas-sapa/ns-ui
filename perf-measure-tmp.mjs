import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const BASE = process.env.BASE_URL || 'http://localhost:3412';
const load = () => execSync('uptime').toString().trim().split('load averages:')[1].trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)] ?? null; };
const slugOf = (u) => (u.match(/\/preview\/([^/]+)\/embed/) || [])[1] || null;
const pframes = (page) => page.frames().filter(f => slugOf(f.url()));

const INSTRUMENT = `(() => {
  if (window.__perfInstr) return 'already';
  window.__perfInstr = true; window.__rafCount = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = c => orig(ts => { window.__rafCount++; return c(ts); });
  window.__ctxLost = 0; window.__ctxRestored = 0;
  for (const c of document.querySelectorAll('canvas')) {
    c.addEventListener('webglcontextlost', () => window.__ctxLost++, false);
    c.addEventListener('webglcontextrestored', () => window.__ctxRestored++, false);
  }
  return 'ok';
})()`;
const RESET = `(()=>{window.__rafCount=0;return 1})()`;
const SNAP = `(() => {
  const o = { raf: window.__rafCount ?? null, instr: !!window.__perfInstr,
    ctxLost: window.__ctxLost ?? null, ctxRestored: window.__ctxRestored ?? null,
    vis: document.visibilityState, dpr: devicePixelRatio,
    innerW: innerWidth, innerH: innerHeight, cssAnim: null, canvases: [] };
  try { o.cssAnim = document.getAnimations().filter(a=>a.playState==='running').length; } catch(e){}
  for (const c of document.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect();
    let gl=null; try { gl = c.getContext('webgl2')||c.getContext('webgl'); } catch(e){}
    o.canvases.push({ bw:c.width, bh:c.height, cw:Math.round(r.width), ch:Math.round(r.height),
      gl: !!gl, lost: gl?gl.isContextLost():null });
  }
  return o;
})()`;
const BOXES = `(() => {
  const o={dpr:devicePixelRatio,vh:innerHeight,total:document.querySelectorAll('iframe').length,frames:[]};
  for (const f of document.querySelectorAll('iframe')) {
    const m=(f.getAttribute('src')||'').match(/\\/preview\\/([^/]+)\\/embed/);
    const r=f.getBoundingClientRect();
    o.frames.push({slug:m?m[1]:null, onScreen:r.bottom>0&&r.top<innerHeight,
      w:Math.round(r.width), h:Math.round(r.height)});
  }
  return o;
})()`;
const FD = (ms)=>`(()=>new Promise(res=>{const iv=[];let l=null;const t0=performance.now();
  (function t(ts){if(l!==null)iv.push(ts-l);l=ts;if(ts-t0<${ms})requestAnimationFrame(t);else res(iv)})
  (performance.now());}))()`;

async function evalAll(page, expr) {
  const out = new Map();
  await Promise.all(pframes(page).map(async f => {
    const s = slugOf(f.url());
    for (let a = 0; a < 3; a++) {
      try { out.set(s, await f.evaluate(expr)); return; } catch { await sleep(120); }
    }
    out.set(s, null);
  }));
  return out;
}
async function phase(page, label, ms) {
  for (const f of pframes(page)) { try { await f.evaluate(INSTRUMENT); } catch {} }
  await evalAll(page, RESET);
  await sleep(ms);
  const boxes = await page.evaluate(BOXES);
  const inner = await evalAll(page, SNAP);
  for (const b of boxes.frames) if (b.slug) b.inner = inner.get(b.slug) ?? null;
  return { label, windowMs: ms, loadAt: load(), ...boxes };
}

const results = { loadStart: load(), base: BASE, viewports: {} };
const browser = await chromium.launch({ headless: false });

for (const [label, vp] of Object.entries({
  '1440x900': { width: 1440, height: 900 },
  '2560x1080': { width: 2560, height: 1080 },
})) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  const R = { vp, dsf: 2, loadAt: load() };
  await page.goto(BASE + '/', { waitUntil: 'commit', timeout: 120000 });
  await sleep(30000);                                   // hydrate (slow at high load)
  await page.evaluate(`scrollTo(0, 1400)`);             // settle a stable mounted set
  await sleep(12000);

  R.steady   = await phase(page, 'steady (scrolled, mixed on/off-screen)', 4000);
  // CONTROL: tab hidden. If counts do not fall, the instrument is not measuring pause.
  const other = await ctx.newPage(); await other.goto('about:blank'); await other.bringToFront();
  R.tabHidden = await phase(page, 'tab hidden', 4000);
  await page.bringToFront(); await other.close(); await sleep(2500);
  R.restored = await phase(page, 'tab restored', 4000);

  const iv = await page.evaluate(FD(5000));
  R.frameDelivery = { n: iv.length, p50: pct(iv,.5), p90: pct(iv,.9), over20: iv.filter(x=>x>20).length, loadAt: load() };

  for (let i=0;i<18;i++){ await page.evaluate(`scrollBy(0, innerHeight)`); await sleep(450); }
  await sleep(3000);
  R.deepScroll = await phase(page, 'after deep scroll churn', 3000);

  R.loadEnd = load();
  results.viewports[label] = R;
  await ctx.close();
}
await browser.close();
results.loadEnd = load();
console.log(JSON.stringify(results, null, 2));
