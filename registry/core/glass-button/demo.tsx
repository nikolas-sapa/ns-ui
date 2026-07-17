"use client";

import { GlassButton } from "./component";

export default function GlassButtonDemo() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* dot grid + ambient light orbs so the glass has something to refract */}
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      {/* orb sits directly behind the button so the glass visibly blurs it */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-[60%] -translate-y-[55%] rounded-full bg-accent/15 blur-2xl dark:bg-accent/20"
      />
      <GlassButton>Get started</GlassButton>
    </div>
  );
}
