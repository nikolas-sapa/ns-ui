/**
 * Contributor credit — the type contract for `lib/contributors.generated.json`.
 *
 * Deliberately just types here, NOT a re-export of the generated JSON: the
 * generated file is gitignored (`scripts/build-contributors.ts`), so a page
 * importing it directly would make `typecheck` depend on a file that may not
 * exist yet on a fresh clone that hasn't run `registry:build`. Read the JSON
 * at runtime instead (`readFileSync` + `JSON.parse`, or a dynamic import with
 * a fallback to `{}`), matching how `lib/autoplay.ts` / `lib/card-frame.ts`
 * separate the type from the artifact.
 *
 * Credit is derived from merged git history at build time, not from Convex —
 * it exists for contributors who never created an account on the site, and
 * it is public git history rather than data this site stores about anyone
 * (§6.7, §8.1 of docs/community-spec.md). A slug's entry is the GitHub login
 * of whoever authored the commit that first added that component; a login
 * that can't be resolved offline (no GitHub noreply commit email, no entry in
 * the alias table) is omitted rather than guessed at — see the script.
 *
 * Rendering rule for whatever consumes this (a future `/u/<handle>` reader,
 * a credit line on `/components/<name>`, etc.): link to `/u/<handle>` only
 * when a `profiles` row exists for that login AND is public; otherwise
 * render `login` as plain text. Never render a display name here — this map
 * carries logins only.
 */
export type ContributorMap = Record<string, string>; // component slug -> GitHub login
