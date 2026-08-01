"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

// MarginCite — an inline citation primitive. The trigger is one monochrome
// superscript pill (hostname of the primary source, plus a small source
// count when there's more than one) sitting right in the text flow. Opening
// it reveals ONE bordered card — title, excerpt, a "1 / N" stepper — instead
// of a popover-per-source; three sources behind a claim is one card the
// reader pages through, not three stacked callouts.
//
// The card is rendered through a portal into document.body and positioned
// with `position: fixed`, coordinates read from the trigger's own
// getBoundingClientRect on open, on scroll and on resize. That's the fix for
// the same clipping hazard tooltips and menus hit: a card left as a plain
// `absolute` child of the trigger gets silently cut off by the first
// ancestor with overflow-hidden (a common wrapper around body copy). It also
// flips above the trigger when there isn't room below, and clamps
// horizontally so it never runs off the viewport edge.
//
// Fully keyboard-operable: the trigger is a real button (Enter/Space toggle
// it natively), focus moves into the open card so Tab reaches Previous,
// Next and the source link in order, Left/Right arrow keys step the reader
// through sources without leaving the keyboard, and Escape closes the card
// and returns focus to the trigger. A visually-hidden status region
// announces "Source 2 of 3" on every step so paging is legible to assistive
// tech, not just sighted users watching the "1 / N" readout update.
//
// Zero dependencies beyond react-dom's createPortal. No canvas — the card is
// plain DOM, and every color is a token (--background --foreground --muted
// --border --accent) so both themes render correctly. Under
// prefers-reduced-motion the entrance animation is dropped via a CSS media
// query; the card still opens instantly and is fully operable.

export type CiteSource = {
  id: string;
  title: string;
  excerpt: string;
  /** full URL; hostname is derived from it for both the pill and the card footer */
  url: string;
};

export interface MarginCiteProps {
  sources: CiteSource[];
  className?: string;
}

const GAP = 8; // px between trigger and card
const CARD_WIDTH = 320;
const VIEWPORT_MARGIN = 12; // px clamp from viewport edges

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // not a parseable absolute URL — fall back to a best-effort strip
    return url.replace(/^https?:\/\//, "").split(/[/?#]/)[0] || url;
  }
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={dir === "left" ? "m10 3-5 5 5 5" : "m6 3 5 5-5 5"} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function LinkOutIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6.5 9.5 13 3M8.5 3H13v4.5M13 9.5V13a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1H7" />
    </svg>
  );
}

const iconBtnClass =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out " +
  "hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent " +
  "disabled:pointer-events-none disabled:opacity-30";

export function MarginCite({ sources, className = "" }: MarginCiteProps) {
  const n = sources.length;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const titleId = `${uid}-title`;
  const panelId = `${uid}-panel`;

  // position the portaled card off the trigger's live rect — recomputed on
  // open, on every step (the excerpt's length changes the card's height,
  // which can change whether it fits below) and on scroll/resize
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const tr = trigger.getBoundingClientRect();
      const cardW = panelRef.current?.offsetWidth || CARD_WIDTH;
      const cardH = panelRef.current?.offsetHeight || 140;

      let left = tr.left;
      const maxLeft = window.innerWidth - cardW - VIEWPORT_MARGIN;
      if (left > maxLeft) left = maxLeft;
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

      const spaceBelow = window.innerHeight - tr.bottom;
      const flip = spaceBelow < cardH + GAP && tr.top > cardH + GAP;
      const top = flip ? tr.top - cardH - GAP : tr.bottom + GAP;

      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open, index]);

  // outside pointerdown closes
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // Escape closes from anywhere, not only while focus happens to sit inside the
  // card. A non-modal popover that survives Escape because focus drifted (or was
  // dropped entirely) is a real trap — it keeps floating over the prose with no
  // keyboard way out.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Focus lands inside the card on open, so Tab immediately reaches its
  // controls in order rather than continuing through the surrounding text.
  // This has to wait for `pos` — the panel isn't mounted at all until the
  // placement effect has measured the trigger, so keying this on `open` alone
  // ran while panelRef was still null and focus silently stayed on the pill.
  const placed = pos !== null;
  useEffect(() => {
    if (!open || !placed) return;
    const id = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [open, placed]);

  if (n === 0) return null;

  const clampedIndex = Math.min(index, n - 1);
  const current = sources[clampedIndex];
  const primaryHost = hostnameOf(sources[0].url);

  const openCard = () => {
    setIndex(0);
    setOpen(true);
  };
  const closeCard = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };
  const step = (delta: number) => {
    setIndex((i) => Math.min(n - 1, Math.max(0, i + delta)));
  };

  const onPanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCard(true);
    } else if (e.key === "ArrowLeft" && clampedIndex > 0) {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowRight" && clampedIndex < n - 1) {
      e.preventDefault();
      step(1);
    }
  };

  return (
    <span className={`ns-margin-cite relative inline whitespace-nowrap ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? closeCard(false) : openCard())}
        onKeyDown={(e) => {
          if (open && e.key === "Escape") {
            e.preventDefault();
            closeCard(true);
          }
        }}
        className={[
          "relative -top-[0.5em] ml-0.5 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 align-baseline",
          "font-mono text-[0.65rem] leading-none",
          "transition-colors duration-150 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          open
            ? "border-foreground/30 bg-surface text-foreground"
            : "border-border bg-surface text-muted hover:border-foreground/30 hover:text-foreground",
        ].join(" ")}
      >
        <span>{primaryHost}</span>
        {n > 1 && <span className="opacity-70">·{n}</span>}
        <span className="sr-only">
          , {n} source{n === 1 ? "" : "s"} cited
        </span>
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {open ? `Source ${clampedIndex + 1} of ${n}` : ""}
      </span>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onPanelKeyDown}
            // Non-modal popover: once focus leaves the card entirely it closes,
            // rather than being left floating over the prose while the reader is
            // somewhere else on the page. Focus moving *within* the card (the
            // stepper buttons, the source link) is not a leave.
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && (panelRef.current?.contains(next) || triggerRef.current?.contains(next))) {
                return;
              }
              setOpen(false);
            }}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: CARD_WIDTH }}
            className="ns-margin-cite-panel z-50 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-border bg-surface text-foreground shadow-lg outline-none"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span aria-hidden className="font-mono text-[11px] tabular-nums tracking-wide text-muted">
                {clampedIndex + 1}
                {/* --border is tuned to disappear against a surface, which is
                    right for a hairline and wrong for a glyph: as `text-border`
                    this slash vanished and the readout rendered as "1  3". */}
                <span className="mx-0.5 text-muted/50">/</span>
                {n}
              </span>
              <div className="flex items-center gap-0.5">
                {n > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous source"
                      disabled={clampedIndex === 0}
                      onClick={() => step(-1)}
                      className={iconBtnClass}
                    >
                      <ChevronIcon dir="left" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next source"
                      disabled={clampedIndex === n - 1}
                      onClick={() => step(1)}
                      className={iconBtnClass}
                    >
                      <ChevronIcon dir="right" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-label="Close citation"
                  onClick={() => closeCard(true)}
                  className={iconBtnClass}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 px-3.5 py-3">
              <p id={titleId} className="text-sm font-semibold leading-snug text-foreground">
                {current.title}
              </p>
              <p className="line-clamp-3 text-sm leading-relaxed text-muted">{current.excerpt}</p>
              <a
                href={current.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex w-fit items-center gap-1 font-mono text-xs text-muted transition-colors duration-150 ease-out hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {hostnameOf(current.url)}
                <LinkOutIcon />
              </a>
            </div>
            <style>{`
.ns-margin-cite-panel{animation:ns-mc-in 160ms cubic-bezier(0.16,1,0.3,1) both}
@keyframes ns-mc-in{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.ns-margin-cite-panel{animation:none}}
`}</style>
          </div>,
          document.body
        )}
    </span>
  );
}
