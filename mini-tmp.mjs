import { chromium } from 'playwright';
for (const headless of [true, false]) {
  const t0 = Date.now();
  try {
    const b = await chromium.launch({ headless });
    const p = await b.newPage();
    await p.goto('http://localhost:3410/', { waitUntil: 'commit', timeout: 60000 });
    const title = await p.title();
    console.log(`headless=${headless} OK title="${title}" ${Date.now()-t0}ms`);
    await b.close();
  } catch (e) { console.log(`headless=${headless} FAIL ${Date.now()-t0}ms ${e.message.split('\n')[0]}`); }
}
