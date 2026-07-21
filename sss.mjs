import { chromium } from '/Users/nikolassapalidis/Developer/misc/ns-ui/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1440,height:900}});
await p.goto('http://localhost:3300/preview/scan-sweep-stats',{waitUntil:'networkidle'});
await p.waitForTimeout(1200);
// the fixer's exact stated method: synthetic pointerenter+mouseenter at a stat card
const r = await p.evaluate(() => {
  const cards=[...document.querySelectorAll('[role="group"]')];
  if(!cards.length) return {err:'no [role=group]'};
  const c=cards[0];
  const before=c.dataset.raised;
  for (const t of ['pointerenter','mouseenter','pointerover']) c.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:1,clientY:1}));
  const after=c.dataset.raised;
  const ov=c.querySelector('div[aria-hidden]');
  return {cards:cards.length, before, after, overlayOpacity: ov?getComputedStyle(ov).opacity:'n/a'};
});
console.log('synthetic dispatch:', JSON.stringify(r));
// real mouse for comparison
const bb = await p.locator('[role="group"]').first().boundingBox();
await p.mouse.move(bb.x+bb.width/2, bb.y+bb.height/2); await p.waitForTimeout(300);
console.log('real hover data-raised:', await p.evaluate(()=>document.querySelectorAll('[role="group"]')[0]?.dataset.raised));
await b.close();
