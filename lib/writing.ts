import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type WritingPost = {
  slug: string;
  title: string;
  description: string;
  /** ISO date, e.g. "2026-07-29" */
  iso: string;
  /** Markdown body, frontmatter stripped. */
  body: string;
};

const WRITING_DIR = path.join(process.cwd(), "content/writing");

/**
 * Frontmatter is three fixed keys, one per line — no YAML library needed for
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

  return {
    slug,
    title: field("title"),
    description: field("description"),
    iso: field("date"),
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
