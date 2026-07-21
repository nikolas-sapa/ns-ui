import { chromium } from '/Users/nikolassapalidis/Developer/misc/ns-ui/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:900} });
// 1. plain preview page must have NO autoplay and still respond to real clicks
await p.goto('http://localhost:3000/preview/counterpoise-tiers', { waitUntil:'networkidle' });
await p.waitForTimeout(800);
const hasDriver = await p.evaluate(() => !!document.querySelector('[data-autoplay-root]'));
const before = await p.evaluate(() => document.querySelector('input[type=checkbox]').checked);
await p.locator('input[type=checkbox]').first().click({ force: true });
const after = await p.evaluate(() => document.querySelector('input[type=checkbox]').checked);
console.log('plain page: autoplayRoot=', hasDriver, '| real click toggles:', before !== after);
// 2. press mode on a <button> target (drape-menu) still works
await p.goto('http://localhost:3000/preview/drape-menu?embed=1&autoplay=1', { waitUntil:'networkidle' });
await p.waitForTimeout(1500);
const shots = [];
for (let i=0;i<8;i++){ shots.push((await p.screenshot()).length); await p.waitForTimeout(700); }
console.log('drape-menu frame sizes vary:', new Set(shots).size > 1, '| distinct:', new Set(shots).size);
await b.close();
