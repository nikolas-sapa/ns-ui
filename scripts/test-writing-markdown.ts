// Writing posts are rendered by a purpose-built markdown subset parser
// (app/writing/_components/post-body.tsx), not a markdown package. That is a
// deliberate trade, but it has one failure mode nothing else catches: the
// author uses a feature the parser does not implement, and it ships as
// literal text. It is valid HTML, so the console gate sees nothing, the
// screenshot gate sees a page that renders, and typecheck sees nothing at all.
//
// It already happened. Bulleted lists, numbered lists and bold were all
// authored in content/writing/llms-txt-use-when-audit.md and shipped to
// production as paragraphs beginning "- " and "1. " with visible ** around
// the numbers.
//
// So this gate asserts the inverse of the usual direction: not "does the
// parser work" but "does the content stay inside what the parser implements".
// Add a feature to post-body.tsx -> add it to SUPPORTED here. Use a feature
// in a post that is not in SUPPORTED -> this fails with the file and line.
import assert from "node:assert/strict";
import { loadWritingPosts } from "../lib/writing.ts";

/**
 * Block and inline features app/writing/_components/post-body.tsx actually
 * implements. Keep in sync with that file — it is the whole point of this gate.
 */
const SUPPORTED = new Set([
  "heading",
  "bullet",
  "ordered",
  "bold",
  "fence",
  "inline-code",
  "link",
]);

/** Everything a post could plausibly contain, supported or not. */
const FEATURES: [string, RegExp][] = [
  ["heading", /^#{1,6}\s+\S/],
  ["bullet", /^[-*]\s+\S/],
  ["ordered", /^\d+\.\s+\S/],
  ["blockquote", /^>\s/],
  ["table", /^\|/],
  ["hr", /^(?:-{3,}|\*{3,}|_{3,})\s*$/],
  ["image", /!\[[^\]]*\]\(/],
  ["html-block", /^<[a-zA-Z]/],
  ["bold", /\*\*[^*]+\*\*/],
  ["italic", /(?<!\w)_[^_\n]+_(?!\w)/],
  ["strikethrough", /~~[^~]+~~/],
  ["footnote", /\[\^[^\]]+\]/],
  ["task-list", /^[-*]\s+\[[ xX]\]\s/],
];

type Problem = { where: string; feature: string; line: string };
const problems: Problem[] = [];
const seen = new Map<string, number>();

for (const post of loadWritingPosts()) {
  let inFence = false;
  const lines = post.body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Fences are passed through verbatim by the parser, so whatever is inside
    // one is not a markdown feature — checking it would be pure noise.
    if (line.startsWith("```")) {
      inFence = !inFence;
      seen.set("fence", (seen.get("fence") ?? 0) + 1);
      continue;
    }
    if (inFence) continue;

    for (const [feature, pattern] of FEATURES) {
      if (!pattern.test(line)) continue;
      seen.set(feature, (seen.get(feature) ?? 0) + 1);
      if (SUPPORTED.has(feature)) continue;
      problems.push({
        where: `content/writing/${post.slug}.md:${i + 1}`,
        feature,
        line: line.length > 90 ? line.slice(0, 90) + "..." : line,
      });
    }
  }
}

console.log("");
console.log("============== WRITING MARKDOWN SUMMARY ==============");
console.log(`posts scanned:    ${loadWritingPosts().length}`);
console.log(
  `features in use:  ${[...seen.keys()].sort().join(", ") || "(none)"}`,
);
console.log(`problems found:   ${problems.length}`);
for (const p of problems) {
  console.log(`FAIL ${p.where} uses "${p.feature}", which post-body.tsx does not render: ${p.line}`);
}
console.log(
  problems.length
    ? "writing markdown: FAIL — either implement the feature in post-body.tsx or rewrite the line"
    : "writing markdown: pass",
);
console.log("======================================================");

assert.equal(
  problems.length,
  0,
  `${problems.length} writing post line(s) use markdown that post-body.tsx renders as literal text`,
);
