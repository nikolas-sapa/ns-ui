"use client";

import { CardFlick } from "./component";

export default function CardFlickDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / card-flick — hover the headline
      </p>
      <CardFlick
        text="FLICK THIS"
        from="center"
        className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl"
      />
      <p className="max-w-sm text-center text-xs text-muted">
        Each letter is an index card: the face flicks back off its top edge
        while a duplicate flicks up from underneath, staggered outward from
        the center on a numerically integrated spring.
      </p>
    </main>
  );
}
