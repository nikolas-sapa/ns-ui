"use client";

import { GlassButton } from "./component";

export default function GlassButtonDemo() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* dot grid so the glass has something to blur */}
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <GlassButton>Get started</GlassButton>
    </div>
  );
}
