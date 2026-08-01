"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// ShadowBoard — an empty state modeled on a workshop pegboard: every tool has
// a silhouette painted where it hangs, so you know what belongs even with
// nothing on the wall. Each unfilled slot renders the item's own card markup
// (avatar circle, title bar, subtitle bar) recolored to a "shadow" — 1.5px
// dashed --border outline, --muted fill at 40% opacity, a tiny inline-SVG
// hook notch overlapping its top edge — so the empty state previews the
// exact spatial geometry future items will occupy instead of showing an
// illustration. This is deliberately prescriptive, not dormant: compare
// fallow-panel (a single boundary drifting around nothing, no item shape at
// all) and develop-skeleton (a shimmer standing in for content already
// fetched but not yet painted). ShadowBoard's silhouettes are the real
// populated layout, drawn before there's data for it.
//
// Item creation is controlled by the parent (`items` prop) — this component
// never invents data. When `items` grows, each newly-seen id mounts at
// scale(0.96) translateY(-8px) above its slot and spring-settles onto it
// (cubic-bezier(0.34,1.56,0.64,1), the same overshoot-then-settle curve used
// elsewhere in the registry for a "click into place" feel) while that slot's
// dashed shadow fades out underneath on the same duration. Items already
// present on first mount never animate — only ids that appear after mount
// get the entrance. Slots beyond the current item count keep their
// silhouette until filled, or until "Dismiss remaining" removes them as a
// group (a plain, separate control — dismissing never fabricates items).
//
// A11y: silhouettes are aria-hidden (decorative preview, not information).
// The region carries a plain-text description via aria-describedby; the
// create button is a normal, always-first-in-tab-order control; the list
// carries aria-live="polite" so a newly-settled item's title is announced.
// Reduced motion mounts new items in place with no offset/transition and the
// shadow disappears instantly rather than fading. DOM + inline SVG + CSS
// only — no canvas.
// ---------------------------------------------------------------------------

export interface ShadowBoardItem {
  /** stable id — also the React key */
  id: string;
  title: string;
  subtitle?: string;
}

export interface ShadowBoardProps {
  /** real items already created, in display order — this component never invents one itself */
  items: ShadowBoardItem[];
  /** number of silhouette slots the board previews; extra items beyond this render without a paired shadow */
  slots?: number;
  title?: string;
  /** plain-text empty-state copy, exposed as the region's description */
  description?: string;
  createLabel?: string;
  /** fired when the create button is pressed — this component does not append the item itself */
  onCreate?: () => void;
  className?: string;
}

const SETTLE_MS = 420;
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function initialOf(title: string) {
  return title.trim().charAt(0).toUpperCase() || "?";
}

// Rendered only inside the shadow layer, so it inherits and fades with that
// layer's own opacity transition — no opacity logic of its own needed.
function HookNotch() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 14"
      className="pointer-events-none absolute left-1/2 top-0 h-3.5 w-4 -translate-x-1/2 -translate-y-1/2 text-border opacity-70"
    >
      <path
        d="M8 1v5.5a3 3 0 1 0 3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardShape({
  shadow,
  avatar,
  title,
  subtitle,
}: {
  shadow: boolean;
  avatar?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div
      className={
        shadow
          ? "flex items-center gap-3 rounded-md border-[1.5px] border-dashed border-border bg-muted/40 p-3"
          : "flex items-center gap-3 rounded-md border border-border bg-surface p-3"
      }
    >
      <div
        className={
          shadow
            ? "h-9 w-9 shrink-0 rounded-full border-[1.5px] border-dashed border-border"
            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/30 text-xs font-medium text-foreground"
        }
      >
        {shadow ? null : avatar}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {shadow ? (
          <>
            <div className="h-2.5 w-4/5 rounded-sm border-[1.5px] border-dashed border-border" />
            <div className="h-2 w-3/5 rounded-sm border-[1.5px] border-dashed border-border" />
          </>
        ) : (
          <>
            <p className="truncate text-sm font-medium leading-none text-foreground">{title}</p>
            <p className="truncate text-xs leading-none text-muted">{subtitle}</p>
          </>
        )}
      </div>
    </div>
  );
}

// A slot is either an empty silhouette, or a real item that mounted onto one
// and spring-settled while the silhouette faded beneath it. `entering` is
// true only on the render where an id is first seen — the parent gives this
// slot a fresh `key` at that exact moment, so this whole component mounts
// new, and `animates` is captured once (via useState's lazy initializer) so
// a later re-render of the *same* mounted slot can never retract the
// animation partway through.
function Slot({
  item,
  entering,
  reducedMotion,
}: {
  item: ShadowBoardItem | undefined;
  entering: boolean;
  reducedMotion: boolean;
}) {
  const [animates] = useState(() => !!item && entering && !reducedMotion);
  const [settled, setSettled] = useState(!animates);

  useEffect(() => {
    if (!animates) return;
    setSettled(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once for this item's mount, keyed by id via the parent's `key`
  }, [animates]);

  const shadowOpacity = item ? (animates ? (settled ? 0 : 1) : 0) : 1;

  return (
    <div className="relative grid">
      <div
        aria-hidden
        className="pointer-events-none relative col-start-1 row-start-1"
        style={{
          opacity: shadowOpacity,
          transition: animates ? `opacity ${SETTLE_MS}ms ease-out` : "none",
        }}
      >
        <HookNotch />
        <CardShape shadow />
      </div>
      {item && (
        <div
          data-shadow-real="true"
          className="relative col-start-1 row-start-1"
          style={{
            transform: settled ? "none" : "scale(0.96) translateY(-8px)",
            opacity: settled ? 1 : 0,
            transition: animates
              ? `transform ${SETTLE_MS}ms ${SPRING}, opacity ${Math.round(SETTLE_MS * 0.6)}ms ease-out`
              : "none",
          }}
        >
          <CardShape shadow={false} avatar={initialOf(item.title)} title={item.title} subtitle={item.subtitle} />
        </div>
      )}
    </div>
  );
}

export function ShadowBoard({
  items,
  slots = 4,
  title = "Projects",
  description = "No projects yet. Created projects will appear here.",
  createLabel = "Create a project",
  onCreate,
  className = "",
}: ShadowBoardProps) {
  const reducedMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);

  // Items already present on the very first render are "seen" from the
  // start, so they never animate — only an id that shows up on a *later*
  // render is newly entering. This has to be known during this same render
  // (not a render later, via an effect) or the item would flash in at rest
  // for one frame before jumping back to its mount offset to animate — so
  // the seen-set is lazily initialized once, then advanced in place here.
  // `add` is idempotent, so re-running this under StrictMode's double-render
  // produces the same `enteringIds` both times.
  const seenIdsRef = useRef<Set<string> | null>(null);
  if (seenIdsRef.current === null) {
    seenIdsRef.current = new Set(items.map((it) => it.id));
  }
  const enteringIds = new Set<string>();
  for (const it of items) {
    if (!seenIdsRef.current.has(it.id)) {
      seenIdsRef.current.add(it.id);
      enteringIds.add(it.id);
    }
  }

  const descId = useId();
  const visibleSlotCount = dismissed ? items.length : Math.max(slots, items.length);
  const hasRemainingShadows = !dismissed && items.length < slots;

  return (
    <div className={["w-full", className].join(" ")}>
      <div role="region" aria-label={title} aria-describedby={descId}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p id={descId} className="mt-1 text-xs text-muted">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex shrink-0 items-center justify-center rounded-sm bg-accent px-3 py-1.5 text-xs font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {createLabel}
          </button>
        </div>

        <ul aria-live="polite" className="grid grid-cols-2 gap-3">
          {Array.from({ length: visibleSlotCount }, (_, i) => {
            const item = items[i];
            return (
              <li key={item?.id ?? `shadow-${i}`}>
                <Slot item={item} entering={!!item && enteringIds.has(item.id)} reducedMotion={reducedMotion} />
              </li>
            );
          })}
        </ul>

        {hasRemainingShadows && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="mt-3 rounded-sm px-1 text-xs text-muted underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Dismiss remaining
          </button>
        )}
      </div>
    </div>
  );
}
