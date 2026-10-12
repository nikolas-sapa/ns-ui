import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type WritingPost = {
  slug: string;
  title: string;
  description: string;
  /** ISO date, e.g. "2026-07-29" */
  iso: string;
  /**
   * Optional ISO date for a substantive revision, from an `updated:` key in
   * frontmatter. Undefined when the key is absent, which is the normal case —
   * it drives `dateModified` in the post's JSON-LD and a visible "Updated"
   * line, and both stay off rather than claiming a revision that never
   * happened. A file mtime would be a checkout artifact, not an edit date,
   * so it is deliberately NOT a fallback.
   */
  updated?: string;
  /** Markdown body, frontmatter stripped. */
  body: string;
};

const WRITING_DIR = path.join(process.cwd(), "content/writing");

/**
 * Frontmatter is three required keys plus one optional `updated:`, one per
 * line — no YAML library needed for
 * a format this small. Same "one regex wide" philosophy as
 * app/changelog/entries.ts: the grammar is deliberately narrow because there
 * is exactly one author writing these files.
 */
function parseWriting(slug: string, raw: string): WritingPost {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error(`content/writing/${slug}.md is missing frontmatter`);
  }
  const [, frontmatter, body] = match;

  const field = (key: string) => {
    const line = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(frontmatter);
    return line?.[1].trim().replace(/^"(.*)"$/, "$1") ?? "";
  };

  // `field` returns "" for an absent key; collapse that to undefined so the
  // optional date is either a real date or nothing at all.
  const updated = field("updated") || undefined;

  return {
    slug,
    title: field("title"),
    description: field("description"),
    iso: field("date"),
    ...(updated ? { updated } : {}),
    body: body.trim(),
  };
}

/** All posts, newest first. */
export function loadWritingPosts(): WritingPost[] {
  const files = readdirSync(WRITING_DIR).filter((f) => f.endsWith(".md"));
  return files
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const raw = readFileSync(path.join(WRITING_DIR, file), "utf8");
      return parseWriting(slug, raw);
    })
    .sort((a, b) => b.iso.localeCompare(a.iso));
}

export function loadWritingPost(slug: string): WritingPost | null {
  return loadWritingPosts().find((p) => p.slug === slug) ?? null;
}
