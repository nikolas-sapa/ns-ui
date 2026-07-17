// Quality gate: renders every registered component's preview headlessly,
// screenshots states x themes, hard-fails on console errors / blank renders,
// validates meta.json sidecars. Requires the dev server running (BASE_URL).
// Usage: node scripts/verify.ts [component-name]
import { chromium, type Page } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const META_FIELDS = [
  "name",
  "title",
  "description",
  "collection",
  "tags",
  "instruction",
  "dependencies",
] as const;

type Item = { name: string };
const registry = JSON.parse(readFileSync(join(ROOT, "registry.json"), "utf8"));
const only = process.argv[2];
const items: Item[] = registry.items.filter((i: Item) => !only || i.name === only);

const failures: string[] = [];
const fail = (msg: string) => {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
};

function componentDir(name: string): string {
  for (const collection of ["core", "loud"]) {
    const dir = join(ROOT, "registry", collection, name);
    if (existsSync(dir)) return dir;
  }
  throw new Error(`no registry folder found for ${name}`);
}

function checkMeta(name: string, dir: string) {
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) return fail(`${name}: meta.json missing`);
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  for (const field of META_FIELDS) {
    if (meta[field] === undefined || meta[field] === "") {
      fail(`${name}: meta.json missing field "${field}"`);
    }
  }
  if (Array.isArray(meta.tags) && meta.tags.length === 0) {
    fail(`${name}: meta.json tags empty`);
  }
}

async function shoot(page: Page, dir: string, theme: string, state: string) {
  await page.screenshot({ path: join(dir, "screenshots", `${theme}-${state}.png`) });
}

async function verifyComponent(page: Page, name: string, dir: string) {
  mkdirSync(join(dir, "screenshots"), { recursive: true });

  for (const theme of ["dark", "light"] as const) {
    const consoleErrors: string[] = [];
    const onConsole = (msg: { type(): string; text(): string }) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    };
    const onPageError = (err: Error) => consoleErrors.push(String(err));
    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    await page.goto(`${BASE_URL}/preview/${name}`, { waitUntil: "networkidle" });
    // park the mouse away — it persists across navigations and a resting
    // hover fakes the "default" state (bit us: light-default === light-hover)
    await page.mouse.move(0, 0);
    if (theme === "light") {
      // ponytail: post-mount class removal — components reading theme at mount
      // will screenshot wrong; upgrade to a ?theme= param when one exists
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
    }
    // settle animations/entrances before judging
    await page.waitForTimeout(1000);

    // blank-render check: something visible must exist inside body
    // ponytail: element-count heuristic — upgrade to pixel-diff if it ever lies
    const visibleCount = await page.evaluate(
      () =>
        Array.from(document.body.querySelectorAll("*")).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }).length
    );
    if (visibleCount < 2) fail(`${name} [${theme}]: blank render (${visibleCount} visible elements)`);

    await shoot(page, dir, theme, "default");

    // interaction states: first interactive element, if any
    const interactive = page.locator("button, a, [role=button]").first();
    if (await interactive.count()) {
      await interactive.hover();
      await page.waitForTimeout(400);
      await shoot(page, dir, theme, "hover");
      // hover must actually change pixels, else the state is dead
      const [def, hov] = ["default", "hover"].map((s) =>
        readFileSync(join(dir, "screenshots", `${theme}-${s}.png`))
      );
      if (def.equals(hov)) fail(`${name} [${theme}]: hover state identical to default`);

      await page.mouse.down();
      await page.waitForTimeout(250);
      await shoot(page, dir, theme, "press");
      await page.mouse.up();

      await page.mouse.move(0, 0);
      await interactive.focus();
      await page.waitForTimeout(250);
      await shoot(page, dir, theme, "focus");
      await page.keyboard.press("Escape");
    }

    // mid-scroll state, only when the page actually scrolls
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight * 1.2
    );
    if (scrollable) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      await page.waitForTimeout(600);
      await shoot(page, dir, theme, "scroll");
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    if (consoleErrors.length) {
      fail(`${name} [${theme}]: console errors — ${consoleErrors.join(" | ")}`);
    }
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const item of items) {
  console.log(`verifying ${item.name}`);
  const dir = componentDir(item.name);
  checkMeta(item.name, dir);
  await verifyComponent(page, item.name, dir);
}

await browser.close();

if (failures.length) {
  console.error(`\nverify FAILED: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log(`\nverify passed: ${items.length} component(s), screenshots written`);
