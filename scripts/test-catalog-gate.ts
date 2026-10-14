// Pins lib/catalog-gate.ts's inline CATALOG_GATE_SCRIPT to the "is anything
// filtered" and "is non-default sort active" state predicate in
// app/_components/showcase.tsx:548.
//
// The pre-hydration gate runs in <head> before React mounts and adds
// `catalog-filtered` and `catalog-sorted` to document.documentElement so
// app/globals.css can hide the Featured rail and catalog heading on the
// first paint for filtered URLs. The script duplicates the logic in
// showcase.tsx; this test ensures both implementations stay identical across
// all expected URL permutations.
import vm from "node:vm";
import assert from "node:assert/strict";
import { CATALOG_GATE_SCRIPT } from "../lib/catalog-gate.ts";

/**
 * The reference predicate from app/_components/showcase.tsx.
 *
 * In showcase.tsx:
 * - filter defaults to "all", set to "core" | "loud" from ?collection=
 * - newOnly defaults to false, set to true from ?new=1
 * - category defaults to null, set from ?category=
 * - query defaults to "", set from ?q=
 * - sort defaults to "featured", set to "newest" | "oldest" from ?sort=
 *
 * State predicate:
 *   filtered = filter !== "all" || newOnly || category !== null || query !== ""
 *   sorted = sort !== "featured"
 */
function showcasePredicate(search: string) {
  const p = new URLSearchParams(search);

  const collection = p.get("collection");
  const filter = collection === "core" || collection === "loud" ? collection : "all";

  const newOnly = p.get("new") === "1";

  const categoryParam = p.get("category");
  const category = categoryParam ? categoryParam : null;

  const query = p.get("q") || "";

  const sortParam = p.get("sort");
  const sort = sortParam === "newest" || sortParam === "oldest" ? sortParam : "featured";

  const filtered = filter !== "all" || newOnly || category !== null || query !== "";
  const sorted = sort !== "featured";

  return { filtered, sorted };
}

/**
 * Runs the gate script in a strict VM sandbox.
 *
 * Gotcha: CATALOG_GATE_SCRIPT is wrapped in try {} catch (e) {} so errors are
 * silently ignored in browsers. To ensure missing globals or unexpected errors
 * in the script fail the test rather than get swallowed, we unwrap the catch
 * block to rethrow in strict mode.
 */
function runGate(search: string, { strict = true } = {}) {
  const classes = new Set<string>();
  let searchRead = false;
  let classListAccessed = false;

  const sandbox: Record<string, unknown> = {
    URLSearchParams,
    window: {
      location: {
        get search() {
          searchRead = true;
          return search;
        },
      },
    },
    document: {
      documentElement: {
        get classList() {
          classListAccessed = true;
          return {
            add(...names: string[]) {
              for (const name of names) classes.add(name);
            },
          };
        },
      },
    },
  };
  (sandbox.window as Record<string, unknown>).window = sandbox.window;
  (sandbox.window as Record<string, unknown>).document = sandbox.document;
  (sandbox.window as Record<string, unknown>).URLSearchParams = URLSearchParams;

  vm.createContext(sandbox);

  const scriptSource = strict
    ? CATALOG_GATE_SCRIPT.replace("catch(e){}", "catch(e){throw e;}")
    : CATALOG_GATE_SCRIPT;

  new vm.Script(scriptSource).runInContext(sandbox);

  assert.ok(searchRead, `window.location.search was not read for ${JSON.stringify(search)}`);
  assert.ok(classListAccessed, `document.documentElement.classList was not accessed for ${JSON.stringify(search)}`);

  return classes;
}

// Test cases covering the full matrix of URL permutations
const cases: { name: string; search: string }[] = [
  { name: "empty / nothing set", search: "" },
  { name: "collection=core", search: "?collection=core" },
  { name: "collection=loud", search: "?collection=loud" },
  { name: "bogus collection=xyz (not filtered)", search: "?collection=xyz" },
  { name: "new=1 (filtered)", search: "?new=1" },
  { name: "new=0 (not filtered)", search: "?new=0" },
  { name: "new=bogus (not filtered)", search: "?new=true" },
  { name: "category=heroes", search: "?category=heroes" },
  { name: "empty category=?category= (not filtered)", search: "?category=" },
  { name: "query=glass", search: "?q=glass" },
  { name: "empty query=?q= (not filtered)", search: "?q=" },
  { name: "sort=newest alone (sets catalog-sorted, not catalog-filtered)", search: "?sort=newest" },
  { name: "sort=oldest alone (sets catalog-sorted, not catalog-filtered)", search: "?sort=oldest" },
  { name: "sort=featured alone (neither class)", search: "?sort=featured" },
  { name: "bogus sort=?sort=custom (neither class)", search: "?sort=custom" },
  { name: "combined filtered and sorted (?collection=core&sort=newest)", search: "?collection=core&sort=newest" },
  { name: "combined query and category (?q=card&category=components)", search: "?q=card&category=components" },
];

for (const tc of cases) {
  const expected = showcasePredicate(tc.search);

  // 1. Verify strict execution (errors re-thrown if any global is missing)
  const strictClasses = runGate(tc.search, { strict: true });
  assert.equal(
    strictClasses.has("catalog-filtered"),
    expected.filtered,
    `[strict] ${tc.name} (${tc.search}): expected catalog-filtered=${expected.filtered}, got=${strictClasses.has("catalog-filtered")}`
  );
  assert.equal(
    strictClasses.has("catalog-sorted"),
    expected.sorted,
    `[strict] ${tc.name} (${tc.search}): expected catalog-sorted=${expected.sorted}, got=${strictClasses.has("catalog-sorted")}`
  );

  // 2. Verify shipped CATALOG_GATE_SCRIPT verbatim
  const shippedClasses = runGate(tc.search, { strict: false });
  assert.equal(
    shippedClasses.has("catalog-filtered"),
    expected.filtered,
    `[shipped] ${tc.name} (${tc.search}): expected catalog-filtered=${expected.filtered}, got=${shippedClasses.has("catalog-filtered")}`
  );
  assert.equal(
    shippedClasses.has("catalog-sorted"),
    expected.sorted,
    `[shipped] ${tc.name} (${tc.search}): expected catalog-sorted=${expected.sorted}, got=${shippedClasses.has("catalog-sorted")}`
  );
}

// Ensure the sandbox throws if a global is missing in strict mode
assert.throws(() => {
  const brokenSandbox = {
    // Missing document and URLSearchParams
    window: { location: { search: "?new=1" } },
  };
  vm.createContext(brokenSandbox);
  const strict = CATALOG_GATE_SCRIPT.replace("catch(e){}", "catch(e){throw e;}");
  new vm.Script(strict).runInContext(brokenSandbox);
}, /ReferenceError/);

console.log(`PASS test:catalog-gate (${cases.length} cases checked against showcase predicate)`);
