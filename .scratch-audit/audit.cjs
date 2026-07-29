const { chromium } = require('playwright');
const fs = require('fs');

const slugs = process.argv[2].split(',');
const BASE = 'http://localhost:3100';

function pixelStats(buf) {
  // simple: sample decode not available without extra lib; use screenshot size heuristic instead
  return buf.length;
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const slug of slugs) {
    const entry = { slug, errors: [], warnings: [], lightBox: null, darkBox: null, notes: [] };
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', msg => {
      const t = msg.type();
      if (t === 'error') entry.errors.push(msg.text());
      else if (t === 'warning') entry.warnings.push(msg.text());
    });
    page.on('pageerror', err => entry.errors.push('PAGEERROR: ' + err.message));
    page.on('requestfailed', req => entry.errors.push('REQFAIL: ' + req.url() + ' ' + (req.failure()?.errorText||'')));

    try {
      await page.goto(`${BASE}/preview/${slug}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(600);
      const root = page.locator('body');
      const box = await root.boundingBox();
      entry.lightBox = box;

      // find demo root heuristically - first main or [class*=preview] or body child
      const demoBox = await page.evaluate(() => {
        const el = document.querySelector('main') || document.body;
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      entry.demoBoxLight = demoBox;

      // screenshot for uniform color check
      const shot1 = await page.screenshot();
      entry.shotLightSize = shot1.length;

      // generic interactions
      const vp = page.viewportSize();
      const cx = vp.width/2, cy = vp.height/2;
      await page.mouse.move(cx-100, cy);
      await page.mouse.move(cx+100, cy, { steps: 10 });
      await page.mouse.move(cx, cy);
      await page.waitForTimeout(150);
      try { await page.mouse.click(cx, cy, { timeout: 2000 }); } catch(e) {}
      await page.waitForTimeout(150);
      try {
        await page.mouse.move(cx-150, cy);
        await page.mouse.down();
        await page.mouse.move(cx+150, cy, { steps: 10 });
        await page.mouse.up();
      } catch(e) {}
      await page.waitForTimeout(150);
      try { await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); } catch(e) {}
      try { await page.keyboard.type('test123'); } catch(e) {}
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(400);

      const shot2 = await page.screenshot();
      entry.shotAfterInteractSize = shot2.length;
      entry.shotChanged = shot1.length !== shot2.length;

      // dark theme
      await page.evaluate(() => localStorage.setItem('ns-ui-theme', 'dark'));
      await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(600);
      const demoBoxDark = await page.evaluate(() => {
        const el = document.querySelector('main') || document.body;
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      entry.demoBoxDark = demoBoxDark;
      const shot3 = await page.screenshot();
      entry.shotDarkSize = shot3.length;

      // navigate away for cleanup check
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500);

    } catch (e) {
      entry.errors.push('NAV/SCRIPT ERROR: ' + e.message);
    }
    entry.errors = [...new Set(entry.errors)];
    entry.warnings = [...new Set(entry.warnings)].slice(0,5);
    results.push(entry);
    await context.close();
    process.stderr.write(`done ${slug}\n`);
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
