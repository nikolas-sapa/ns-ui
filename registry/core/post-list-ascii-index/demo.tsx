"use client";

import { PostListAsciiIndex, type PostListAsciiItem } from "./component";

const POSTS: PostListAsciiItem[] = [
  { id: "p1", title: "Rethinking the render loop", excerpt: "Why we moved every hot path off React state.", date: "AUG 01", minutes: 6 },
  { id: "p2", title: "Tokens all the way down", excerpt: "Colors, spacing and motion from one source.", date: "JUL 24", minutes: 3 },
  { id: "p3", title: "The gate that caught us", excerpt: "A postmortem on a clipped popover shipping green.", date: "JUL 18", minutes: 9 },
  { id: "p4", title: "Reduced motion is not optional", excerpt: "A static first frame, every time.", date: "JUL 09", minutes: 2 },
  { id: "p5", title: "Canvas over CSS, sometimes", excerpt: "When a rAF loop earns its keep.", date: "JUN 30", minutes: 5 },
];

export default function PostListAsciiIndexDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / post-list-ascii-index
      </p>
      <div className="w-full max-w-xl rounded-md border border-border">
        <PostListAsciiIndex posts={POSTS} />
      </div>
      <p className="max-w-md text-center text-xs text-ns-muted">
        j/k or the arrow keys move the selection — the gutter's index marker
        tracks it and the reading-length bar redraws.
      </p>
    </div>
  );
}
