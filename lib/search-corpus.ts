import registry from "@/registry.json";
import { loadUseWhen } from "@/lib/use-when";

/**
 * The half of the catalog's search haystack that nothing on screen ever
 * renders: `meta.tags`, `useWhen`, and the lead sentence of
 * `meta.instruction`.
 *
 * It lives here, behind `/search-index.json`, rather than travelling as props
 * to `<Showcase>`. Measured on the built homepage: as props it was 300.7 KB
 * of the document (`description` 139.6 + this corpus 161.1), serialized into
 * the inline RSC flight payload for all 534 components so that a visitor who
 * never types a character still downloads and parses every word of it.
 * `description` has to stay in props — every card renders it — but this does
 * not, and it is fetched on the first sign of an actual search instead.
 *
 * The precedent this is correcting: c087b749 stopped instruction prose
 * reaching the browser through a JS chunk and verified that by grepping
 * `.next/static/chunks`. The prose moved into the flight payload in the HTML,
 * which that grep never looked at. Bytes that move between transports have
 * not gone anywhere — the check that matters is the size of the built
 * document.
 */
export type SearchCorpus = Record<string, string>;

/** The lead sentence carries the component's job; the rest is build detail. */
const firstSentence = (text: string) => text.split(/(?<=\.)\s/, 1)[0] ?? "";

/**
 * `useWhen` is written as "use for X, not Y" — and the Y half made searching
 * lie: button-glass says "not a destructive action needing deliberate
 * confirmation", so it surfaced for "confirm". The negative clause is guidance
 * for a reader, never a match target, so it is dropped here.
 */
const dropNegatives = (text: string) => text.replace(/,\s*not\b[^.;]*/g, "");

/**
 * One pre-lowercased, pre-joined string per component. A string rather than
 * `{ tags: string[], prose: string }` on purpose: the client only ever
 * substring-scans it, so the array's quotes and commas are pure wire cost,
 * and the join/`toLowerCase()` pass moves to build time.
 */
export function buildSearchCorpus(): SearchCorpus {
  const useWhen = loadUseWhen();
  const out: SearchCorpus = {};
  for (const item of registry.items) {
    const tags = (item.meta?.tags ?? []).join(" ");
    const prose = dropNegatives(
      `${useWhen[item.name] ?? ""} ${firstSentence(item.meta?.instruction ?? "")}`,
    ).trim();
    out[item.name] = `${tags} ${prose}`.trim().toLowerCase();
  }
  return out;
}
