import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, dirname } from "node:path";

// `lib/**` uses Next's `@/` alias, which plain node doesn't know about. Ten
// lines of resolve hook beats a build step or a test runner dependency.
// ponytail: only handles the `@/` prefix — if a lib file ever picks up another
// tsconfig path alias, extend this map rather than adding a bundler.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const rel = specifier.slice(2);
      const url = pathToFileURL(join(root, /\.\w+$/.test(rel) ? rel : `${rel}.ts`)).href;
      // Next lets `lib/**` import JSON with no attribute; node requires one.
      const importAttributes = url.endsWith(".json") ? { type: "json" } : context.importAttributes;
      return { url, importAttributes, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const { categoryPages } = await import("../lib/category-pages.ts");
const { CATEGORY_COPY } = await import("../lib/category-copy.ts");
const { categorize } = await import("../lib/search-categories.ts");
const registry = (await import("../registry.json", { with: { type: "json" } })).default;

// The reachability invariant: every published component sits in at least one
// clickable category page. `categoryPages()` only satisfies it because of the
// `other` catch-all — drop that and this fails with the orphan list.
const pages = categoryPages();
const reachable = new Set(pages.flatMap((p) => p.members.map((m) => m.name)));
const unreachable = registry.items.map((i: { name: string }) => i.name).filter((n: string) => !reachable.has(n));
assert.deepEqual(unreachable, [], `components in zero categories: ${unreachable.join(", ")}`);

// The invariant that actually matters: `app/categories/[id]/page.tsx` 404s
// any id `categoryPages()` returns but `CATEGORY_COPY` doesn't cover — so a
// category can be "reachable" by this script's member count while its route
// is dead in production. Assert copy coverage directly, per id, or this test
// can pass while a page 404s (as it did for `other` before this entry).
const missingCopy = pages.map((p) => p.id).filter((id) => !CATEGORY_COPY[id]);
assert.deepEqual(
  missingCopy,
  [],
  `categories with no CATEGORY_COPY entry (their route 404s): ${missingCopy.join(", ")}`,
);

// `other` exists only while some component's tags hit no category, exactly as
// the sidebar (`lib/nav-data.ts`) omits its Other group when empty. Asserting
// it unconditionally went red the day the last orphan got a category. So
// derive the orphans independently via `categorize()` and require `other` to
// hold exactly them: present and complete when there are orphans, absent (no
// empty page in the sitemap) when there are none.
const memberships = categorize(
  registry.items.map((i: { name: string; meta?: { tags?: string[] } }) => ({ name: i.name, tags: i.meta?.tags ?? [] })),
);
const orphans = registry.items
  .map((i: { name: string }) => i.name)
  .filter((n: string) => !memberships.get(n)?.length)
  .sort();
const other = pages.find((p) => p.id === "other");
if (orphans.length) {
  assert.ok(other, `no \`other\` page — the catch-all regressed, orphaned: ${orphans.join(", ")}`);
  // id/label must stay verbatim identical to `lib/nav-data.ts`, or tree, chips
  // and `/categories/<id>` disagree about the same bucket.
  assert.equal(other.label, "Other");
  assert.deepEqual(other.members.map((m) => m.name).sort(), orphans, "`other` members differ from the orphan set");
} else {
  assert.equal(other, undefined, "`other` page emitted with zero orphans — an empty category page");
}

console.log(
  `category coverage: pass (${registry.items.length} reachable, ${orphans.length} in Other, ${pages.length} categories all have copy)`,
);
