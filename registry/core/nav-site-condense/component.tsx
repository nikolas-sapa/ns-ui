"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// NavSiteCondense — a full-width top nav with the mechanics an actual site
// needs and this registry didn't have yet: real scroll state (a plain
// threshold class-swap, deliberately subordinate — nav-condense-rail already
// owns the continuous, measured density transition and header-scroll-pill
// already owns the silhouette morph into a pill; this component's job is
// everything neither of those ships), a menu trigger that is present at
// every width (not hidden behind a responsive breakpoint that would make it
// unreachable at some viewport sizes), and a mobile sheet built on the
// native <dialog> element for a free focus trap, Escape-to-close and
// top-layer stacking.
// ---------------------------------------------------------------------------

export interface NavLinkItem {
  label: string;
  href: string;
}

export interface NavSiteCondenseProps {
  /** wordmark / brand text */
  brand?: string;
  /** nav links, in order */
  links: NavLinkItem[];
  /** px of scrollY past which the bar condenses. default 24 */
  condenseAt?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function NavSiteCondense({
  brand = "ns-ui",
  links,
  condenseAt = 24,
  className = "",
}: NavSiteCondenseProps) {
  const [condensed, setCondensed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const sheetTitleId = useId();

  // -- scroll condense: a plain threshold, not a continuous interpolation --
  useEffect(() => {
    let ticking = false;
    const evaluate = () => {
      ticking = false;
      setCondensed(window.scrollY > condenseAt);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(evaluate);
    };
    evaluate(); // honest initial read: the page may load already scrolled
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [condenseAt]);

  // -- sheet: native <dialog> drives the trap, Escape and top layer --------
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;

    if (sheetOpen && !dlg.open) dlg.showModal();
    if (!sheetOpen && dlg.open) dlg.close();

    const onCancel = (e: Event) => {
      // native Escape handling; just keep our state in sync
      e.preventDefault();
      setSheetOpen(false);
    };
    const onClose = () => setSheetOpen(false);
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) setSheetOpen(false);
    };
    dlg.addEventListener("cancel", onCancel);
    dlg.addEventListener("close", onClose);
    dlg.addEventListener("click", onBackdrop);
    return () => {
      dlg.removeEventListener("cancel", onCancel);
      dlg.removeEventListener("close", onClose);
      dlg.removeEventListener("click", onBackdrop);
    };
  }, [sheetOpen]);

  const closeSheet = () => setSheetOpen(false);

  return (
    <>
      <header
        data-nav-site-condense
        className={`sticky top-0 z-40 border-b transition-[padding-block,box-shadow,background-color] duration-300 motion-reduce:transition-none ${
          condensed
            ? "border-border bg-background/95 py-2 shadow-sm backdrop-blur-sm"
            : "border-transparent bg-background py-5"
        } ${className}`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <a
            href="#top"
            className={`shrink-0 rounded-sm font-mono font-semibold tracking-tight text-foreground transition-[font-size,color] duration-300 hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent motion-reduce:transition-none ${
              condensed ? "text-sm" : "text-base"
            }`}
          >
            {brand}
          </a>

          <nav aria-label="Primary" className="hidden items-center gap-6 sm:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-sm text-sm text-ns-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Present at every width on purpose: a trigger hidden behind a
              responsive breakpoint is unreachable at whatever viewport a
              test (or a user on an in-between width) actually has. Doubles
              as the full-sitemap entry point even on wide screens. */}
          <button
            type="button"
            ref={triggerRef}
            aria-haspopup="dialog"
            aria-controls={dialogId}
            aria-expanded={sheetOpen}
            aria-label="Open menu"
            onClick={() => setSheetOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm border border-border px-2 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-foreground/25 hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            <span aria-hidden className="leading-none">
              [≡]
            </span>
          </button>
        </div>
      </header>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-modal="true"
        aria-labelledby={sheetTitleId}
        className="ns-nav-sheet m-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none overflow-hidden border-l border-border bg-surface p-0 text-foreground shadow-2xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <h2 id={sheetTitleId} className="font-mono text-sm font-semibold text-foreground">
              {brand}
            </h2>
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close menu"
              className="rounded-sm border border-border p-1.5 text-ns-muted transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav aria-label="Mobile" data-nav-site-condense-sheet className="flex flex-1 flex-col overflow-y-auto p-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeSheet}
                className="rounded-sm px-3 py-3 font-mono text-sm text-foreground transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <style>{`
          .ns-nav-sheet {
            position: fixed;
            inset: 0 0 0 auto;
            transform: translateX(100%);
            transition: transform 260ms ease, opacity 260ms ease;
            opacity: 0;
          }
          .ns-nav-sheet[open] {
            transform: translateX(0%);
            opacity: 1;
          }
          .ns-nav-sheet::backdrop {
            background: color-mix(in srgb, var(--foreground) 30%, transparent);
          }
          @media (prefers-reduced-motion: reduce) {
            .ns-nav-sheet { transition: none; }
          }
        `}</style>
      </dialog>
    </>
  );
}
