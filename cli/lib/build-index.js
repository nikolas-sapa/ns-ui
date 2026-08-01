// Merges the two public artifacts the CLI's data layer is built on —
// registry.json (name/title/full description/dependencies/tags/collection)
// and llms.txt (use-when guidance + condensed props per component) — into
// one flat, search/list/info-ready index. Pure function: no filesystem or
// network here, so the exact same code runs at build time (over files read
// off disk, see scripts/build-cli-snapshot.mjs) and at runtime (over text
// fetched live or served from the on-disk cache, see bin/ns-ui.js). This is
// the CLI's own data path — independent of the mcp/ package and its
// registry-snapshot.json.
import { CATEGORIES, categorize, kindOf } from "./taxonomy.js";

// llms.txt blocks are separated by a blank line before each
// "## <name>  [collection]" header. Splitting on that boundary (rather than
// a lookahead for "next header") avoids `$` in multiline mode matching every
// line ending, not just the block's.
const HEADER_RE = /^## (\S+)\s+\[(\w+)]$/m;

function parseLlmsTxt(text) {
  const blocksByName = new Map();
  const rawBlocks = text.split(/\n(?=## )/).filter((b) => HEADER_RE.test(b));
  for (const raw of rawBlocks) {
    const headerMatch = raw.match(HEADER_RE);
    if (!headerMatch) continue;
    const name = headerMatch[1];
    const body = raw.slice(headerMatch[0].length);
    const useWhenMatch = body.match(/^use when: ([\s\S]*?)\n(?=props:)/m);
    const propsMatch = body.match(/^props:\n?([\s\S]*?)\n(?=deps:)/m);
    if (!useWhenMatch) continue;
    const propsRaw = propsMatch?.[1] ?? "";
    const props =
      propsRaw.trim().length > 0
        ? propsRaw
            .split("\n")
            .map((l) => l.replace(/^ {2}/, ""))
            .join("\n")
            .trim()
        : (body.match(/^props: (.+)$/m)?.[1].trim() ?? "");
    blocksByName.set(name, { useWhen: useWhenMatch[1].trim(), props });
  }
  return blocksByName;
}

/**
 * @param {{ name: string, items: Array }} registry - parsed registry.json
 * @param {string} llmsText - raw public/llms.txt (or fetched equivalent)
 * @param {string} registryOrigin
 */
export function buildIndex(registry, llmsText, registryOrigin) {
  const blocksByName = parseLlmsTxt(llmsText);
  const categoryIdsByName = categorize(
    registry.items.map((it) => ({ name: it.name, tags: it.meta.tags }))
  );

  const components = registry.items.map((item) => {
    const block = blocksByName.get(item.name);
    return {
      name: item.name,
      title: item.title,
      description: item.description,
      collection: item.meta.collection,
      tags: item.meta.tags,
      kind: kindOf(item.meta.tags),
      categories: categoryIdsByName.get(item.name) ?? [],
      useWhen: block?.useWhen ?? "",
      props: block?.props ?? "(unresolved — see the site for props)",
      dependencies: item.dependencies,
      installCommand: `npx shadcn add ${registryOrigin}/r/${item.name}.json`,
      sourcePath: `registry/${item.meta.collection}/${item.name}/component.tsx`,
    };
  });

  const categories = CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    count: components.filter((c) => c.categories.includes(cat.id)).length,
  }));

  return {
    generatedAt: new Date().toISOString(),
    registryOrigin,
    registryName: registry.name,
    collections: ["core", "loud"],
    categories,
    components,
  };
}
