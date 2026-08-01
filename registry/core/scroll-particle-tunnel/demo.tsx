"use client";

import { ParticleTunnelScrub } from "./component";

export default function Demo() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5">
        <span className="font-mono text-xs tracking-widest text-muted">
          ns-ui / scroll-particle-tunnel
        </span>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="rounded-sm border border-white/10 bg-white/[0.06] px-4 py-2 font-mono text-xs tracking-widest text-foreground backdrop-blur-xl transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.1] active:translate-y-0 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          TOP
        </button>
      </header>

      <ParticleTunnelScrub labels={["01 SIGNAL", "02 NOISE", "03 FIELD", "04 VOID"]} />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 pb-6">
        <span className="font-mono text-[11px] tracking-widest text-muted">
          SCROLL TO FLY
        </span>
        <span
          aria-hidden
          className="h-8 w-px bg-border motion-safe:animate-pulse"
        />
      </div>
    </main>
  );
}
