"use client";

import { useState } from "react";
import { HeroSliceComb } from "./component";

export default function HeroSliceCombDemo() {
  const [form, setForm] = useState<"bust" | "slab">("bust");

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / hero-slice-comb</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setForm("bust")}
            aria-pressed={form === "bust"}
            className={`rounded-sm border px-3 py-1.5 font-mono text-[11px] tracking-widest transition-colors ${
              form === "bust" ? "border-foreground text-foreground" : "border-border text-ns-muted hover:text-foreground"
            }`}
          >
            BUST
          </button>
          <button
            type="button"
            onClick={() => setForm("slab")}
            aria-pressed={form === "slab"}
            className={`rounded-sm border px-3 py-1.5 font-mono text-[11px] tracking-widest transition-colors ${
              form === "slab" ? "border-foreground text-foreground" : "border-border text-ns-muted hover:text-foreground"
            }`}
          >
            SLAB
          </button>
        </div>
      </header>
      <HeroSliceComb
        form={form}
        eyebrow="SLICE-COMB-01"
        headline={["Density is", "the silhouette"]}
        subcopy="A tri-axial superellipsoid, cut by planes fixed in camera space and spun continuously underneath them. Where the surface turns tangent to the camera, uniform-depth slices pile up into a bright rim; where it faces the camera, they spread out and go dark."
        cta={{ label: "Read the mechanism", href: "#mechanism" }}
        className="min-h-[calc(100vh-3.75rem)]"
      />
    </main>
  );
}
