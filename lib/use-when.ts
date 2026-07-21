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
export function loadUseWhen(): Record<string, string> {
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
  return out;
}
