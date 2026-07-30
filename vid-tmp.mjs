import { chromium } from 'playwright';
const PREV=process.argv[2], PROD='https://design.helpmarq.com';
const b = await chromium.launch();
const measure = async (url) => {
  const ctx = await b.newContext({ viewport:{width:1440,height:900} });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__lt=[]; window.__lcp=0; window.__cls=0;
    new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push({s:Math.round(e.startTime),d:Math.round(e.duration)}))).observe({type:'longtask',buffered:true});
    new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=Math.round(e.startTime);}).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value;}).observe({type:'layout-shift',buffered:true}); });
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.goto(url,{waitUntil:'load',timeout:90000}); await p.waitForTimeout(14000);
  const r = await p.evaluate(() => { const n=performance.getEntriesByType('navigation')[0];
    const fcp=performance.getEntriesByName('first-contentful-paint')[0];
    const tbt=(a,z)=>window.__lt.filter(e=>e.s>=a&&e.s<z).reduce((x,e)=>x+Math.max(0,e.d-50),0);
    const rs=performance.getEntriesByType('resource');
    return { ttfb:Math.round(n.responseStart), fcp:Math.round(fcp?.startTime||0), lcp:window.__lcp, cls:+window.__cls.toFixed(3),
      tbtLoad:tbt(0,5000), tbtSteady:tbt(6000,14000), reqs:rs.length,
      kb:Math.round(rs.reduce((a,x)=>a+(x.transferSize||0),0)/1024) }; });
  await ctx.close(); return r;
};
const A=[],B=[];
for (let i=0;i<3;i++){ A.push(await measure(PROD)); B.push(await measure(PREV)); }
const med=(a,k)=>a.map(x=>x[k]).sort((x,y)=>x-y)[1];
for (const k of ['ttfb','fcp','lcp','cls','tbtLoad','tbtSteady','reqs','kb'])
  console.log(`${k.padEnd(10)} PROD=${String(med(A,k)).padStart(6)}   NEW=${String(med(B,k)).padStart(6)}`);
console.log('raw tbtSteady PROD:', A.map(x=>x.tbtSteady).join(', '));
console.log('raw tbtSteady NEW :', B.map(x=>x.tbtSteady).join(', '));
await b.close();
