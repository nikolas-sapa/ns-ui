import { readFileSync } from "node:fs";
import path from "node:path";

export type ChangelogEntry = {
  /** semver-ish milestone tag, e.g. "v0.7.0" */
  version: string;
  /** ISO date, e.g. "2026-07-21" */
  iso: string;
  /** short mono label strandline prints, e.g. "JUL 21" */
  date: string;
  title: string;
  body: string;
};

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${d}`;
}

/**
 * Parses CHANGELOG.md — the single source of truth — into entries.
 *
 * The grammar is deliberately one regex wide: a release is a
 * `## vX.Y.Z - YYYY-MM-DD` heading, a `###` title line, and the prose that
 * follows until the next `##`. Anything above the first `##` is preamble.
 * Returned newest first, the order the file is written in.
 */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const blocks = markdown.split(/^## /m).slice(1);

  for (const block of blocks) {
    const head = /^(v[\d.]+)\s+-\s+(\d{4}-\d{2}-\d{2})/.exec(block);
    if (!head) continue;
    const title = /^###\s+(.+)$/m.exec(block);
    const body = block
      .replace(/^.*$/m, "")
      .replace(/^###\s+.+$/m, "")
      .trim()
      .split(/\n{2,}/)[0]
      .replace(/\s*\n\s*/g, " ")
      .replace(/`/g, "")
      .trim();

    entries.push({
      version: head[1],
      iso: head[2],
      date: shortDate(head[2]),
      title: title?.[1].trim() ?? head[1],
      body,
    });
  }

  return entries;
}

export function loadChangelog(): ChangelogEntry[] {
  const file = path.join(process.cwd(), "CHANGELOG.md");
  return parseChangelog(readFileSync(file, "utf8"));
}
