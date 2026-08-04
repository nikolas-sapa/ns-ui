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
const registry = (await import("../registry.json", { with: { type: "json" } })).default;

// The reachability invariant: every published component sits in at least one
// clickable category page. `categoryPages()` only satisfies it because of the
// `other` catch-all — drop that and this fails with the orphan list.
const pages = categoryPages();
const reachable = new Set(pages.flatMap((p) => p.members.map((m) => m.name)));
const unreachable = registry.items.map((i: { name: string }) => i.name).filter((n: string) => !reachable.has(n));
assert.deepEqual(unreachable, [], `components in zero categories: ${unreachable.join(", ")}`);

// id/label must stay verbatim identical to `lib/nav-data.ts`, or tree, chips
// and `/categories/<id>` disagree about the same bucket.
const other = pages.find((p) => p.id === "other");
assert.ok(other, "no `other` page — the catch-all regressed");
assert.equal(other.label, "Other");

console.log(
  `category coverage: pass (${registry.items.length} reachable, ${other.members.length} in Other)`,
);
