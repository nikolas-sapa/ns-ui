const { chromium } = require('playwright');
const sharp = require('sharp');

const slugs = process.argv[2].split(',');
const BASE = 'http://localhost:3100';

async function stats(buf) {
  const img = sharp(buf).resize(200, 200, { fit: 'fill' }).grayscale().raw();
  const { data } = await img.toBuffer({ resolveWithObject: true });
  let sum = 0, sumSq = 0;
  for (let i = 0; i < data.length; i++) { sum += data[i]; sumSq += data[i]*data[i]; }
  const n = data.length;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return { mean: +mean.toFixed(1), std: +Math.sqrt(Math.max(0,variance)).toFixed(1) };
}

async function diffCount(buf1, buf2) {
  const a = await sharp(buf1).resize(200,200,{fit:'fill'}).grayscale().raw().toBuffer();
  const b = await sharp(buf2).resize(200,200,{fit:'fill'}).grayscale().raw().toBuffer();
  let diff = 0;
  for (let i = 0; i < a.length; i++) { if (Math.abs(a[i]-b[i]) > 12) diff++; }
  return diff; // out of 40000 pixels
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const slug of slugs) {
    const entry = { slug, errors: [], warnings: [] };
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
      await page.waitForTimeout(700);

      const shotLight = await page.screenshot();
      entry.light = await stats(shotLight);

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
      await page.waitForTimeout(500);

      const shotAfter = await page.screenshot();
      entry.diffAfterInteract = await diffCount(shotLight, shotAfter);
      entry.afterInteract = await stats(shotAfter);

      // dark theme
      await page.evaluate(() => localStorage.setItem('ns-ui-theme', 'dark'));
      await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(700);
      const shotDark = await page.screenshot();
      entry.dark = await stats(shotDark);
      entry.diffLightDark = await diffCount(shotLight, shotDark);

      await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(400);

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
