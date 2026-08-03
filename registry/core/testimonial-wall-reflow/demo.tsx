"use client";

import { TestimonialWallReflow } from "./component";

export default function TestimonialWallReflowDemo() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-background p-6">
      <div className="w-full max-w-4xl">
        <p className="mb-5 font-mono text-xs tracking-widest text-muted">
          ns-ui / testimonial-wall-reflow
        </p>
        {/* click "read more" on any card — the rest of the wall re-packs
            around it, only the cards that actually move animate */}
        <TestimonialWallReflow />
      </div>
    </main>
  );
}
