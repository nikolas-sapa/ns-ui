// Regenerates lib/component-order.json — every component slug sorted newest
// first by git creation date (the first commit that added its meta.json).
//
//   npx tsx scripts/build-order.ts   (or: npm run order:build)
//
// The result is COMMITTED, not regenerated at build time: git history on a
// Vercel shallow clone is unreliable, so the committed snapshot is the source
// of truth the site ships. Re-run this locally after adding components. A slug
// missing from the snapshot sorts last in the grid (visible, not hidden), so a
// stale snapshot degrades gracefully rather than dropping a component.
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const exists = (slug: string) =>
  existsSync(join(root, "registry/core", slug)) ||
  existsSync(join(root, "registry/loud", slug));

const log = execFileSync(
  "git",
  [
    "log",
    "--reverse",
    "--diff-filter=A",
    "--format=C%ct",
    "--name-only",
    "--",
    "registry/core/*/meta.json",
    "registry/loud/*/meta.json",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

let ts = 0;
const created = new Map<string, number>();
for (const line of log.split("\n")) {
  const l = line.trim();
  if (/^C\d+$/.test(l)) ts = Number(l.slice(1));
  else {
    const m = l.match(/^registry\/(?:core|loud)\/([^/]+)\/meta\.json$/);
    if (m && !created.has(m[1])) created.set(m[1], ts); // first add = creation
  }
}

const ordered = [...created.entries()]
  .filter(([slug]) => exists(slug))
  .sort((a, b) => b[1] - a[1])
  .map(([slug]) => slug);

// Guard: if git handed back fewer slugs than exist on disk (shallow clone),
// keep the committed file rather than shipping a truncated order.
const onDisk = ["core", "loud"].flatMap((c) =>
  readdirSync(join(root, "registry", c)),
);
if (ordered.length < onDisk.length) {
  console.error(
    `build-order: git yielded ${ordered.length} of ${onDisk.length} components — refusing to overwrite. Run with full history.`,
  );
  process.exit(1);
}

writeFileSync(
  join(root, "lib/component-order.json"),
  JSON.stringify(ordered, null, 0) + "\n",
);
console.log(
  `component-order.json: ${ordered.length} components, newest = ${ordered[0]}`,
);
