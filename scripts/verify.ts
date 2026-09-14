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

// Structured so the final summary can print one consistent shape per problem
// regardless of category — the old free-text messages had two different
// shapes ("name: ..." vs "name [theme]: ...") and a grep tuned for one
// silently dropped the other. variant is null when the problem isn't
// theme-specific (meta.json checks, a11y, the dark/light-identical check).
type Failure = { component: string; variant: "dark" | "light" | null; category: string; message: string };
const failures: Failure[] = [];
const fail = (component: string, variant: "dark" | "light" | null, category: string, message: string) => {
  failures.push({ component, variant, category, message });
  const tag = variant ? ` [${variant}]` : "";
  console.error(`  ✗ ${component}${tag}: ${category} — ${message}`);
};

function componentDir(name: string): string {
  for (const collection of ["core", "loud"]) {
    const dir = join(ROOT, "registry", collection, name);
    if (existsSync(dir)) return dir;
  }
  throw new Error(`no registry folder found for ${name}`);
}

// resetBefore: opt-in escape hatch for a component whose gate.openBy target
// can be left in a mutated, animating state by the earlier interactive-states
// phase above (hover/press/focus on the first visible button — a real
// mouse.down+up, i.e. a real click). undo-ghost-row is the case that forced
// this: that phase's click deletes row 0, starting an 8s WAA height-collapse
// on the ghost; every remaining [data-afterimage-delete] then sits below it
// and drifts a fraction of a px every frame (measured: y 381.08 -> 378.69 px
// over 5 x 200ms samples), so Playwright's 2-stable-frame click check never
// passes and opener.click() times out — not a missing selector, not a real
// user-facing barrier (a real mouseup dispatches regardless of reflow).
// Setting this re-navigates to a clean preview right before opener.click()
// so the gate tests what openBy/expect was meant to test — click from resting
// state — instead of silently inheriting whatever the press phase left behind.
type Gate = { openBy?: string; expect?: string; resetBefore?: boolean };
type Meta = { gate?: Gate } & Record<string, unknown>;

function checkMeta(name: string, dir: string): Meta {
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) {
    fail(name, null, "meta", "meta.json missing");
    return {};
  }
  const meta: Meta = JSON.parse(readFileSync(metaPath, "utf8"));
  for (const field of META_FIELDS) {
    if (meta[field] === undefined || meta[field] === "") {
      fail(name, null, "meta", `missing field "${field}"`);
    }
  }
  if (Array.isArray(meta.tags) && meta.tags.length === 0) {
    fail(name, null, "meta", "tags empty");
  }
  if (meta.gate) {
    const { openBy, expect } = meta.gate;
    if (!openBy || !expect) fail(name, null, "meta", `"gate" needs both "openBy" and "expect" selectors`);
  }
  return meta;
}

// Ran in-page. Derives what to assert from the rendered DOM rather than a
// per-component list, so it can't rot when a component changes shape.
// Deliberately NOT asserting per-element tabbability: roving-tabindex chips and
// spinner buttons whose input owns the keyboard are legitimate and would
// false-fail. Page-level reachability (below) is the honest version of that rule.
function auditA11y() {
  const CONTROLS =
    "button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch]," +
    " [role=checkbox], [role=radio], [role=tab], [role=slider], [role=menuitem], [role=option]," +
    " [role=link], [role=combobox], [role=spinbutton]";
  const txt = (s: string | null | undefined) => (s ?? "").trim();
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && Number(cs.opacity) > 0.01;
  };
  // aria-hidden subtrees are, by definition, not in the a11y tree — a visually
  // hidden proxy <input type=file> behind a real button is correct, not a bug.
  const exposed = (el: Element) => visible(el) && !el.closest('[aria-hidden="true"]');
  const disabled = (el: Element) =>
    (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";
  const named = (el: Element) => {
    if (txt(el.getAttribute("aria-label"))) return true;
    const by = el.getAttribute("aria-labelledby");
    if (by && by.split(/\s+/).some((id) => txt(document.getElementById(id)?.textContent))) return true;
    if (txt(el.getAttribute("title"))) return true;
    const labels = (el as HTMLInputElement).labels;
    if (labels?.length && Array.from(labels).some((l) => txt(l.textContent))) return true;
    if (txt(el.getAttribute("placeholder"))) return true;
    if (txt(el.getAttribute("alt"))) return true;
    if (txt(el.textContent)) return true;
    if (txt(el.querySelector("img[alt]")?.getAttribute("alt"))) return true;
    if (txt(el.querySelector("svg title")?.textContent)) return true;
    const input = el as HTMLInputElement;
    if (el.tagName === "INPUT" && ["submit", "button", "reset"].includes(input.type) && txt(input.value)) return true;
    return false;
  };
  const desc = (el: Element) => {
    const role = el.getAttribute("role");
    const cls = String((el as HTMLElement).className || "").split(/\s+/)[0];
    return el.tagName.toLowerCase() + (role ? `[role=${role}]` : "") + (cls ? `.${cls}` : "");
  };

  const controls = Array.from(document.querySelectorAll(CONTROLS)).filter(exposed);
  const live = controls.filter((el) => !disabled(el));
  const problems: string[] = [];

  for (const el of live) {
    if (!named(el)) problems.push(`control has no accessible name: ${desc(el)}`);
  }
  for (const el of controls) {
    const role = el.getAttribute("role");
    if (role && ["switch", "checkbox", "radio"].includes(role) && !el.hasAttribute("aria-checked")) {
      problems.push(`role=${role} without aria-checked: ${desc(el)}`);
    }
  }
  for (const d of Array.from(document.querySelectorAll("[role=dialog], [role=alertdialog], dialog")).filter(exposed)) {
    if (!named(d)) problems.push(`dialog has no accessible name: ${desc(d)}`);
  }
  return { controls: controls.length, problems };
}

// Is the element's own centre actually hittable? A non-zero box proves nothing:
// an ancestor's overflow:hidden clips it, or something paints over it, and it is
// invisible while still measuring fine. elementFromPoint is the honest test.
// null = centre is off-viewport, which is also a fail.
function hittable(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, why: "no element matches" };
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return { ok: false, why: `zero box (${r.width}x${r.height})` };
  const cs = getComputedStyle(el);
  if (cs.visibility === "hidden" || Number(cs.opacity) < 0.01) {
    return { ok: false, why: `visibility:${cs.visibility} opacity:${cs.opacity}` };
  }
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  if (!hit) return { ok: false, why: `centre (${Math.round(x)},${Math.round(y)}) is outside the viewport` };
  // only the element itself or something inside it counts — an ANCESTOR at the
  // centre means the element is clipped away or covered at that point.
  if (hit !== el && !el.contains(hit)) {
    return { ok: false, why: `centre hits <${hit.tagName.toLowerCase()}> instead — clipped or covered` };
  }
  return { ok: true, why: "" };
}

async function shoot(page: Page, dir: string, theme: string, state: string) {
  await page.screenshot({ path: join(dir, "screenshots", `${theme}-${state}.png`) });
}

async function verifyComponent(page: Page, name: string, dir: string, meta: Meta) {
  mkdirSync(join(dir, "screenshots"), { recursive: true });

  for (const theme of ["dark", "light"] as const) {
    const consoleErrors: string[] = [];
    // Vercel Analytics requests /_vercel/insights/script.js, which 404s in local
    // dev (no Vercel platform behind it) and is unrelated to the component under
    // test. The 404 lands in the message's resource location, not its text, so
    // check both. Drop only that noise; anything else still fails the gate.
    const isVercelNoise = (text: string) => text.includes("/_vercel/");
    const onConsole = (msg: { type(): string; text(): string; location(): { url: string } }) => {
      if (
        msg.type() === "error" &&
        !isVercelNoise(msg.text()) &&
        !isVercelNoise(msg.location().url)
      ) {
        consoleErrors.push(msg.text());
      }
    };
    const onPageError = (err: Error) => {
      if (!isVercelNoise(String(err))) consoleErrors.push(String(err));
    };
    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    // Emulate BEFORE navigating: the no-flash script in <head> picks the theme
    // at load from localStorage, else prefers-color-scheme. Playwright defaults
    // an unconfigured context to light, so once the hardcoded `dark` class came
    // off <html> (theme toggle), the "dark" pass silently screenshotted LIGHT —
    // the gate covered light twice and claimed both themes for months of runs.
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(`${BASE_URL}/preview/${name}`, { waitUntil: "networkidle" });
    // park the mouse away — it persists across navigations and a resting
    // hover fakes the "default" state (bit us: light-default === light-hover)
    await page.mouse.move(0, 0);
    // belt and braces: assert the class both ways rather than only removing it,
    // so this cannot silently degrade again if the default flips.
    await page.evaluate((t) => {
      document.documentElement.classList.toggle("dark", t === "dark");
    }, theme);
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
    if (visibleCount < 2) fail(name, theme, "blank-render", `${visibleCount} visible elements`);

    await shoot(page, dir, theme, "default");

    // DOM/ARIA audit — theme-independent, so run it once (dark pass) rather
    // than reporting every real violation twice.
    if (theme === "dark") {
      const { controls, problems } = await page.evaluate(auditA11y);
      for (const p of problems) fail(name, null, "a11y", p);

      // Page-level keyboard reachability: if the component renders any control
      // at all, Tab from a blurred body must land on something. A display-only
      // component (skeleton, chart, canvas hero) has no controls and is skipped.
      if (controls > 0) {
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        let landed: string | null = null;
        for (let i = 0; i < 12 && !landed; i++) {
          await page.keyboard.press("Tab");
          landed = await page.evaluate(() => {
            const a = document.activeElement;
            return a && a !== document.body && a !== document.documentElement ? a.tagName : null;
          });
        }
        if (!landed) {
          fail(name, null, "a11y", `${controls} interactive control(s) but nothing is reachable by Tab`);
        }
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      }
    }

    // interaction states: first VISIBLE interactive element, if any.
    //
    // The list below is wider than `button, a, [role=button]` for a measured
    // reason: 18 of 266 components expose NO button or link at all — their
    // primary control is an `<input>`, a slider, a checkbox or a radio
    // (sliders, checkbox runs, radio groups, search fields, a time picker, a
    // tag input, and several ASCII instruments). For every one of those, this
    // block used to find nothing, so hover/press/focus were never exercised
    // and `GATE: PASS` meant only "renders, not blank, dark != light". That is
    // the same shape as the failure that let three real defects sit in
    // production for months: a gate that reports success for a check it never
    // ran. Widening the selector is what makes the pass mean what it says.
    const interactive = page
      .locator(
        "button, a, [role=button], input:not([type=hidden]), select, textarea, " +
          "[role=slider], [role=switch], [role=checkbox], [role=radio], [contenteditable]",
      )
      .filter({ visible: true })
      .first();
    if (await interactive.count()) {
      // "hover must change pixels" is an AFFORDANCE rule for things that look
      // clickable — a button or a link that reacts to nothing reads as dead.
      // It is not a rule about text inputs, sliders or checkboxes: a bare
      // `<input>` that only changes on focus is correct, not broken. Asserting
      // it against those manufactures findings (measured: 5 of the 18
      // input-driven components fail it while being visually fine). So the
      // assertion stays scoped to button-likes, while the widened selector
      // above still drives press and — the part that actually matters — the
      // keyboard-focus check on every one of them.
      const isButtonLike = await interactive.evaluate((el) =>
        el.matches("button, a, [role=button]"),
      );
      // `force` because the first visible control can legitimately sit under
      // an overlay or be pointer-events:none (a styled proxy input behind a
      // real control). Three components timed out on a strict hover for
      // exactly that reason, which is a harness artifact, not a defect.
      await interactive.hover({ timeout: 5000, force: true }).catch(() => {});
      await page.waitForTimeout(400);
      await shoot(page, dir, theme, "hover");
      const [def, hov] = ["default", "hover"].map((s) =>
        readFileSync(join(dir, "screenshots", `${theme}-${s}.png`))
      );
      if (isButtonLike && def.equals(hov)) {
        fail(name, theme, "hover", "state identical to default");
      }

      await page.mouse.down();
      await page.waitForTimeout(250);
      await shoot(page, dir, theme, "press");
      await page.mouse.up();

      // Focus, honestly. The press above already focused the element via
      // mouse.down, so the old explicit .focus() fired no transition and the
      // focus shot could never differ — it manufactured false findings against
      // components that were fine. Blur first, take the unfocused baseline HERE
      // (not the pre-click `default`: that click may have toggled state, and the
      // diff would then pass on state change rather than on a focus ring), then
      // drive focus by keyboard so :focus-visible applies the way a user sees it.
      await page.mouse.move(0, 0);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.waitForTimeout(300);
      await shoot(page, dir, theme, "unfocused");
      let focused = false;
      for (let i = 0; i < 12 && !focused; i++) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => {
          const a = document.activeElement;
          return !!a && a !== document.body && a !== document.documentElement;
        });
      }
      await page.waitForTimeout(300);
      await shoot(page, dir, theme, "focus");
      const [unf, foc] = ["unfocused", "focus"].map((s) =>
        readFileSync(join(dir, "screenshots", `${theme}-${s}.png`))
      );
      if (focused && unf.equals(foc)) {
        fail(name, theme, "focus", "keyboard focus renders no visible focus state");
      }
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
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

    // Characteristic state — the open/expanded/armed one. Optional: a component
    // declares it in meta.json as { "gate": { "openBy": "...", "expect": "..." } }.
    // Without this the gate only ever sees the resting state, which is how a
    // popover clipped invisible by an ancestor's overflow-hidden shipped green.
    const gate = meta.gate;
    if (gate?.openBy && gate.expect) {
      if (gate.resetBefore) {
        // see the Gate type comment: undo whatever the interactive-states
        // phase above did before this component's gate click.
        await page.goto(`${BASE_URL}/preview/${name}`, { waitUntil: "networkidle" });
        await page.evaluate((t) => {
          document.documentElement.classList.toggle("dark", t === "dark");
        }, theme);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(1000);
      }
      const opener = page.locator(gate.openBy).first();
      if (!(await opener.count())) {
        fail(name, theme, "gate", `openBy "${gate.openBy}" matches nothing`);
      } else {
        await opener.click({ timeout: 5000 });
        await page.waitForTimeout(700);
        await page.mouse.move(0, 0);
        const hit = await page.evaluate(hittable, gate.expect);
        if (!hit.ok) {
          fail(name, theme, "gate", `expect "${gate.expect}" not visible — ${hit.why}`);
        }
        await shoot(page, dir, theme, "open");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    if (consoleErrors.length) {
      fail(name, theme, "console", consoleErrors.join(" | "));
    }
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }

  // The gate must be able to catch its own blindness: if the two theme passes
  // produce identical pixels, the theme was never actually switched and every
  // "verified in both themes" claim is worthless. This exact failure shipped
  // silently once — the dark pass was rendering light after the theme toggle
  // removed the hardcoded class. Cheap byte compare, no tolerance needed:
  // real theme swaps change the background of every single pixel.
  const [darkShot, lightShot] = ["dark", "light"].map((t) =>
    readFileSync(join(dir, "screenshots", `${t}-default.png`))
  );
  if (darkShot.equals(lightShot)) {
    fail(name, null, "theme", "dark and light screenshots are identical — theme never switched");
  }
}

// Zero components verified is never a pass. A typo'd component-name argument
// filters to an empty list, and until now that silently printed "0 problems"
// and exited 0 — a mistyped name reading as a clean gate, worse than tonight's
// miss because it prints nothing wrong at all. Fail loud, name the argument
// that caused it, and skip the browser launch entirely since there is nothing
// to verify.
if (items.length === 0) {
  console.log("");
  console.log("==================== VERIFY SUMMARY ====================");
  console.log(`components verified: 0`);
  console.log(`problems found: 0`);
  console.log(`components with problems: 0`);
  if (only) {
    console.log(`FAIL ${only} [none] filter: no registry item matches "${only}" — check for a typo`);
    console.log(`GATE: ERROR no components matched "${only}"`);
  } else {
    console.log(`FAIL (none) [none] registry: registry.json has no items`);
    console.log(`GATE: ERROR nothing verified — registry is empty`);
  }
  console.log("==========================================================");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const item of items) {
  console.log(`verifying ${item.name}`);
  const dir = componentDir(item.name);
  // One component's thrown exception (a Playwright click timeout on a never-
  // stable animated element, a page crash) must fail THAT component, not abort
  // the whole sweep — otherwise a single bad gate leaves the other 185
  // unverifiable in one pass. Record it and reset the page for the next one.
  try {
    const meta = checkMeta(item.name, dir);
    await verifyComponent(page, item.name, dir, meta);
  } catch (err) {
    const first = err instanceof Error ? err.message.split("\n")[0] : String(err);
    fail(item.name, null, "threw", first);
    try {
      await page.goto("about:blank");
    } catch {
      /* page unrecoverable — next iteration's goto will surface it */
    }
  }
}

await browser.close();

// Final summary: printed last, one fixed shape per problem line, so it
// survives any amount of preceding noise (a failing run's console errors and
// DOM diffs can run hundreds of lines) and is grep-safe with a single
// pattern regardless of category or whether a theme variant is involved —
// unlike the per-problem console.error above, whose two message shapes
// ("name: ..." vs "name [theme]: ...") let a pattern tuned for one silently
// drop the other.
const distinctComponents = new Set(failures.map((f) => f.component)).size;
console.log("");
console.log("==================== VERIFY SUMMARY ====================");
console.log(`components verified: ${items.length}`);
console.log(`problems found: ${failures.length}`);
console.log(`components with problems: ${distinctComponents}`);
for (const f of failures) {
  console.log(`FAIL ${f.component} [${f.variant ?? "none"}] ${f.category}: ${f.message}`);
}
console.log(
  failures.length
    ? `GATE: FAIL ${failures.length} problems in ${distinctComponents} components`
    : "GATE: PASS"
);
console.log("==========================================================");

if (failures.length) process.exit(1);
