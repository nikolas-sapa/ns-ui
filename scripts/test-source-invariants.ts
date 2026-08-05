// Static source gate: the defect CLASSES that `scripts/verify.ts` structurally
// cannot see. verify.ts drives a browser over `/preview/<component>` — so it
// covers registry components at runtime and NOTHING under `app/**` (the site
// itself), and it can only catch what is visible in a screenshot diff. Every
// check below is a class that shipped green through that gate at least once.
//
// Deliberately grep-shaped, not AST-shaped: no parser dependency, no test
// framework, same idiom as test-category-coverage.ts / test-name-policy.ts.
// The cost of that is stated per check — where a construct can hide a defect
// from this script, the comment says so rather than pretending coverage.
//
// NOT COVERED, deliberately — stated so nobody reads a green run as "the sweep's
// findings are all gated". These are dataflow facts, not text patterns, and a
// grep-shaped check for them would be a guess wearing a gate's clothing:
//   * a "clear filters" action that resets a SUBSET of the filters it needs to
//   * a displayed count read off a different collection than the rendered list
//   * a URL param admitted into filter state without being narrowed to a
//     known value set while its siblings are narrowed
//   * two instances of one control pattern diverging on keyboard/reset
//     behaviour, and forked components drifting on duration/property
//   * an off-screen-but-focusable element (a closed drawer left in the tab
//     order) — that one is runtime geometry and belongs in `verify.ts`
//
// Usage: node scripts/test-source-invariants.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Hand-authored source only. `public/r/**`, `registry.json`, `lib/*.generated.json`,
// `mcp/data/**` and `cli/data/**` are build output — a finding there is a finding
// in the source it was generated from, reported twice.
const SOURCE_DIRS = ["app", "lib", "registry"];
const SKIP_DIRS = new Set(["node_modules", "screenshots", ".next", "data"]);

type Problem = { file: string; line: number; check: string; message: string };
const problems: Problem[] = [];
const fail = (file: string, line: number, check: string, message: string) =>
  problems.push({ file: relative(ROOT, file), line, check, message });

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(entry) && !/\.generated\./.test(entry)) out.push(p);
  }
  return out;
}

const files = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d)));
const lineOf = (src: string, index: number) => src.slice(0, index).split("\n").length;

// ---------------------------------------------------------------------------
// globals.css — the token contract every other check is measured against.
// ---------------------------------------------------------------------------
const GLOBALS = join(ROOT, "app", "globals.css");
const globals = readFileSync(GLOBALS, "utf8");

// Every `--name:` declaration anywhere in globals.css (:root, .dark, @theme
// inline, @property, component classes). This is the set a `var(--x)` in any
// file may legally resolve against.
const declaredGlobally = new Set(Array.from(globals.matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]));

// Block extractor: `.dark {` ... matching `}`. Used for the per-theme parity check.
function cssBlock(selector: string): string {
  const at = globals.indexOf(selector + " {");
  if (at < 0) return "";
  let depth = 0;
  for (let i = at; i < globals.length; i++) {
    if (globals[i] === "{") depth++;
    else if (globals[i] === "}" && --depth === 0) return globals.slice(at, i);
  }
  return "";
}
const rootBlock = cssBlock(":root");
const darkBlock = cssBlock(".dark");

// The two tokens that are deliberately theme-invariant: the brand accent is
// one blue in both themes by design. Everything else in :root is a surface or
// text colour and MUST have a .dark value. Listing the exceptions here (rather
// than exempting whole prefixes) means adding a new token without a dark value
// fails until someone states which of the two it is.
const THEME_INVARIANT = new Set(["--ns-accent", "--ns-accent-hover"]);

// CHECK theme-parity — a per-theme token defined for one theme and not the
// other. `--error`/`--success`/`--warning` each had a :root value tuned for
// contrast on white and NO `.dark` override, so status text failed AA in one
// theme each while every screenshot looked plausible.
{
  const decls = (block: string) => new Set(Array.from(block.matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]));
  const inRoot = decls(rootBlock);
  const inDark = decls(darkBlock);
  if (!rootBlock || !darkBlock) {
    fail("app/globals.css", 1, "theme-parity", "could not find both a `:root` and a `.dark` block");
  }
  for (const name of inRoot) {
    if (!inDark.has(name) && !THEME_INVARIANT.has(name)) {
      fail(
        GLOBALS,
        lineOf(globals, globals.indexOf(`${name}:`)),
        "theme-parity",
        `\`${name}\` is defined in :root but has no .dark override — it renders the light value on a dark page`,
      );
    }
  }
  for (const name of inDark) {
    if (!inRoot.has(name)) {
      fail(GLOBALS, lineOf(globals, darkBlock.indexOf(`${name}:`)), "theme-parity", `\`${name}\` is .dark-only`);
    }
  }
}

// CHECK color-scheme — a class-based dark theme with no `color-scheme`
// declaration leaves every UA-painted surface (scrollbars, <select> panels,
// range tracks, autofill, form controls) painted light on a dark page. Nothing
// in a component screenshot shows it.
for (const [name, block] of [
  [":root", rootBlock],
  [".dark", darkBlock],
] as const) {
  if (block && !/color-scheme\s*:/.test(block)) {
    fail(GLOBALS, lineOf(globals, globals.indexOf(name + " {")), "color-scheme", `\`${name}\` declares no color-scheme`);
  }
}

// Tailwind theme namespace: `bg-surface` resolves through `--color-surface`.
const themeColors = new Set(
  Array.from(globals.matchAll(/--color-([a-z0-9-]+)\s*:/g), (m) => m[1]),
);

// ---------------------------------------------------------------------------
// Per-file scanners.
// ---------------------------------------------------------------------------

// Every string / template literal in a file, with its source offset. Class
// lists live in `className="…"`, in `` `…${x}…` ``, and in bare module-level
// consts (`const BTN = "…"`), so scanning literals covers all three where
// scanning `className=` would miss the third.
//
// KNOWN GAP: a class list split across a `+` concatenation is two literals, so
// a pair-check whose two halves land either side of the `+` does not fire. That
// direction is a miss, never a false accusation, which is the right way round.
function literals(src: string): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  for (const m of src.matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'|`([^`\\]*)`/g)) {
    out.push({ text: m[1] ?? m[2] ?? m[3] ?? "", index: m.index });
  }
  return out;
}

// Is this literal plausibly a Tailwind class list? Cheap gate so prose strings
// ("Copy to clipboard") never reach the utility-pair checks.
const looksLikeClasses = (t: string) =>
  /(^|\s)(hover|focus|focus-visible|disabled|motion-safe|motion-reduce|dark|active|aria-disabled|group-hover|enabled):/.test(t) ||
  /(^|\s)(bg|text|border|ring|outline|flex|grid|rounded|px|py|p|gap|animate|transition)-/.test(t);

// Strip Tailwind variant prefixes from one class token: `focus-visible:ring-2` -> `ring-2`.
const bare = (token: string) => token.slice(token.lastIndexOf(":") + 1);

// Blank out comment bodies, preserving both length and newlines so every
// `lineOf` offset downstream stays exact. Without this the checks read prose:
// two files were failed by this script for the phrase "a var(--token)
// reference" and "written as `bg-[var(--x)]`" inside header comments, which is
// the false-accusation direction — the one that gets a gate switched off.
// Quote-aware so a `"https://…"` literal is not mistaken for a line comment.
function blankComments(src: string): string {
  const out = src.split("");
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        // An unterminated single/double quote is a regex or an apostrophe in
        // JSX text; stop at the newline rather than eating the rest of the file.
        else if (src[i] === "\n" && quote !== "`") break;
        i++;
      }
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") out[i++] = " ";
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (; i < stop; i++) if (src[i] !== "\n") out[i] = " ";
      continue;
    }
    i++;
  }
  return out.join("");
}

// ---------------------------------------------------------------------------
// JSX tag index with PARENT LINKS. The checks below are all about an element
// in context, not an element in isolation, and a flat per-tag scan gets three
// of them wrong in this repo:
//
//   * `<div aria-hidden onClick>` orbiting pills in command-palette-orbit are
//     decorative mirrors of an `sr-only` listbox — accusing them of being
//     mouse-only is a false accusation.
//   * search-winnow's clickable row sits INSIDE `<li role="option">` in a real
//     combobox/listbox; the accessible control is the ancestor.
//   * site-shell's `animate-[nav-trace…]` span sits inside a parent carrying
//     `motion-reduce:hidden`, i.e. the reduced-motion guard is one level up.
//
// So: one tokenizer, parent index per tag, and the checks ask about ancestors.
// KNOWN GAP: a component boundary is opaque. `<Row onClick=…/>` rendering a
// bare div inside another file is not linked, so ancestry stops at the file.
// That direction is a miss, never a false accusation.
// ---------------------------------------------------------------------------
type Tag = { name: string; attrs: string; start: number; end: number; parent: number };

function jsxTags(src: string): Tag[] {
  const tags: Tag[] = [];
  const stack: number[] = [];
  for (const m of src.matchAll(/<(\/?)([A-Za-z][\w.]*)/g)) {
    const [, slash, name] = m;
    if (slash) {
      // Pop to the matching opener. An unbalanced tag (rare, but a `<` inside
      // a string that survived blankComments would do it) must not desync the
      // whole file, so only pop when the name is actually on the stack.
      const at = stack.map((i) => tags[i].name).lastIndexOf(name);
      if (at >= 0) stack.length = at;
      continue;
    }
    // Read to the `>` that closes this tag, ignoring `>` inside braces/strings.
    let depth = 0;
    let quote = "";
    let end = -1;
    for (let i = m.index; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote) quote = "";
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) continue;
    const tag: Tag = { name, attrs: src.slice(m.index, end), end, start: m.index, parent: stack.at(-1) ?? -1 };
    tags.push(tag);
    if (src[end - 1] !== "/") stack.push(tags.length - 1);
  }
  return tags;
}

// Every ancestor of a tag, innermost first.
function ancestorsOf(tags: Tag[], i: number): Tag[] {
  const out: Tag[] = [];
  for (let p = tags[i].parent; p >= 0; p = tags[p].parent) out.push(tags[p]);
  return out;
}

for (const file of files) {
  const src = blankComments(readFileSync(file, "utf8"));
  const isCss = file.endsWith(".css");
  const lits = literals(src);
  const classLists = lits.filter((l) => looksLikeClasses(l.text));
  // One tokenize per file, shared by the class-list checks (which ask "what is
  // the element around THIS literal") and the tag checks below.
  const tags = isCss ? [] : jsxTags(src);
  // Innermost opening tag whose attribute span contains this offset. Last match
  // wins: a `icon={<Foo className="…"/>}` attribute nests one tag's span inside
  // another's, and the inner one is the element the class list belongs to.
  const tagAt = (index: number) => {
    for (let i = tags.length - 1; i >= 0; i--) {
      if (tags[i].start <= index && index <= tags[i].end) return i;
    }
    return -1;
  };

  // -------------------------------------------------------------------------
  // CHECK stale-token — `var(--x)` naming a custom property nothing defines.
  // After the `--muted`/`--accent` -> `--ns-muted`/`--ns-accent` rename, a
  // stale reference resolves to NOTHING: the declaration is dropped and the
  // element inherits, which frequently still looks fine in a screenshot.
  // Locally-declared props (`style={{ "--travel": … }}`, an @property, a
  // component's own CSS class) count as defined for the file that declares them.
  // -------------------------------------------------------------------------
  // A file's own props: a CSS declaration, a style-object key, or a
  // `setProperty("--x", …)` — all three appear in this repo.
  const declaredLocally = new Set([
    ...Array.from(src.matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]),
    ...Array.from(src.matchAll(/["'`](--[a-z0-9-]+)["'`]/g), (m) => m[1]),
  ]);
  // `var(--x, fallback)` is not this defect: a stale name still paints the
  // fallback. The class is the UNFALLBACKED reference, which after the
  // `--muted`/`--accent` rename resolves to nothing, drops the declaration,
  // and inherits — usually still a plausible-looking screenshot.
  for (const m of src.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,?)/g)) {
    const name = m[1];
    if (m[2] === ",") continue;
    // NSUI-TOK-05: `--color-*` is generated by `@theme inline` for Tailwind's
    // own use. Referencing it from component source is off-contract — it is a
    // build artifact of the theme, not a token, and it is invisible to any
    // consumer who installs the component into their own Tailwind config.
    if (name.startsWith("--color-") && !isCss) {
      fail(file, lineOf(src, m.index), "stale-token", `\`var(${name})\` is a build-generated Tailwind alias — use the source token`);
      continue;
    }
    if (declaredGlobally.has(name) || declaredLocally.has(name)) continue;
    fail(file, lineOf(src, m.index), "stale-token", `\`var(${name})\` — no such custom property is defined`);
  }

  if (isCss) continue;

  // -------------------------------------------------------------------------
  // CHECK stale-utility — a theme-namespaced utility (`text-ns-muted`,
  // `bg-surface`) whose backing `--color-*` no longer exists. Same rename
  // hazard as above but through Tailwind: a stale `text-muted` compiles to
  // nothing at all and the text silently renders at `--foreground`.
  // -------------------------------------------------------------------------
  const TOKEN_UTILITY =
    /(?:^|[\s"'`])(?:bg|text|border|border-[xytblrse]{1,2}|ring|ring-offset|outline|fill|stroke|divide|placeholder|caret|accent|decoration|shadow|from|to|via)-(background|foreground|surface|border|muted|accent-hover|accent|ns-[a-z0-9-]+?)(?=\/|\s|["'`]|$)/g;
  for (const lit of classLists) {
    for (const m of lit.text.matchAll(TOKEN_UTILITY)) {
      if (!themeColors.has(m[1])) {
        fail(file, lineOf(src, lit.index), "stale-utility", `\`${m[0].trim()}\` resolves through --color-${m[1]}, which globals.css does not define`);
      }
    }
  }

  for (const lit of classLists) {
    const line = lineOf(src, lit.index);
    // A template literal's body is captured whole, `${…}` expressions and the
    // nested `"…"` branches of their ternaries included, so a naive whitespace
    // split yields tokens with quote/brace/comma debris glued on:
    // `"bg-ns-accent/[0.16]` and `hover:bg-ns-accent/[0.24]"`. That debris is
    // not cosmetic — an opacity suffix matcher anchored with `$` silently
    // failed on the trailing quote, read `bg-ns-accent/[0.24]"` as a SOLID
    // fill, and false-accused seatmap-ascii-pick and context-prompt-shims of
    // an invisible focus ring they do not have. Strip quotes, braces, parens
    // and commas — never `]`, which is the tail of every arbitrary value.
    const tokens = lit.text
      .split(/\s+/)
      .map((t) => t.replace(/^[`"'{(,]+/, "").replace(/[`"'}),;]+$/, ""))
      .filter(Boolean);
    const has = (re: RegExp) => tokens.some((t) => re.test(t));

    // -----------------------------------------------------------------------
    // CHECK outline-trap — wiki/tailwind_outline_none_focus_visible_trap.md.
    // Tailwind v4's `outline-none` sets `--tw-outline-style: none`; a later
    // `focus-visible:outline-2` only sets width/colour, so the ring never
    // paints while every class in the DOM inspector reads correct.
    // -----------------------------------------------------------------------
    const baseOutlineNone = tokens.some((t) => t === "outline-none" || t === "outline-hidden");
    // …unless the focus rule sets a STYLE again. `focus-visible:outline` (bare)
    // and `focus-visible:outline-solid|dashed|dotted|double` each rewrite
    // `--tw-outline-style`, so the ring does paint — gallery-coverflow-caustic
    // and sparkline-automaton both do this deliberately and were accused of a
    // defect they had already worked around.
    const styleRestored = has(/^focus(-visible)?:outline$/) || has(/^focus(-visible)?:outline-(solid|dashed|dotted|double)$/);
    if (baseOutlineNone && !styleRestored && has(/^focus(-visible)?:outline-(\d|\[)/)) {
      fail(file, line, "outline-trap", "base `outline-none` kills the `focus-visible:outline-*` ring on the same element (--tw-outline-style stays none)");
    }

    // -----------------------------------------------------------------------
    // CHECK focus-ring-contrast — a focus ring painted in the same colour as
    // the element it rings. On the selected accent-filled chip the ring was
    // literally invisible; both themes screenshot as "a focus state exists"
    // because SOMETHING changed. An offset (or a differently-coloured ring)
    // is what makes it perceptible.
    // -----------------------------------------------------------------------
    // A LOW-OPACITY tint of the ring colour is not this defect: `bg-ns-accent/10`
    // behind a solid `ring-ns-accent` has ample contrast, and accusing it was
    // wrong on 3 of the first 5 hits (a 5% row tint, a 10% chip, a 16% seat).
    // Only a near-solid fill of the ring's own colour hides the ring.
    const bgOpacity = (t: string) => {
      const m = /\/(?:\[(0?\.\d+|\d+)%?\]|(\d+))$/.exec(t);
      if (!m) return 100;
      if (m[2] !== undefined) return Number(m[2]);
      return t.includes("%") ? Number(m[1]) : Number(m[1]) * 100;
    };
    for (const colour of ["ns-accent", "foreground", "background", "surface", "error"]) {
      const fill = tokens.find((t) => new RegExp(`^(hover:|dark:)?bg-${colour}(/.+)?$`).test(t));
      const filled = fill !== undefined && bgOpacity(fill) >= 60;
      const ringed = has(new RegExp(`^(focus|focus-visible):ring-${colour}(/|$)`));
      const outlined = has(new RegExp(`^(focus|focus-visible):outline-${colour}(/|$)`));
      const offset = has(/^(focus|focus-visible)?:?(ring-offset|outline-offset)-/);
      if (filled && (ringed || outlined) && !offset) {
        fail(file, line, "focus-ring-contrast", `focus ring is \`${colour}\` on a \`bg-${colour}\` element with no ring-offset/outline-offset — no perceptible focus indicator`);
      }
    }

    // -----------------------------------------------------------------------
    // CHECK disabled-hover — a disabled control that still reacts to the
    // mouse. `disabled:opacity-*` says "inert"; an unguarded `hover:*` on the
    // same element contradicts it, and a mid-submit button visibly lights up
    // under the cursor. Guarded forms the repo already uses count as fixed:
    // `disabled:pointer-events-none`, `hover:enabled:*`, `disabled:hover:*`.
    // -----------------------------------------------------------------------
    const disabledDim = has(/^(disabled|aria-disabled):opacity-/);
    const liveHover = tokens.some((t) => /^(hover|aria-disabled:hover|disabled:hover):/.test(t) && /^hover:/.test(t) && !/^hover:(enabled|not-disabled):/.test(t));
    const hoverGuarded =
      has(/^(disabled|aria-disabled):pointer-events-none$/) ||
      has(/^(disabled|aria-disabled):hover:/);
    if (disabledDim && liveHover && !hoverGuarded) {
      fail(file, line, "disabled-hover", "`disabled:opacity-*` with an unguarded `hover:*` — the inert control still reacts to the mouse (add `disabled:pointer-events-none`, or scope the hover with `hover:enabled:`)");
    }

    // -----------------------------------------------------------------------
    // CHECK motion-guard — a bare `animate-*` ignores prefers-reduced-motion.
    // Every other animation in the repo is either `motion-safe:`-prefixed or
    // paired with a `motion-reduce:` off-switch; the one that wasn't was a
    // loading skeleton, i.e. exactly the long-running pulse a reduced-motion
    // user asked not to see.
    // -----------------------------------------------------------------------
    // The guard is legitimately one level UP: site-shell's animated trace span
    // sits inside a parent carrying `motion-reduce:hidden`, so the whole
    // subtree is gone under reduced motion and the child needs no prefix of
    // its own. Asking only the element's own class list false-accused it.
    const owner = tagAt(lit.index);
    const guardedAbove =
      owner >= 0 &&
      ancestorsOf(tags, owner).some((a) => /motion-reduce:(hidden|animate-none)\b/.test(a.attrs));
    for (const t of tokens) {
      if (!/^animate-/.test(t) || t === "animate-none") continue;
      // `motion-reduce:hidden` on the animating element itself is the same
      // guard as on its parent — the element is gone, so nothing moves.
      const guarded =
        has(/^motion-reduce:(animate-none|hidden)$/) || has(/^motion-safe:animate-/) || guardedAbove;
      if (!guarded) {
        fail(file, line, "motion-guard", `\`${t}\` runs under prefers-reduced-motion — prefix it \`motion-safe:\` or pair it with \`motion-reduce:animate-none\``);
      }
    }

    // -----------------------------------------------------------------------
    // CHECK transition-property — an arbitrary `transition-[a,b]` list that
    // omits a property a utility on the SAME element animates. The back-to-top
    // button's hover colour snapped instantly because `color` was missing from
    // its list, and a popover vanished in one frame because `visibility` was.
    // -----------------------------------------------------------------------
    const arb = tokens.find((t) => /^transition-\[/.test(t));
    if (arb) {
      const listed = arb.slice(arb.indexOf("[") + 1, arb.lastIndexOf("]")).split(",").map((s) => s.trim());
      const covers = (prop: string) => listed.some((l) => l === "all" || l === prop);
      // Triggers are POINTER/KEYBOARD feedback only. An `aria-disabled:opacity-45`
      // is a discrete state flip, not feedback that reads as broken when it
      // snaps — confirm-hold-wax's seal button was accused for exactly that,
      // and "the disabled dim appears instantly" is not a defect.
      const needs: [RegExp, string, string][] = [
        [/^(hover|focus|focus-visible|group-hover):text-(?!\[?\d|xs|sm|base|lg|xl|\dxl)/, "color", "a hover/focus text-colour utility"],
        [/^(hover|focus|focus-visible|group-hover):border-(?!\[?\d|[xytblrse]?-?\d)/, "border-color", "a hover/focus border-colour utility"],
        [/^(hover|focus|focus-visible|group-hover):bg-(?!\[?\d)/, "background-color", "a hover/focus background utility"],
        [/^(hover|focus|focus-visible|group-hover):(scale|translate|rotate)-/, "transform", "a hover/focus transform utility"],
        [/^(hover|focus|focus-visible|group-hover):opacity-/, "opacity", "a hover/focus opacity utility"],
        [/^(hover|focus|focus-visible|group-hover):(visible|invisible)$/, "visibility", "a hover/focus visibility utility"],
      ];
      for (const [trigger, prop, why] of needs) {
        if (has(trigger) && !covers(prop)) {
          fail(file, line, "transition-property", `\`${arb}\` omits \`${prop}\` but the element has ${why} — that change snaps instead of animating`);
        }
      }
    }

    // -----------------------------------------------------------------------
    // CHECK hover-transition — a hover COLOUR change with no `transition-*` on
    // the same element. The defect this exists for is drift inside one control
    // family: sidebar component rows faded over 150ms while the category
    // headers and footer links beside them snapped instantly, so the sidebar
    // had three different hover speeds and no screenshot could show it.
    //
    // SCOPED TO `app/**` on purpose. The site chrome is one design system and
    // an instant hover there is always drift. `registry/**` is 228 independent
    // interaction studies where a deliberately instant hover is a legitimate
    // authored choice, so applying this there would be ~200 false accusations
    // — the failure mode that gets a gate deleted.
    // -----------------------------------------------------------------------
    if (relative(ROOT, file).startsWith("app/")) {
      const HOVER_COLOUR =
        /^(hover|group-hover):(bg-|border-(?![xytblrse]?-?\[?\d)|text-(?!\[?\d|xs$|sm$|base$|lg$|xl$|\dxl$))/;
      const hovered = tokens.find((t) => HOVER_COLOUR.test(t));
      // `transition` bare, `transition-colors`, `transition-[…]`, or a
      // `duration-*` (which implies a transition declared elsewhere on the
      // element or in a shared const) all count as "this was thought about".
      const animated = has(/^(motion-safe:)?transition(-|$)/) || has(/^duration-/);
      if (hovered && !animated) {
        fail(
          file,
          line,
          "hover-transition",
          `\`${hovered}\` changes colour on hover with no \`transition-*\` on the same element — it snaps while its siblings fade`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // JSX opening-tag scan. Attribute text only — cheap, and every check below
  // is answerable from the attributes of a single tag.
  // -------------------------------------------------------------------------
  const SCANNED_TAGS = new Set(["div", "span", "li", "td", "tr", "section", "article", "button", "a", "label", "input"]);
  for (let ti = 0; ti < tags.length; ti++) {
    const tag = tags[ti].name;
    if (!SCANNED_TAGS.has(tag)) continue;
    const { start, end, attrs } = tags[ti];
    const line = lineOf(src, start);
    const ancestors = ancestorsOf(tags, ti);

    // -----------------------------------------------------------------------
    // CHECK click-no-keyboard — an onClick on a non-interactive element with
    // no keyboard affordance. A mouse user sees a working control; a keyboard
    // user cannot reach or fire it, and verify.ts's Tab sweep passes as long
    // as SOME other control on the page is reachable.
    // -----------------------------------------------------------------------
    // A full-viewport scrim (`fixed inset-0`) is the one honest exception: it
    // is a click-away target for a layer that owns its own Escape handling and
    // close control, not a control a keyboard user is meant to reach.
    const isScrim = /fixed/.test(attrs) && /inset-0/.test(attrs);
    // Two more honest exemptions, both of which need the tag's CONTEXT and both
    // of which this check false-accused while it was a flat per-tag regex:
    //   * `aria-hidden` on the element or any ancestor — the subtree is not in
    //     the a11y tree at all. command-palette-orbit's orbiting pills are a
    //     decorative mirror of an `sr-only` listbox that IS keyboard-driven.
    //   * an interactive ANCESTOR — search-winnow's clickable row sits inside
    //     `<li role="option">` in a real combobox/listbox, and that li is the
    //     control a keyboard user operates.
    const ROLES =
      "button|link|menuitem|menuitemradio|menuitemcheckbox|option|tab|switch|checkbox|radio|treeitem|gridcell";
    // `role` is as often a conditional as a literal here — search-winnow writes
    // `role={out ? "presentation" : "option"}`, and a matcher that only read
    // `role="option"` treated that row as having no role at all.
    const INTERACTIVE_ANCESTOR = new RegExp(
      `\\brole=(?:["'](?:${ROLES})["']|\\{[^}]*["'](?:${ROLES})["'][^}]*\\})`,
    );
    const hiddenFromA11y =
      /\baria-hidden\b/.test(attrs) || ancestors.some((a) => /\baria-hidden\b/.test(a.attrs));
    const inControl = ancestors.some(
      (a) => a.name === "button" || a.name === "a" || INTERACTIVE_ANCESTOR.test(a.attrs),
    );
    // A wrapper whose whole onClick is `ref.current?.focus()` is a click-target
    // for a real control it CONTAINS (tag-input-cord's `cursor-text` field
    // body). The keyboard user reaches that control directly; there is nothing
    // extra to expose. Likewise `cursor-default` is an explicit statement that
    // the element is not presented as a control (text-card-flick's replay
    // trigger), and the defect class is "looks clickable, isn't reachable".
    const focusDelegation = /\bonClick=\{[^}]*\.focus\(\)/.test(attrs);
    const notAControl = /\bcursor-default\b/.test(attrs);
    if (
      /\bonClick=/.test(attrs) &&
      !isScrim &&
      !hiddenFromA11y &&
      !inControl &&
      !focusDelegation &&
      !notAControl &&
      !["button", "a", "input", "label"].includes(tag)
    ) {
      const keyboardOk =
        INTERACTIVE_ANCESTOR.test(attrs) ||
        /\bonKey(Down|Up|Press)=/.test(attrs) ||
        /\btabIndex=/.test(attrs);
      if (!keyboardOk) {
        fail(file, line, "click-no-keyboard", `<${tag} onClick> with no role, no tabIndex and no key handler — reachable by mouse only`);
      }
    }

    // -----------------------------------------------------------------------
    // CHECK toggle-state-colour — a selected/active state signalled by a
    // className ternary alone. Colour-only selection is invisible to a screen
    // reader (and to anyone who cannot separate the two colours); the folder
    // tabs in the saved library shipped exactly this. Any of aria-pressed /
    // aria-selected / aria-current / aria-checked satisfies it.
    // -----------------------------------------------------------------------
    if (tag === "button" || tag === "a") {
      const classAttr = attrs.match(/className=\{([\s\S]*)$/)?.[1] ?? "";
      // Scoped to ternaries whose CONDITION is about selection. A `dragging ?`
      // or `pending ?` colour swap is transient feedback, not a state a screen
      // reader has to be told; `selected ? / current ? / checked ?` is.
      const ternaryOnClass =
        /\b(selected|isSelected|current|isCurrent|checked|isChecked|chosen|active|isActive|activeTab|activeId)\b[^?{}]*\?[^?]*["'`][^"'`]*\b(bg|text|border)-[^"'`]*["'`][\s\S]*:/.test(
          classAttr,
        );
      const stateNamed = /\baria-(pressed|selected|current|checked|expanded)=/.test(attrs);
      // The state is as often named on the WRAPPER as on the control: tree-box-
      // drawing's row is `<div role="treeitem" aria-selected>` and table-heat-
      // shimmer's sort button lives under `<th aria-sort>`. Both were accused
      // of colour-only state they in fact announce correctly.
      const stateNamedAbove = ancestors.some((a) =>
        /\baria-(pressed|selected|current|checked|sort)=/.test(a.attrs),
      );
      // A highlight driven by pointer/focus with no click of its own is
      // transient feedback, not a selection: feature-grid-ascii-rule lights the
      // hovered cell and its relatives. Nothing for a screen reader to be told.
      const hoverHighlight =
        !/\bonClick=/.test(attrs) && /\bon(PointerEnter|MouseEnter|Focus)=/.test(attrs);
      if (ternaryOnClass && !stateNamed && !stateNamedAbove && !hoverHighlight) {
        fail(file, line, "toggle-state-colour", `<${tag}> picks its colours from a state ternary but exposes no aria-pressed/-selected/-current — the state is colour-only`);
      }
    }

    // -----------------------------------------------------------------------
    // CHECK icon-name — an icon-only control with no accessible name. To a
    // screen reader it announces as "button", full stop; to the screenshot
    // gate it is a perfectly good-looking 32px square. Deliberately narrow:
    // it fires ONLY when the element's entire child content is `<svg>`/`<Svg…>`
    // markup, so a control with any text (including an `sr-only` span, which
    // IS the fix) is never accused.
    // -----------------------------------------------------------------------
    if ((tag === "button" || tag === "a") && src[end - 1] !== "/") {
      const close = src.indexOf(`</${tag}>`, end);
      const inner = close < 0 ? "" : src.slice(end + 1, close).trim();
      const iconOnly =
        inner.length > 0 &&
        /^(?:<svg[\s\S]*<\/svg>|<[A-Z][\w.]*(?:Icon|Glyph|Logo|Mark)\b[^>]*\/>|\s)+$/.test(inner);
      const named =
        /\baria-label(?:ledby)?=/.test(attrs) ||
        /\btitle=/.test(attrs) ||
        // `<title>` inside the SVG is the SVG-native accessible name.
        /<title[\s>]/.test(inner);
      if (iconOnly && !named) {
        fail(file, line, "icon-name", `icon-only <${tag}> with no aria-label, title or <title> — it announces as an unnamed control`);
      }
    }

    // -----------------------------------------------------------------------
    // CHECK plural-count — a hardcoded plural noun interpolated after a count,
    // in an attribute that is READ ALOUD. The star rating announced "1 stars";
    // nothing renders differently, so no visual gate can see it. Restricted to
    // aria-label/title (screen-reader surfaces) and to a whitelist of nouns
    // that genuinely reach 1, so `${n} items` in a diagnostic string — which
    // this repo has a dozen of, none of them spoken — is out of scope.
    // -----------------------------------------------------------------------
    const COUNTABLE =
      /\$\{[^{}]{1,60}\}\s+(stars|items|components|results|saves|files|folders|matches|comments|views|likes|categories|pages|entries|days|options|steps|errors|rows|columns|tags|notes)\b/;
    for (const spoken of attrs.matchAll(/\b(aria-label|title)=\{?`([^`]*)`/g)) {
      const m = COUNTABLE.exec(spoken[2]);
      if (m) {
        fail(file, line, "plural-count", `${spoken[1]} interpolates a count straight into the plural "${m[1]}" — it reads "1 ${m[1]}" at a count of one`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // CHECK async-no-pending — a MUTATING `await fetch(...)` in a handler that
  // never sets an in-flight flag. "Add folder" was the one async submit in the
  // app without one: a double-click fired two POSTs, the second lost the race
  // and reported "That folder already exists." about the folder the first click
  // had just created. Nothing about that is visible in a screenshot, and the
  // error it produces actively misleads.
  //
  // Scoped to mutating verbs on purpose: a GET that fires twice is wasteful,
  // not wrong, and the defect class is double-SUBMIT.
  // KNOWN GAP: the flag only has to be SET somewhere in the function — this
  // cannot see whether the control is actually disabled by it, or whether an
  // early `if (pending) return` guard exists. It catches the total absence,
  // which is the shape the defect shipped in.
  // -------------------------------------------------------------------------
  // `"use client"` only: a server route handler (`app/api/**/route.ts`) also
  // POSTs upstream, and there is no click, no control and no double-submit to
  // guard there. Requiring the directive is what separates the two.
  if (!isCss && relative(ROOT, file).startsWith("app/") && /^\s*["']use client["']/m.test(src)) {
    // Span of every `async` function body, so "the same function" is a real
    // range rather than a line window.
    const spans: [number, number][] = [];
    for (const a of src.matchAll(/\basync\b/g)) {
      const open = src.indexOf("{", a.index);
      if (open < 0) continue;
      let depth = 0;
      for (let i = open; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}" && --depth === 0) {
          spans.push([open, i]);
          break;
        }
      }
    }
    const PENDING_SETTER =
      /\b(set[A-Z]\w*(Pending|Busy|Saving|Creating|Loading|Submitting|Sending|Deleting|Working|InFlight)|setPending|setBusy|setSaving|setCreating|setLoading|setSubmitting|startTransition)\s*\(/;
    for (const f of src.matchAll(/await\s+fetch\(/g)) {
      const call = src.slice(f.index, f.index + 400);
      if (!/method:\s*["'](POST|PUT|PATCH|DELETE)["']/.test(call)) continue;
      // innermost enclosing async function first, then outwards: a guard set by
      // the caller of an inner helper still guards the submit.
      const enclosing = spans
        .filter(([s, e]) => s < f.index && f.index < e)
        .sort((a, b) => a[1] - a[0] - (b[1] - b[0]));
      if (!enclosing.length) continue;
      if (enclosing.some(([s, e]) => PENDING_SETTER.test(src.slice(s, e)))) continue;
      fail(
        file,
        lineOf(src, f.index),
        "async-no-pending",
        "mutating `await fetch(...)` in a handler that sets no in-flight flag — a double click fires it twice and the loser reports a bogus error",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK main-landmark — a route that skipped the page shell renders no `<main>`,
// so "skip to content" has nothing to skip to and a screen-reader user gets no
// landmark to jump into. The 228 canonical component pages shipped this way:
// the only route group on the site without one, invisible in every screenshot
// because the page looks identical either way.
//
// The landmark is as often one component down (`app/page.tsx` renders
// `<Showcase>`, which owns the `<main>`), so this resolves imports of local
// `app/**` files transitively rather than reading page.tsx alone.
// KNOWN GAP: resolution stops at `app/**` — a landmark rendered from `lib/` or
// a node_modules component would read as missing. Nothing in this repo does
// that, and the direction is a false accusation, so it is stated rather than
// worked around.
// ---------------------------------------------------------------------------
{
  const cache = new Map<string, boolean>();
  const rendersMain = (file: string, depth = 0): boolean => {
    if (cache.has(file)) return cache.get(file)!;
    cache.set(file, false); // cycle guard: an import loop must not recurse forever
    let src: string;
    try {
      src = blankComments(readFileSync(file, "utf8"));
    } catch {
      return false;
    }
    let found = /<main[\s>]/.test(src);
    if (!found && depth < 4) {
      for (const imp of src.matchAll(/from\s+["']([^"']+)["']/g)) {
        const spec = imp[1];
        const base = spec.startsWith("@/app/")
          ? join(ROOT, spec.slice(2))
          : spec.startsWith("./") || spec.startsWith("../")
            ? join(dirname(file), spec)
            : "";
        if (!base) continue;
        for (const ext of [".tsx", ".ts", "/index.tsx"]) {
          const candidate = base + ext;
          if (!relative(ROOT, candidate).startsWith("app/")) continue;
          if (files.includes(candidate) && rendersMain(candidate, depth + 1)) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    cache.set(file, found);
    return found;
  };

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (!/^app\/.*\/?page\.tsx$/.test(rel)) continue;
    // `/preview/**` is the chrome-less verification/recording fixture — a bare
    // component in an iframe, deliberately shell-less and noindex. It is the
    // one route group where a landmark would be wrong, not missing.
    if (rel.startsWith("app/preview/")) continue;
    if (!rendersMain(file)) {
      fail(file, 1, "main-landmark", `route renders no <main> landmark (nor does any app/** component it imports) — "skip to content" lands nowhere`);
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK theme-listener — repo-level. `prefers-color-scheme` read once to
// derive initial state, with nothing anywhere listening for that query to
// change, means the site claims to follow the OS theme and then stops
// following it the moment the user flips it. Asserted across the repo rather
// than per file because the one-shot readers are legitimate (the inline boot
// script in `lib/theme.ts` cannot listen — it runs before hydration); what is
// NOT legitimate is the whole app containing zero listeners.
// ---------------------------------------------------------------------------
{
  const readers: string[] = [];
  const listeners: string[] = [];
  for (const file of files) {
    // SCOPED TO THE SITE (`app/**`, `lib/**`). Two registry components
    // (countdown-vapor-digits, hero-chart-recorder) read the query AND listen
    // for their own reasons, and while they were counted the repo-wide form of
    // this check could not fail even with every site listener deleted —
    // measured: injecting exactly that defect left the gate green. A component
    // following the OS theme says nothing about whether the site does.
    const rel = relative(ROOT, file);
    if (!rel.startsWith("app/") && !rel.startsWith("lib/")) continue;
    const src = blankComments(readFileSync(file, "utf8"));
    if (!/matchMedia\(\s*["'`]\(prefers-color-scheme/.test(src)) continue;
    readers.push(rel);
    if (/addEventListener\(\s*["'`]change["'`]|\.addListener\(/.test(src)) listeners.push(relative(ROOT, file));
  }
  if (readers.length && !listeners.length) {
    fail(
      join(ROOT, readers[0]),
      1,
      "theme-listener",
      `${readers.length} site file(s) read \`prefers-color-scheme\` but nothing in app/ or lib/ listens for it changing — the OS theme is followed at load and never again`,
    );
  }
}

// ---------------------------------------------------------------------------
// Summary. One fixed line shape per problem, like verify.ts, so a grep tuned
// for one check cannot silently drop another.
// ---------------------------------------------------------------------------
const byCheck = new Map<string, number>();
for (const p of problems) byCheck.set(p.check, (byCheck.get(p.check) ?? 0) + 1);

console.log("");
console.log("================ SOURCE INVARIANTS SUMMARY ================");
console.log(`files scanned: ${files.length}`);
console.log(`problems found: ${problems.length}`);
for (const p of problems) console.log(`FAIL ${p.file}:${p.line} ${p.check}: ${p.message}`);
if (problems.length) {
  console.log("");
  for (const [check, n] of [...byCheck].sort((a, b) => b[1] - a[1])) console.log(`  ${check}: ${n}`);
}
console.log(problems.length ? `GATE: FAIL ${problems.length} problems` : "source invariants: pass");
console.log("==========================================================");

if (problems.length) process.exit(1);
