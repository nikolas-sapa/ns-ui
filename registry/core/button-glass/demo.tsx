"use client";

import { GlassButton } from "./component";

export default function GlassButtonDemo() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* dot grid + ambient light orbs so the glass has something to refract */}
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      {/* neutral orb behind the button so the glass visibly blurs it
          (accent is interaction-only per design DNA, not scenery) */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-[60%] -translate-y-[55%] animate-[pulse_5s_ease-in-out_infinite] rounded-full bg-black/10 blur-2xl motion-reduce:animate-none dark:bg-white/15"
      />
      <GlassButton>Get started</GlassButton>
    </div>
  );
}
