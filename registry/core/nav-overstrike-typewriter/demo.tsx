"use client";

import { NavOverstrikeTypewriter } from "./component";

export default function NavOverstrikeTypewriterDemo() {
  return (
    <div className="min-h-screen bg-background">
      <NavOverstrikeTypewriter />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Overstrike Typewriter Nav
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ns-muted">
          The ruled line beneath the links is struck several times per
          cell — real overstrike compositing, not a single glyph picked off
          a density ramp. The deepest stack sits under &ldquo;Work&rdquo;,
          the current page; the rest of the line quietly re-strikes itself
          as a carriage sweeps back and forth.
        </p>
      </main>
    </div>
  );
}
