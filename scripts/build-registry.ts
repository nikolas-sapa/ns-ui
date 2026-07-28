// Single-source registry build: meta.json sidecars are the only authority.
// Generates registry.json from them, then runs `shadcn build` → public/r/.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRY_ORIGIN } from "../lib/registry-origin.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const items = [];
for (const collection of ["core", "loud"]) {
  const dir = join(ROOT, "registry", collection);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).sort()) {
    const metaPath = join(dir, name, "meta.json");
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    items.push({
      name: meta.name,
      type: "registry:ui",
      title: meta.title,
      description: meta.description,
      files: [
        {
          path: `registry/${collection}/${name}/component.tsx`,
          type: "registry:ui",
          target: `components/ui/${name}.tsx`,
        },
      ],
      dependencies: meta.dependencies,
      // `review` is a temporary flag for a one-off audit pass — remove this
      // whitelist entry along with the "Review" chip in showcase.tsx once
      // that pass is done.
      meta: {
        collection: meta.collection,
        tags: meta.tags,
        instruction: meta.instruction,
        review: meta.review,
      },
    });
  }
}

writeFileSync(
  join(ROOT, "registry.json"),
  JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema/registry.json",
      name: "ns-ui",
      // Single source of truth (lib/registry-origin.ts) — same origin the
      // showcase and llms.txt install commands use, so this can't drift.
      homepage: REGISTRY_ORIGIN,
      items,
    },
    null,
    2
  ) + "\n"
);
console.log(`registry.json: ${items.length} item(s) from meta sidecars`);
execFileSync("npx", ["shadcn", "build"], { cwd: ROOT, stdio: "inherit" });
