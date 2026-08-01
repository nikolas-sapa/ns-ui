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
//
// Rename handling: a folder rename (`git mv`) makes meta.json's path change,
// so a plain `--diff-filter=A` query sees no "Added" event for the new path
// and yields nothing — this happened for real in commit 29b5364, which
// renamed 222 of 223 components in one commit. To survive that, the query
// below uses `--diff-filter=AR -M` and reads BOTH additions and renames
// (`R100 <old> <new>`), then walks each current path's rename chain backward
// (new -> old -> older ...) until it hits a path that was actually Added,
// and uses that commit's timestamp as the creation date. A component renamed
// any number of times still resolves to its original creation date.
//
// Two components can share a creation timestamp (added in the same commit).
// Ties are broken by `seq`, the order paths were listed in that commit by
// git itself (alphabetical by the ORIGINAL path, at the time it was added) —
// the same tie-break the pre-rename script produced implicitly via Map
// insertion order. Sorting slugs by readdir/alphabetical-by-NEW-name would
// silently reshuffle same-commit ties after any rename, so `seq` is carried
// through the rename chain alongside the timestamp.
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
    "--diff-filter=AR",
    "-M",
    "--format=C%ct",
    "--name-status",
    "--",
    "registry/core/*/meta.json",
    "registry/loud/*/meta.json",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

let ts = 0;
let seq = 0;
const added = new Map<string, { ts: number; seq: number }>(); // path -> its "A" event
const renamedFrom = new Map<string, string>(); // new path -> old path
for (const line of log.split("\n")) {
  const l = line.trim();
  if (/^C\d+$/.test(l)) {
    ts = Number(l.slice(1));
    continue;
  }
  const add = l.match(/^A\t(.+)$/);
  if (add) {
    if (!added.has(add[1])) added.set(add[1], { ts, seq: seq++ }); // first add = creation
    continue;
  }
  const ren = l.match(/^R\d+\t(.+)\t(.+)$/);
  if (ren) renamedFrom.set(ren[2], ren[1]); // most recent rename into this path wins
}

// Walk a path's rename chain back to the commit that actually added it.
function creationInfo(path: string): { ts: number; seq: number } | undefined {
  const seen = new Set<string>();
  let p = path;
  while (!added.has(p)) {
    if (seen.has(p) || !renamedFrom.has(p)) return undefined; // cycle or dead end
    seen.add(p);
    p = renamedFrom.get(p)!;
  }
  return added.get(p);
}

const created = new Map<string, { ts: number; seq: number }>(); // slug -> creation info
for (const cls of ["core", "loud"] as const) {
  for (const slug of readdirSync(join(root, "registry", cls))) {
    const info = creationInfo(`registry/${cls}/${slug}/meta.json`);
    if (info) created.set(slug, info);
  }
}

const ordered = [...created.entries()]
  .filter(([slug]) => exists(slug))
  .sort((a, b) => b[1].ts - a[1].ts || a[1].seq - b[1].seq)
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
