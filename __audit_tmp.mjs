import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function run() {
  const browser = await chromium.launch();

  // ---------- Desktop, light ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE, { waitUntil: "networkidle" });

    // Landmarks
    const landmarks = await page.evaluate(() => {
      const out = {};
      for (const tag of ["header", "main", "footer", "nav"]) {
        out[tag] = document.querySelectorAll(tag).length;
      }
      out.roleTablist = document.querySelectorAll('[role="tablist"]').length;
      out.roleGroup = document.querySelectorAll('[role="group"]').length;
      out.skipLink = !!document.querySelector('a[href="#main"], a[href*="skip" i]');
      return out;
    });
    console.log("LANDMARKS", landmarks);

    // Heading hierarchy
    const headings = await page.evaluate(() =>
      [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => h.tagName)
    );
    console.log("HEADINGS", headings);

    // Tab order: how many Tab presses to reach first card link, count total stops
    await page.keyboard.press("Tab"); // start
    let stops = [];
    for (let i = 0; i < 40; i++) {
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        return {
          tag: el.tagName,
          role: el.getAttribute("role"),
          text: (el.textContent || "").trim().slice(0, 30),
          href: el.getAttribute("href"),
        };
      });
      stops.push(info);
      await page.keyboard.press("Tab");
    }
    console.log("FIRST 40 TAB STOPS", JSON.stringify(stops, null, 0));

    // count total tab stops to reach footer (GitHub link) - brute force count total focusable elements before first footer link
    const totalFocusableBeforeFooter = await page.evaluate(() => {
      const footer = document.querySelector("footer");
      const all = [...document.querySelectorAll("a,button,input,select,textarea,[tabindex]")].filter(
        (el) => !el.closest("iframe") && el.tabIndex !== -1
      );
      const footerLinks = footer ? [...footer.querySelectorAll("a")] : [];
      const idx = footerLinks.length ? all.indexOf(footerLinks[0]) : -1;
      return { totalFocusable: all.length, indexOfFirstFooterLink: idx };
    });
    console.log("FOCUSABLE COUNT", totalFocusableBeforeFooter);

    // Card link accessible names - sample first 3
    const cardNames = await page.evaluate(() =>
      [...document.querySelectorAll("article h3 a")].slice(0, 3).map((a) => a.textContent.trim())
    );
    console.log("CARD LINK NAMES (sample)", cardNames);

    // grid semantics
    const gridSemantics = await page.evaluate(() => {
      const grid = document.querySelectorAll("main > div.mt-10.grid")[0];
      return grid ? { tag: grid.tagName, role: grid.getAttribute("role"), childTag: grid.firstElementChild?.tagName } : null;
    });
    console.log("GRID SEMANTICS", gridSemantics);

    console.log("CONSOLE ERRORS (light desktop)", errors);
    await ctx.close();
  }

  // ---------- Mobile 375 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.screenshot({ path: "/private/tmp/claude-503/-Users-nikolassapalidis/29c860f5-3a22-49b4-b313-b564446ec7aa/scratchpad/mobile-before.png", fullPage: false });
    const controlsBox = await page.locator(".sticky.top-0").boundingBox();
    console.log("MOBILE CONTROLS BAR HEIGHT", controlsBox);
    // Check search input tap target
    const searchBox = await page.locator("#component-search").boundingBox();
    console.log("SEARCH INPUT SIZE", searchBox);
    const chipBox = await page.locator('[role="group"] button').first().boundingBox();
    console.log("FIRST CHIP SIZE", chipBox);
    await ctx.close();
  }

  // ---------- Empty search state ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.fill("#component-search", "zzzznonexistentquery");
    await page.waitForTimeout(300);
    const emptyState = await page.evaluate(() => document.body.innerText.includes("Nothing matches"));
    console.log("EMPTY STATE SHOWS", emptyState);
    await ctx.close();
  }

  // ---------- URL round trip for filter/category/search ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.click('button[role="tab"]:has-text("Loud")');
    await page.waitForTimeout(200);
    console.log("URL AFTER LOUD FILTER", page.url());
    await ctx.close();
  }

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
