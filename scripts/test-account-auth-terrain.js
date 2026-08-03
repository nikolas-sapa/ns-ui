import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3403";

async function collectText(panel) {
  return panel.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const values = [];
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text) values.push(text);
    }
    return values;
  });
}

async function canvasBuffer(canvas) {
  await canvas.waitFor({ state: "visible" });
  return canvas.screenshot();
}

async function runCase(browser, colorScheme, reducedMotion) {
  const context = await browser.newContext({ colorScheme, reducedMotion });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/account`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const copyPanel = page.locator("[data-auth-copy]");
  const visualPanel = page.locator("[data-auth-visual]");
  const canvas = visualPanel.locator("canvas");

  await copyPanel.waitFor({ state: "visible" });
  await visualPanel.waitFor({ state: "visible" });

  await assert.doesNotReject(() =>
    copyPanel.getByRole("heading", { name: "Sign in to save." }).waitFor()
  );
  await assert.doesNotReject(() =>
    copyPanel.getByRole("link", { name: "Alex Lekkas" }).waitFor()
  );
  await assert.doesNotReject(() =>
    copyPanel.getByText("Founding Engineer at Spawn Partners").waitFor()
  );

  assert.equal(await canvas.count(), 1, `${colorScheme}/${reducedMotion}: missing auth terrain canvas`);

  const textNodes = await collectText(await visualPanel.elementHandle());
  assert.deepEqual(textNodes, [], `${colorScheme}/${reducedMotion}: visual panel should be canvas-only`);

  const first = await canvasBuffer(canvas);
  await page.waitForTimeout(700);
  const second = await canvasBuffer(canvas);
  const animated = !first.equals(second);

  if (reducedMotion === "reduce") {
    assert.equal(animated, false, `${colorScheme}/reduce: terrain should stay static`);
  } else {
    assert.equal(animated, true, `${colorScheme}/no-preference: terrain should animate at rest`);
  }

  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  try {
    for (const colorScheme of ["dark", "light"]) {
      for (const reducedMotion of ["no-preference", "reduce"]) {
        await runCase(browser, colorScheme, reducedMotion);
      }
    }
    console.log("account auth terrain: pass");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("account auth terrain: fail");
  console.error(error);
  process.exitCode = 1;
});
