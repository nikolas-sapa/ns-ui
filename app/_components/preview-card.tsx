"use client";

import Link from "next/link";
import { Suspense, useCallback, useLayoutEffect, useRef, useState } from "react";
import { demos } from "@/registry/index";
import { CopyButton } from "./copy-button";

export type RegistryEntry = {
  name: string;
  title: string;
  description: string;
  collection: string;
};

/**
 * Demos are authored against a real viewport (most are `min-h-screen`). Each
 * preview therefore renders into a *virtual viewport* sized `160vh x 100vh`
 * — the real viewport height, so `100vh` inside the demo resolves correctly,
 * and 16:10 so it drops into the card's aspect box with no letterboxing —
 * then is CSS-scaled down. Measuring happens before paint so the 1400px-wide
 * demo never flashes at full size.
 */
export function PreviewCard({
  entry,
  active,
  registerRef,
  installCommand,
}: {
  entry: RegistryEntry;
  active: boolean;
  registerRef: (name: string, el: HTMLElement | null) => void;
  installCommand: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number | null>(null);

  const measure = useCallback(() => {
    const box = boxRef.current;
    const stage = stageRef.current;
    if (!box || !stage) return;
    const stageW = stage.offsetWidth;
    if (!stageW) return;
    setScale(box.clientWidth / stageW);
  }, []);

  useLayoutEffect(() => {
    measure();
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    // stage height tracks 100vh, which a height-only window resize changes
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const setCardRef = useCallback(
    (el: HTMLElement | null) => {
      registerRef(entry.name, el);
    },
    [registerRef, entry.name],
  );

  const Demo = demos[entry.name];
  const mounted = active && scale !== null && Boolean(Demo);

  return (
    <article
      ref={setCardRef}
      data-name={entry.name}
      data-mounted={mounted ? "true" : "false"}
      className="group relative flex scroll-mt-24 flex-col"
    >
      <div
        ref={boxRef}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-surface transition-colors duration-200 group-hover:border-muted/40 motion-reduce:transition-none"
      >
        <Placeholder visible={!mounted} />
        <div
          ref={stageRef}
          // `inert` keeps the demos' own buttons/inputs out of the tab order —
          // pointer-events:none only blocks the mouse. Interaction belongs on
          // the full preview page.
          inert
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-screen w-[160vh] origin-top-left select-none"
          style={{
            transform: `scale(${scale ?? 0})`,
            visibility: mounted ? "visible" : "hidden",
          }}
        >
          {mounted ? (
            <Suspense fallback={null}>
              <Demo />
            </Suspense>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {/* The title is the link; `after:inset-0` stretches its hit area
                over the whole card without covering the description, so the
                copy is still selectable. */}
            <h3 className="truncate text-sm font-medium tracking-tight">
              <Link
                href={`/preview/${entry.name}`}
                className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-md focus-visible:ring-2 focus-visible:ring-accent"
              >
                {entry.title}
              </Link>
            </h3>
            {entry.collection === "loud" ? (
              <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted">
                loud
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
            {entry.description}
          </p>
        </div>
        <CopyButton
          value={installCommand}
          label={`Copy install command for ${entry.name}`}
          className="relative z-20 -mt-1"
        />
      </div>
    </article>
  );
}

/** Quiet empty stage: dot grid on surface. No text, no shimmer bar. */
function Placeholder({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:16px_16px] motion-safe:animate-pulse"
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}
