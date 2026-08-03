// Regenerates lib/contributors.generated.json — component slug -> the GitHub
// login of whoever authored the commit that first added it, read from merged
// git history at build time (docs/community-spec.md §8.1, Phase B). NOT read
// from Convex: this is public git history, not account data, and it credits
// contributors who never created an account on the site (§6.7).
//
//   node scripts/build-contributors.ts   (chained into `npm run registry:build`)
//
// The result is GITIGNORED, unlike lib/component-order.json — the spec calls
// for it explicitly ("gitignored like its siblings", i.e. autoplay.generated
// .json / card-frame.generated.json), so a slug's credit is whatever the
// clone's history yields at build time.
//
// That is a real tradeoff, inherited on purpose rather than by accident:
// build-order.ts is committed precisely because Vercel's shallow clone makes
// git history unreliable, and IT exits non-zero when git yields less than
// the full component count. This script cannot do that: it runs inside
// `registry:build`, which is `pretypecheck`/`predev`/`preverify`/`build`, so
// a hard failure here breaks typecheck for everyone on a shallow clone or a
// tarball with no `.git` at all. Degrading to a missing/empty credit line is
// correct; breaking the build is not. If a future change makes this data
// load-bearing rather than cosmetic, reconsider committing it like
// component-order.json instead of relaxing this guard.
//
// Rename handling is the same proven shape as build-order.ts: a folder rename
// (`git mv`, e.g. the 222-slug rename in commit 29b5364) makes a plain
// `--diff-filter=A` query see no "Added" event for the new path. The fix is
// identical — walk `git log --diff-filter=AR -M --name-status`'s rename chain
// (new path -> old path -> older...) back to the commit that actually added
// the file, and credit THAT commit's author, not the renaming commit's.
// Without this, the rename commit's author would get credit for the entire
// registry, and with today's single-author history that bug is invisible in
// testing — it only shows up once a second contributor exists.
//
// Login resolution, in order:
//   1. A GitHub-noreply commit email (`<login>@users.noreply.github.com` or
//      the legacy `<id>+<login>@users.noreply.github.com`) — the only login
//      derivable offline, with no GitHub API call and no new dependency.
//   2. EMAIL_LOGIN_ALIASES below, a small committed table for contributors
//      whose commit email isn't a GitHub noreply address (this repo's own
//      history is entirely Apple private-relay addresses, which resolve to
//      nobody without one).
// A commit whose email resolves to neither is a WARNING and the slug is
// OMITTED from the map, matching build-llms.ts's documented convention
// (AGENTS.md, prop-extraction section) of a loud warning over a silent guess
// or a dropped-but-unremarked entry. Never fall back to the commit author's
// display NAME as if it were a login — §8.1 renders this value as a GitHub
// login (plain text, or a /u/<handle> link), and a name is neither.
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ContributorMap } from "../lib/contributors.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Commit-email -> GitHub login, for contributors whose commit email is not a
// GitHub noreply address. Add an entry here rather than guessing from the
// author name. Verified against package.json's `repository.url`
// (github.com/nikolas-sapa/ns-ui), not assumed.
const EMAIL_LOGIN_ALIASES: Record<string, string> = {
  "84yk8btb9f@privaterelay.appleid.com": "nikolas-sapa",
};

function loginFromEmail(email: string): string | null {
  const noreply = email.match(/^(?:\d+\+)?([a-zA-Z0-9-]+)@users\.noreply\.github\.com$/i);
  if (noreply) return noreply[1];
  return EMAIL_LOGIN_ALIASES[email.toLowerCase()] ?? null;
}

function buildFallback(): void {
  writeFileSync(join(ROOT, "lib", "contributors.generated.json"), "{}\n");
  console.log("contributors.generated.json: 0 entries (fallback — see warning above)");
}

let log: string;
try {
  log = execFileSync(
    "git",
    [
      "log",
      "--reverse",
      "--diff-filter=AR",
      "-M",
      "--format=C%H\x1f%an\x1f%ae",
      "--name-status",
      "--",
      "registry/core/*/meta.json",
      "registry/loud/*/meta.json",
    ],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
} catch (err) {
  console.error(
    `build-contributors: WARNING — git log failed (${(err as Error).message}); ` +
      `writing an empty map rather than failing the build.`,
  );
  buildFallback();
  process.exit(0);
}

let email = "";
const added = new Map<string, { path: string; email: string }>(); // path -> its "A" event's author
const renamedFrom = new Map<string, string>(); // new path -> old path

for (const line of log.split("\n")) {
  const l = line.trim();
  if (l.startsWith("C")) {
    const rest = l.slice(1);
    const parts = rest.split("\x1f");
    email = parts[2] ?? "";
    continue;
  }
  const add = l.match(/^A\t(.+)$/);
  if (add) {
    if (!added.has(add[1])) added.set(add[1], { path: add[1], email }); // first add = origin
    continue;
  }
  const ren = l.match(/^R\d+\t(.+)\t(.+)$/);
  if (ren) renamedFrom.set(ren[2], ren[1]); // most recent rename into this path wins
}

// Walk a path's rename chain back to the commit that actually added it.
function originEmail(path: string): string | undefined {
  const seen = new Set<string>();
  let p = path;
  while (!added.has(p)) {
    if (seen.has(p) || !renamedFrom.has(p)) return undefined; // cycle or dead end
    seen.add(p);
    p = renamedFrom.get(p)!;
  }
  return added.get(p)!.email;
}

const map: ContributorMap = {};
const unresolved: string[] = [];
let missingHistory = 0;

for (const collection of ["core", "loud"] as const) {
  const dir = join(ROOT, "registry", collection);
  if (!existsSync(dir)) continue;
  for (const slug of readdirSync(dir).sort()) {
    if (!existsSync(join(dir, slug, "meta.json"))) continue;
    const originAddr = originEmail(`registry/${collection}/${slug}/meta.json`);
    if (!originAddr) {
      missingHistory++;
      continue; // shallow clone or untracked file — degrade silently, not a WARNING per-slug
    }
    const login = loginFromEmail(originAddr);
    if (!login) {
      unresolved.push(slug);
      continue;
    }
    map[slug] = login;
  }
}

if (unresolved.length) {
  console.warn(
    `build-contributors: WARNING — ${unresolved.length} component(s) have no resolvable ` +
      `GitHub login (no noreply commit email, no EMAIL_LOGIN_ALIASES entry) and were ` +
      `omitted from the credit map: ${unresolved.join(", ")}`,
  );
}
if (missingHistory) {
  console.warn(
    `build-contributors: ${missingHistory} component(s) had no resolvable git history ` +
      `(shallow clone?) and were omitted from the credit map.`,
  );
}

writeFileSync(
  join(ROOT, "lib", "contributors.generated.json"),
  JSON.stringify(map, null, 2) + "\n",
);
console.log(
  `contributors.generated.json: ${Object.keys(map).length} of ${
    Object.keys(map).length + unresolved.length + missingHistory
  } component(s) credited`,
);
