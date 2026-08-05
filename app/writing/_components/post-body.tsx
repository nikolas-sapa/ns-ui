import type { ReactNode } from "react";

/**
 * A purpose-built renderer for the small markdown subset the writing posts
 * actually use: `##`/`###` headings, paragraphs, fenced code blocks, inline
 * code and links. No markdown package in this repo (checked package.json)
 * and the subset is narrow enough that pulling one in for four block types
 * would be a bigger dependency than the parser itself.
 *
 * Blocks are separated by blank lines. Within a block, more than one line
 * means intentional separate lines (used by the sign-off block at the end of
 * a post) rather than hard-wrapped prose — every paragraph in content/writing
 * is authored as a single physical line, so a block never needs merging.
 */
export function PostBody({ markdown }: { markdown: string }) {
  return <div className="space-y-6">{parseBlocks(markdown)}</div>;
}

function parseBlocks(markdown: string): ReactNode[] {
  const lines = markdown.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-md border border-border bg-surface px-4 py-3 text-[13px] leading-relaxed"
        >
          <code className="font-mono text-foreground">{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      blocks.push(
        level === 2 ? (
          <h2 key={key++} className="!mt-12 text-xl font-semibold tracking-tight text-foreground">
            {renderInline(text)}
          </h2>
        ) : (
          <h3 key={key++} className="!mt-10 text-lg font-semibold tracking-tight text-foreground">
            {renderInline(text)}
          </h3>
        ),
      );
      i += 1;
      continue;
    }

    // Group of consecutive non-blank, non-fence, non-heading lines.
    const group: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^(#{2,3})\s+/.test(lines[i])
    ) {
      group.push(lines[i]);
      i += 1;
    }
    for (const paragraph of group) {
      blocks.push(
        <p key={key++} className="text-[17px] leading-[1.75] text-foreground/90">
          {renderInline(paragraph)}
        </p>,
      );
    }
  }

  return blocks;
}

/** Inline pass: `code spans` and [text](url) links. Never runs inside a fence. */
function renderInline(text: string): ReactNode[] {
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));

    if (m[1]) {
      nodes.push(
        <code
          key={key++}
          className="rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {m[1].slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(m[2]);
      if (link) {
        const external = link[2].startsWith("http");
        nodes.push(
          <a
            key={key++}
            href={link[2]}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="rounded-sm text-foreground underline decoration-border underline-offset-2 outline-none transition-colors hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            {link[1]}
          </a>,
        );
      }
    }

    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return nodes;
}
