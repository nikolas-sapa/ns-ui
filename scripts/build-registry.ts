// Single-source registry build: meta.json sidecars are the only authority.
// Generates registry.json from them, then runs `shadcn build` → public/r/.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
      meta: { collection: meta.collection, tags: meta.tags, instruction: meta.instruction },
    });
  }
}

writeFileSync(
  join(ROOT, "registry.json"),
  JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema/registry.json",
      name: "ns-ui",
      homepage: "http://localhost:3000",
      items,
    },
    null,
    2
  ) + "\n"
);
console.log(`registry.json: ${items.length} item(s) from meta sidecars`);
execFileSync("npx", ["shadcn", "build"], { cwd: ROOT, stdio: "inherit" });
