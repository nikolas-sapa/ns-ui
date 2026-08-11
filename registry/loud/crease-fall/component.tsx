"use client";

import * as React from "react";

export interface CreaseFallItem {
  /** Visible link text. This is the type the mechanism acts on. */
  label: string;
  href: string;
  /** Short right-aligned annotation printed on the same panel. */
  meta?: string;
}

export interface CreaseFallProps {
  items?: CreaseFallItem[];
  /** Text of the control that opens the overlay. */
  triggerLabel?: string;
  /** Accessible name of the overlay dialog. */
  label?: string;
  /** Small mono line printed at the head of the sheet. */
  eyebrow?: string;
  /** Footer line printed on the last panel's apron. */
  footer?: string;
  /** Page content the sheet falls over. */
  children?: React.ReactNode;
  className?: string;
}

const DEFAULT_ITEMS: CreaseFallItem[] = [
  { label: "Index", href: "#index", meta: "01 / start" },
  { label: "Work", href: "#work", meta: "02 / 24 projects" },
  { label: "Studio", href: "#studio", meta: "03 / who" },
  { label: "Writing", href: "#writing", meta: "04 / notes" },
  { label: "Contact", href: "#contact", meta: "05 / say hello" },
];

/** How far past vertical a folded crease leans. */
const FOLD = 96;
/** ms between crease releases, opening and closing. */
const OPEN_STAGGER = 132;
const SHUT_STAGGER = 40;

/**
 * Local (parent-relative) angle of crease `i` when the sheet is folded flat.
 *
 * A concertina ALTERNATES. Because the panels are nested, panel i's angle is
 * relative to panel i-1, so a constant fold angle does not zig-zag — it rolls:
 * the cumulative angle marches (-96, -192, -288...) until the far panels point
 * anywhere and leave the screen entirely. Alternating the local angle keeps the
 * WORLD angle pinned to -96 / +96 / -96, which is a stack of paper leaning
 * alternately away from and toward the viewer: flat, one panel tall, on screen.
 */
const foldedLocal = (i: number) => (i === 0 ? -FOLD : i % 2 ? 2 * FOLD : -2 * FOLD);

type Spring = { a: number; v: number };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * A full-screen navigation overlay that is a sheet of paper folded flat into a
 * concertina and pinned at the top of the viewport. Opening releases the
 * creases in sequence: each panel swings down about its top edge under a spring
 * with real weight, overshoots, and slaps flat — and because the panels are
 * NESTED, every panel inherits its parent's motion the way a physical fold
 * chain does, so the far end of the sheet whips further than the near end.
 *
 * The nav items ride ON the panels. They are real DOM anchors, foreshortened by
 * the same rotateX that is unfolding them, so a line of type arrives edge-on
 * and flattens into legibility as its panel lands. Nothing is drawn to a canvas.
 */
export function CreaseFall({
  items = DEFAULT_ITEMS,
  triggerLabel = "Menu",
  label = "Site navigation",
  eyebrow = "ns-ui / crease-fall",
  footer = "Folded flat, released crease by crease.",
  children,
  className,
}: CreaseFallProps) {
  const n = items.length;
  const reduced = usePrefersReducedMotion();

  const [open, setOpen] = React.useState(false);
  // Kept mounted through the fold-up so the closing motion is visible.
  const [mounted, setMounted] = React.useState(false);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const panelRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const faceRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const creaseRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const inkRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const scrimRef = React.useRef<HTMLDivElement>(null);

  const springs = React.useRef<Spring[]>([]);
  if (springs.current.length !== n) {
    springs.current = Array.from({ length: n }, (_, i) => ({ a: foldedLocal(i), v: 0 }));
  }
  const scrim = React.useRef<Spring>({ a: 0, v: 0 });
  const raf = React.useRef(0);
  const last = React.useRef(0);
  const phase = React.useRef({ open: false, t: 0 });

  /** Write the current solver state onto the DOM. Pure paint, no layout reads. */
  const paint = React.useCallback(() => {
    const s = springs.current;
    let world = 0;
    for (let i = 0; i < s.length; i++) {
      const el = panelRefs.current[i];
      if (el) el.style.transform = `rotateX(${s[i].a.toFixed(2)}deg)`;
      // Shading is a function of the panel's WORLD orientation, not its angle
      // across the crease: the light is in the room, not in the parent's frame.
      world += s[i].a;
      const edge = Math.abs(Math.sin((world * Math.PI) / 180));
      // Paper is printed on one side. A panel turned past edge-on shows blank
      // stock, not its own type in mirror — done by opacity rather than
      // backface-visibility, which would promote the layer and smear the glyphs.
      const ink = inkRefs.current[i];
      if (ink) ink.style.opacity = Math.cos((world * Math.PI) / 180) < 0 ? "0" : "1";
      const face = faceRefs.current[i];
      // Steep falloff (^2.4): only paper turned near edge-on is shaded, so a
      // landed panel is clean ink on clean stock and the back of a folded one
      // is covered rather than showing its type in mirror.
      if (face) face.style.opacity = (Math.pow(edge, 2.4) * 0.94).toFixed(3);
      // The crease itself only exists while there is an angle across it.
      const cr = creaseRefs.current[i];
      if (cr) cr.style.opacity = (0.14 + Math.min(1, Math.abs(s[i].a) / FOLD) * 0.86).toFixed(3);
    }
    if (scrimRef.current) scrimRef.current.style.opacity = scrim.current.a.toFixed(3);
  }, []);

  const settle = React.useCallback(
    (isOpen: boolean) => {
      const s = springs.current;
      for (let i = 0; i < s.length; i++) {
        s[i].a = isOpen ? 0 : foldedLocal(i);
        s[i].v = 0;
      }
      scrim.current = { a: isOpen ? 1 : 0, v: 0 };
      paint();
    },
    [paint],
  );

  const step = React.useCallback(
    (now: number) => {
      const s = springs.current;
      const opening = phase.current.open;
      const dtWall = Math.min(64, now - (last.current || now));
      last.current = now;
      phase.current.t += dtWall;
      const t = phase.current.t;

      // Fixed substeps: a spring integrated at wall-clock dt changes character
      // with the frame rate, and this one is deliberately near its stability edge.
      let acc = dtWall / 1000;
      let alive = false;
      while (acc > 0) {
        const dt = Math.min(1 / 240, acc);
        acc -= dt;
        for (let i = 0; i < s.length; i++) {
          // Release order: top crease first on the way down, bottom crease
          // first on the way up — a concertina closes from the far end.
          const release = opening ? i * OPEN_STAGGER : (s.length - 1 - i) * SHUT_STAGGER;
          if (t < release) continue;
          const target = opening ? 0 : foldedLocal(i);
          // Paper further down the chain is carrying more of the sheet, so it
          // is heavier: lower stiffness, less damping, a longer flap.
          const w = i / Math.max(1, s.length - 1);
          const k = opening ? 260 - w * 96 : 420;
          const zeta = opening ? 0.5 + w * 0.1 : 0.92;
          const c = 2 * zeta * Math.sqrt(k);
          s[i].v += (-k * (s[i].a - target) - c * s[i].v) * dt;
          s[i].a += s[i].v * dt;
          // Angular coupling down the chain: when a crease is still swinging,
          // it feeds a little of that rate into the crease it carries.
          if (i + 1 < s.length && opening && t >= (i + 1) * OPEN_STAGGER) {
            s[i + 1].v += s[i].v * 0.05 * dt * 60;
          }
        }
        const st = scrim.current;
        const sk = 150;
        st.v += (-sk * (st.a - (opening ? 1 : 0)) - 2 * 0.9 * Math.sqrt(sk) * st.v) * dt;
        st.a += st.v * dt;
      }

      for (let i = 0; i < s.length; i++) {
        const target = opening ? 0 : foldedLocal(i);
        if (Math.abs(s[i].a - target) > 0.05 || Math.abs(s[i].v) > 0.4) alive = true;
      }
      if (Math.abs(scrim.current.a - (opening ? 1 : 0)) > 0.004) alive = true;

      paint();

      if (alive && !document.hidden) {
        raf.current = requestAnimationFrame(step);
      } else {
        raf.current = 0;
        settle(opening);
        if (!opening) setMounted(false);
      }
    },
    [paint, settle],
  );

  const run = React.useCallback(
    (isOpen: boolean) => {
      phase.current = { open: isOpen, t: 0 };
      last.current = 0;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(step);
    },
    [step],
  );

  // Drive the fold whenever the open state flips.
  React.useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  React.useEffect(() => {
    if (!mounted) return;
    if (reduced) {
      settle(open);
      if (!open) setMounted(false);
      return;
    }
    run(open);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [mounted, open, reduced, run, settle]);

  // A backgrounded tab gets no frames; land the sheet rather than freezing it
  // mid-fold and resuming from a stale timestamp.
  React.useEffect(() => {
    const onVis = () => {
      if (document.hidden && raf.current) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
        settle(phase.current.open);
        if (!phase.current.open) setMounted(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [settle]);

  // Focus: into the sheet on open, back on the trigger on close, trapped between.
  // Depends on `mounted` as well as `open`: the dialog is mounted one render
  // after open flips, so keying this on `open` alone ran it against a null ref
  // and shipped a menu with no trap and no Escape.
  React.useEffect(() => {
    if (!open || !mounted) return;
    const root = overlayRef.current;
    if (!root) return;
    // The first nav link, not the Close button that precedes it in the DOM:
    // opening a menu should land on the menu.
    const firstItem = () =>
      root.querySelector<HTMLElement>("a[href]") ??
      root.querySelector<HTMLElement>("button:not([disabled])");
    firstItem()?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const f = Array.from(
        root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (f.length === 0) return;
      const firstEl = f[0];
      const lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    // Tab wrapping alone is not a trap: focus can also arrive from outside
    // (a blur to <body> then Tab lands on the trigger, which is still in the
    // DOM behind the sheet). Pull anything that escapes back to the first item.
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Node | null;
      if (t && !root.contains(t)) {
        e.stopPropagation();
        firstItem()?.focus();
      }
    };

    root.addEventListener("keydown", onKey);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      root.removeEventListener("keydown", onKey);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      triggerRef.current?.focus();
    };
    // `mounted` belongs here: the dialog is mounted one render AFTER open
    // flips, so keying this on `open` alone ran the effect against a null ref
    // and never re-ran — no focus move, no trap, no Escape.
  }, [open, mounted]);

  // Nested panels: panel i hangs off the bottom edge of panel i-1, so its
  // rotateX composes with every crease above it. That composition IS the
  // mechanism — it is what a fold chain does and what a flat stagger cannot fake.
  const chain = (i: number): React.ReactNode => {
    if (i >= n) return null;
    const item = items[i];
    return (
      <div
        key={item.href + item.label}
        ref={(el) => {
          panelRefs.current[i] = el;
        }}
        className="absolute inset-x-0 h-full origin-top"
        style={{
          top: i === 0 ? 0 : "100%",
          transformStyle: "preserve-3d",
          transform: `rotateX(${foldedLocal(i)}deg)`,
        }}
        // No will-change and no backface-visibility on purpose: both promote the
        // panel to a layer rasterized once at rest scale, and the foreshortened
        // type then arrives as a smeared bitmap instead of re-rendered glyphs.
        // The whole claim of this component is that the TYPE folds, so it has to
        // stay crisp at 40 degrees. Five panels re-raster cheaply.
      >
        <div className="relative h-full w-full bg-background">
          <div
            ref={(el) => {
              creaseRefs.current[i] = el;
            }}
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-border"
          />
          <div
            ref={(el) => {
              inkRefs.current[i] = el;
            }}
            className="h-full w-full"
          >
            <a
              href={item.href}
              className="group relative flex h-full w-full items-center gap-6 px-6 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ns-accent sm:gap-10 sm:px-12"
            >
              <span className="w-10 shrink-0 font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted transition-colors duration-200 group-hover:text-ns-accent group-focus-visible:text-ns-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 truncate text-[clamp(1.75rem,7.4vh,4.25rem)] font-medium leading-none tracking-tight text-foreground transition-colors duration-200 group-hover:text-ns-accent group-focus-visible:text-ns-accent">
                {item.label}
              </span>
              {item.meta ? (
                <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted sm:block">
                  {item.meta}
                </span>
              ) : null}
            </a>
          </div>
          {/* Shading. Painted in --foreground, so it darkens in both themes. */}
          <div
            ref={(el) => {
              faceRefs.current[i] = el;
            }}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-foreground"
            style={{ opacity: 0.93 }}
          />
        </div>
        {chain(i + 1)}
      </div>
    );
  };

  return (
    <div className={["relative isolate", className].filter(Boolean).join(" ")}>
      {children}

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="group fixed right-5 top-5 z-30 inline-flex items-center gap-3 rounded-sm border border-border bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur transition-colors duration-150 hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent sm:right-8 sm:top-8"
      >
        {/* The folded sheet in miniature: the creases the control is about to release. */}
        <span aria-hidden="true" className="relative flex h-3.5 w-5 flex-col justify-between">
          <span className="h-px w-full bg-current" />
          <span className="h-px w-3/4 bg-current transition-[width] duration-300 group-hover:w-full" />
          <span className="h-px w-1/2 bg-current transition-[width] duration-300 group-hover:w-full" />
        </span>
        {triggerLabel}
      </button>

      {/* The sheet at rest. It is folded flat and pinned exactly where the
          overlay unfolds from, so the closed page shows the concertina edge-on
          — five creases stacked into a few millimetres of paper — rather than
          hiding the mechanism until something is clicked. Decoration-free: it
          is the same object, seen from the side. */}
      {mounted ? null : (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-[5.5rem] z-20 flex flex-col gap-[5px]"
        >
          {items.map((item, i) => (
            <span
              key={item.href + item.label}
              className="block h-px bg-border"
              style={{
                // Each fold sits a little inside the one above it, the way a
                // stack of creased paper tapers when you look down its edge.
                marginInline: `${i * 2.1}%`,
                opacity: 1 - i * 0.15,
              }}
            />
          ))}
        </div>
      )}

      {mounted ? (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-40"
          style={{ perspective: "1400px", perspectiveOrigin: "50% 0%" }}
        >
          <div
            ref={scrimRef}
            aria-hidden="true"
            className="absolute inset-0 bg-background"
            style={{ opacity: 0 }}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed right-5 top-5 z-20 inline-flex items-center gap-3 rounded-sm border border-border bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur transition-colors duration-150 hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent sm:right-8 sm:top-8"
          >
            <span aria-hidden="true" className="relative block h-3.5 w-5">
              <span className="absolute left-0 top-1/2 h-px w-full origin-center rotate-45 bg-current" />
              <span className="absolute left-0 top-1/2 h-px w-full origin-center -rotate-45 bg-current" />
            </span>
            Close
          </button>

          {/* The sheet, pinned under the header bar. One panel tall; every
              further panel hangs off the bottom edge of the last. */}
          <div
            className="absolute inset-x-0"
            style={{
              top: "5.5rem",
              height: `calc((100% - 9.5rem) / ${n})`,
              transformStyle: "preserve-3d",
            }}
          >
            {chain(0)}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-center justify-between gap-6 px-6 font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted sm:px-12">
            <span>{eyebrow}</span>
            <span className="hidden truncate sm:block">{footer}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CreaseFall;
