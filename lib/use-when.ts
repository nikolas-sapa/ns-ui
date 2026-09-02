import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * `useWhen` — the one-line "pick this when…" note 23 components carry in
 * meta.json. build-registry.ts deliberately does NOT copy it into
 * registry.json (it is guidance for humans and agents, not install data), so
 * the landing page reads it off disk at build time, the same way /changelog
 * reads CHANGELOG.md. It feeds the search haystack: it is the only place the
 * registry says things like "reacts to the cursor" in plain language.
 */
let cached: Record<string, string> | null = null;

/**
 * Memoized: `/components/[name]` calls this once per page, and
 * `generateStaticParams` prerenders one page per registry item — so an
 * unmemoized scan is 534 readdir/readFileSync/JSON.parse passes over every
 * `meta.json` in the tree PER PAGE (measured: 1.7s for one pass, 534 file
 * reads, to return the single string that page needs). The sidecars cannot
 * change inside a single build or a single dev request, so the scan is done
 * once per process. Dev picks up an edited `meta.json` on the module reload
 * that a `registry/` change already triggers.
 */
export function loadUseWhen(): Record<string, string> {
  if (cached) return cached;
  const root = path.join(process.cwd(), "registry");
  const out: Record<string, string> = {};
  for (const collection of ["core", "loud"]) {
    const dir = path.join(root, collection);
    for (const name of readdirSync(dir)) {
      try {
        const meta = JSON.parse(
          readFileSync(path.join(dir, name, "meta.json"), "utf8"),
        ) as { useWhen?: string };
        if (meta.useWhen) out[name] = meta.useWhen;
      } catch {
        // a component without a readable meta.json simply has no useWhen
      }
    }
  }
  cached = out;
  return out;
}
