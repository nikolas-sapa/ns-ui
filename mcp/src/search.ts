// Multi-token search over the registry snapshot. A whole-string `includes()`
// (the CLI's approach, fine for its one-word use case) returns nothing for a
// query like "cursor reactive hero" — every token here must appear somewhere
// in the component's searchable text, so word order and exact phrasing don't
// matter.
import type { ComponentEntry } from "./data.ts";

export type SearchResult = {
  name: string;
  title: string;
  description: string;
  collection: string;
  categories: string[];
  kind: string | null;
};

function haystack(c: ComponentEntry): string {
  return [
    c.name,
    c.title,
    c.description,
    c.tags.join(" "),
    c.useWhen,
  ]
    .join(" ")
    .toLowerCase();
}

/** Field a token matched in, used only to rank — most-specific field first. */
function fieldScore(c: ComponentEntry, token: string): number {
  const t = token.toLowerCase();
  if (c.name.toLowerCase().includes(t)) return 4;
  if (c.title.toLowerCase().includes(t)) return 3;
  if (c.tags.some((tag) => tag.toLowerCase().includes(t))) return 2;
  if (c.description.toLowerCase().includes(t)) return 1;
  if (c.useWhen.toLowerCase().includes(t)) return 1;
  return 0;
}

export function searchComponents(
  components: ComponentEntry[],
  query: string,
  opts: { category?: string; collection?: string; limit?: number } = {}
): { results: SearchResult[]; total: number } {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  let candidates = components;
  if (opts.collection) {
    candidates = candidates.filter((c) => c.collection === opts.collection);
  }
  if (opts.category) {
    candidates = candidates.filter((c) => c.categories.includes(opts.category!));
  }

  let scored: { c: ComponentEntry; score: number }[];
  if (tokens.length === 0) {
    scored = candidates.map((c) => ({ c, score: 0 }));
  } else {
    scored = candidates
      .map((c) => {
        const hay = haystack(c);
        const allMatch = tokens.every((t) => hay.includes(t));
        if (!allMatch) return null;
        const score = tokens.reduce((sum, t) => sum + fieldScore(c, t), 0);
        return { c, score };
      })
      .filter((x): x is { c: ComponentEntry; score: number } => x !== null);
  }

  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));

  const total = scored.length;
  const limit = opts.limit ?? 20;
  const results: SearchResult[] = scored.slice(0, limit).map(({ c }) => ({
    name: c.name,
    title: c.title,
    description: c.description,
    collection: c.collection,
    categories: c.categories,
    kind: c.kind,
  }));

  return { results, total };
}
