"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// FooterAsciiRule — a footer whose "back to top" control is an honest
// instrument, not a decoration: an aria-hidden vertical rail beside the
// copyright line always reads real, continuous scroll position (a passive
// scroll listener, not a fixed-duration animation on its own clock), and its
// button drives a real semi-implicit-Euler spring toward scrollY=0 rather
// than a native instant jump or CSS smooth-scroll. Because the rail's
// position comes from window.scrollY every frame, a user who grabs the
// wheel or a key mid-flight sees the car respond to what they're actually
// doing — and the flight itself is cancelled the instant that happens,
// rather than fighting the user for control of the page.
// ---------------------------------------------------------------------------

const RAIL_ROWS = 6;
const INITIAL_RAIL = Array.from({ length: RAIL_ROWS }, (_, i) => (i === 0 ? "●" : "│")).join("\n");
const SPRING_K = 120;
const SPRING_C = 22;
const SETTLE_POS_EPS = 0.6;
const SETTLE_VEL_EPS = 4;
const SETTLE_MS = 2500;

export interface FooterLinkItem {
  label: string;
  href: string;
}

export interface FooterColumn {
  heading: string;
  links: FooterLinkItem[];
}

export interface FooterAsciiRuleProps {
  brand?: string;
  columns: FooterColumn[];
  className?: string;
}

export function FooterAsciiRule({ brand = "ns-ui", columns, className = "" }: FooterAsciiRuleProps) {
  const railRef = useRef<HTMLPreElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const flightRef = useRef<{ raf: number; cancel: () => void } | null>(null);

  // -- honest readout: the rail always reflects real scroll, all the time --
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const paint = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      // progress 0 (at top) -> car at row 0; progress 1 (scrolled away) -> car at last row
      const carRow = Math.round(progress * (RAIL_ROWS - 1));
      const lines: string[] = [];
      for (let i = 0; i < RAIL_ROWS; i++) lines.push(i === carRow ? "●" : "│");
      rail.textContent = lines.join("\n");
      if (pctRef.current) pctRef.current.textContent = `${Math.round(progress * 100)}%`.padStart(4, " ");
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        paint();
      });
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    return () => flightRef.current?.cancel();
  }, []);

  const backToTop = () => {
    flightRef.current?.cancel();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      window.scrollTo(0, 0);
      return;
    }

    let y = window.scrollY;
    let v = 0;
    const deadline = performance.now() + SETTLE_MS;
    let raf = 0;
    let cancelled = false;

    const stopInterrupt = () => {
      window.removeEventListener("wheel", onInterrupt);
      window.removeEventListener("touchstart", onInterrupt);
      window.removeEventListener("keydown", onKeyInterrupt);
    };
    const onInterrupt = () => cancel();
    const onKeyInterrupt = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) cancel();
    };

    function cancel() {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      stopInterrupt();
      flightRef.current = null;
    }

    window.addEventListener("wheel", onInterrupt, { passive: true });
    window.addEventListener("touchstart", onInterrupt, { passive: true });
    window.addEventListener("keydown", onKeyInterrupt);

    let last = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      v += (-SPRING_K * y - SPRING_C * v) * dt;
      y += v * dt;
      const settled = Math.abs(y) < SETTLE_POS_EPS && Math.abs(v) < SETTLE_VEL_EPS;
      if (settled || now >= deadline) {
        window.scrollTo(0, 0);
        cancel();
        return;
      }
      window.scrollTo(0, Math.max(0, y));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    flightRef.current = { raf, cancel };
  };

  return (
    <footer data-footer-ascii-rule className={`border-t border-border bg-surface ${className}`}>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div aria-hidden className="select-none font-mono text-[11px] text-border">
          {"─".repeat(64)}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.heading}>
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
                {col.heading}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="rounded-sm text-sm text-ns-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-6">
          <p className="font-mono text-xs text-ns-muted">
            © {new Date().getFullYear()} {brand}
          </p>

          <button
            ref={buttonRef}
            type="button"
            onClick={backToTop}
            aria-label="Back to top"
            className="group inline-flex items-center gap-2 rounded-sm border border-border px-2.5 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-foreground/25 hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            <span className="flex flex-col items-center gap-0.5">
              <pre
                ref={railRef}
                aria-hidden
                className="pointer-events-none whitespace-pre text-center leading-[1.1] text-ns-muted transition-colors group-hover:text-ns-accent"
              >
                {INITIAL_RAIL}
              </pre>
              <span ref={pctRef} aria-hidden className="pointer-events-none text-[9px] tabular-nums text-ns-muted/60">
                0%
              </span>
            </span>
            <span>back to top</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
