"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// KeystoneLean — a list whose items stand like voussoirs in a shallow arch.
// Each item may declare `dependents` (ids of other items in the same list
// that rely on it). Arming an ORDINARY item's delete control (hover OR
// focus) previews the collapse: the arch's remaining stones lean a few
// degrees into the gap that item would leave and close ~30% of it, staged
// with a 40ms outward stagger, held while armed and spring-reverted on
// leave — and the preview IS the real post-delete layout, just partial.
// Arming a KEYSTONE (dependents.length > 0) instead runs a brief shared
// tremor through every dependent stone and its own delete control stays
// permanently muted-and-struck: the lean never comes, because the delete is
// refused before you ever click. Committing a safe delete removes the item
// and FLIPs the remaining stones from their previewed position into their
// true resting layout over ~400ms ease-out-expo — the same animation, just
// finished. Reduced motion drops every transform: affected stones (leaning
// or trembling) get a static outline instead, so the same information is
// legible without a single transform running. DOM + SVG + CSS only, no
// canvas. Colors from --background/--foreground/--surface/--border/--muted/
// --accent only.
// ---------------------------------------------------------------------------

export interface KeystoneLeanItem {
  id: string;
  label: string;
  /** short secondary line — value preview, type, whatever the row is */
  detail?: string;
  /** ids of OTHER items in this list that depend on this one existing */
  dependents?: string[];
}

export interface KeystoneLeanProps {
  items: KeystoneLeanItem[];
  /** fired once an item has actually been removed (not on preview) */
  onDelete?: (item: KeystoneLeanItem) => void;
  className?: string;
}

const GAP_PX = 16; // matches the row's gap-4
const ARCH_LIFT_PX = 14; // crown lift at the row's center
const ARCH_TILT_DEG = 5; // max baseline tilt at the row's edges
const LEAN_FRACTION: Record<1 | 2, number> = { 1: 0.3, 2: 0.12 };
const LEAN_ROTATE_DEG: Record<1 | 2, number> = { 1: 1.5, 2: 0.6 };
const LEAN_STAGGER_MS = 40;
const COMMIT_MS = 400;
const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPRING_OUT = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const ANNOUNCE_HOLD_MS = 2400;

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

type Armed = { index: number; kind: "safe" | "keystone" } | null;
type FlipDelta = { dx: number; dy: number };

function XGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
      <path
        d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function StrikeGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
      <circle cx="6" cy="6" r="4.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M3 3 9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function KeystoneLean({
  items: initialItems,
  onDelete,
  className = "",
}: KeystoneLeanProps) {
  const [items, setItems] = useState<KeystoneLeanItem[]>(initialItems);
  // hover and focus are tracked independently — the brief requires the
  // preview to hold while EITHER is true, so a mouse leaving a keyboard-
  // focused control must not drop the preview (and vice versa).
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [flip, setFlip] = useState<Record<string, FlipDelta>>({});
  const [flipAnimating, setFlipAnimating] = useState(false);
  const [tremorNonce, setTremorNonce] = useState(0);
  const [announce, setAnnounce] = useState("");
  const reduced = useReducedMotion();

  const stoneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const deleteBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const oldRectsRef = useRef<Record<string, DOMRect> | null>(null);
  const pendingFocusRef = useRef<{ id: string | null } | null>(null);
  const flipTimerRef = useRef<number | null>(null);
  const announceTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
      if (announceTimerRef.current) window.clearTimeout(announceTimerRef.current);
    },
    []
  );

  const idToIndex = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [items]);

  const isKeystone = useCallback(
    (it: KeystoneLeanItem) => (it.dependents?.length ?? 0) > 0,
    []
  );

  const armedIndex = hoverIndex ?? focusIndex;
  const armedItem = armedIndex !== null ? items[armedIndex] : undefined;
  const armed: Armed =
    armedIndex !== null && armedItem
      ? { index: armedIndex, kind: isKeystone(armedItem) ? "keystone" : "safe" }
      : null;

  // bump the tremor key exactly on the transition INTO a keystone arm — not
  // on every redundant hover+focus call for the same control
  useEffect(() => {
    if (armed?.kind === "keystone") setTremorNonce((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed?.index, armed?.kind]);

  // dependent indices of the currently-armed keystone, resolved live against
  // the present list — a dependent that's since been removed just drops out
  const armedDependentIndices = useMemo(() => {
    if (!armed || armed.kind !== "keystone" || !armedItem) return new Set<number>();
    const set = new Set<number>();
    for (const id of armedItem.dependents ?? []) {
      const idx = idToIndex.get(id);
      if (idx !== undefined) set.add(idx);
    }
    return set;
  }, [armed, armedItem, idToIndex]);

  const armedDependentNames = useMemo(() => {
    if (!armed || armed.kind !== "keystone" || !armedItem) return [] as string[];
    return (armedItem.dependents ?? [])
      .map((id) => items.find((it) => it.id === id)?.label)
      .filter((v): v is string => Boolean(v));
  }, [armed, armedItem, items]);

  const announce_ = (text: string) => {
    setAnnounce(text);
    if (announceTimerRef.current) window.clearTimeout(announceTimerRef.current);
    announceTimerRef.current = window.setTimeout(() => setAnnounce(""), ANNOUNCE_HOLD_MS);
  };

  const handleDeleteClick = (item: KeystoneLeanItem, index: number) => {
    if (isKeystone(item)) return; // guarded — a keystone is never deletable from here

    const rects: Record<string, DOMRect> = {};
    for (const it of items) {
      const el = stoneRefs.current[it.id];
      if (el) rects[it.id] = el.getBoundingClientRect();
    }
    oldRectsRef.current = rects;

    const next = items[index + 1] ?? items[index - 1] ?? null;
    pendingFocusRef.current = { id: next?.id ?? null };

    setHoverIndex(null);
    setFocusIndex(null);
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    announce_(`Removed ${item.label}.`);
    onDelete?.(item);
  };

  // FLIP: capture -> layout -> invert -> play, so the delete literally
  // finishes the previewed collapse rather than cutting to a fresh layout
  useLayoutEffect(() => {
    const oldRects = oldRectsRef.current;
    if (!oldRects) return;
    oldRectsRef.current = null;

    if (!reduced) {
      const next: Record<string, FlipDelta> = {};
      let any = false;
      for (const it of items) {
        const el = stoneRefs.current[it.id];
        const old = oldRects[it.id];
        if (!el || !old) continue;
        const now = el.getBoundingClientRect();
        const dx = old.left - now.left;
        const dy = old.top - now.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          next[it.id] = { dx, dy };
          any = true;
        }
      }
      if (any) {
        setFlipAnimating(false);
        setFlip(next);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setFlipAnimating(true);
            setFlip({});
          });
        });
        if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
        flipTimerRef.current = window.setTimeout(
          () => setFlipAnimating(false),
          COMMIT_MS + 80
        );
      }
    }

    const pending = pendingFocusRef.current;
    if (pending) {
      pendingFocusRef.current = null;
      const id = pending.id;
      if (id && deleteBtnRefs.current[id]) {
        deleteBtnRefs.current[id]?.focus();
      } else {
        containerRef.current?.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const stoneStyle = (i: number, id: string): React.CSSProperties => {
    const n = items.length;
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const edge = Math.abs(t - 0.5) * 2;
    const baseY = -(1 - edge) * ARCH_LIFT_PX;
    const baseRot = (t - 0.5) * 2 * ARCH_TILT_DEG;

    let leanX = 0;
    let leanRot = 0;
    let delayMs = 0;
    const leaning = !reduced && armed?.kind === "safe" && i !== armed.index;
    if (leaning && armed) {
      const d = i - armed.index;
      const ad = Math.abs(d);
      if (ad === 1 || ad === 2) {
        const armedEl = stoneRefs.current[items[armed.index]?.id ?? ""];
        const width = (armedEl?.offsetWidth ?? 96) + GAP_PX;
        const dir = d < 0 ? 1 : -1; // left neighbor moves right, right neighbor moves left
        leanX = dir * width * LEAN_FRACTION[ad];
        leanRot = dir * LEAN_ROTATE_DEG[ad];
        delayMs = (ad - 1) * LEAN_STAGGER_MS;
      }
    }

    const f = flip[id];
    const flipTransform = f ? `translate(${f.dx}px, ${f.dy}px) ` : "";
    const transform = `${flipTransform}translateY(${baseY}px) rotate(${(baseRot + leanRot).toFixed(3)}deg) translateX(${leanX.toFixed(2)}px)`;

    // FLIP has two frames: the "from" frame (flip[id] set) must snap with no
    // transition, then the very next frame clears it and animates to rest —
    // that second frame is flipAnimating, and it wins over everything else.
    let transition: string;
    if (reduced) {
      transition = "none";
    } else if (f) {
      transition = "none";
    } else if (flipAnimating) {
      transition = `transform ${COMMIT_MS}ms ${EXPO_OUT}`;
    } else if (leaning) {
      transition = `transform 220ms ${SPRING_OUT} ${delayMs}ms`;
    } else {
      transition = `transform 260ms ${SPRING_OUT}`;
    }

    // The armed stone must stay on top: leaning neighbors translate over its
    // box, and without this lift they cover the very delete control being
    // hovered — the pointer then hit-tests the neighbor, dropping hover and
    // flickering the preview (and blocking a real click mid-preview).
    return {
      transform,
      transition,
      zIndex: armed && armed.index === i ? 2 : undefined,
    };
  };

  const rowLabel = `${items.length} item${items.length === 1 ? "" : "s"}`;

  return (
    <div className={`relative w-full ${className}`}>
      <div
        ref={containerRef}
        tabIndex={-1}
        role="list"
        aria-label={`Dependency list, ${rowLabel}`}
        className="ns-keystone-lean flex flex-wrap items-end gap-4 outline-none"
      >
        {items.map((it, i) => {
          const keystone = isKeystone(it);
          const tremoring = !reduced && armedDependentIndices.has(i);
          const staticOutline =
            reduced &&
            ((armed?.kind === "safe" &&
              armed.index !== i &&
              Math.abs(i - armed.index) <= 2) ||
              armedDependentIndices.has(i));
          const descId = `ns-kl-desc-${it.id}`;
          const itemDependentNames = (it.dependents ?? [])
            .map((id) => items.find((x) => x.id === id)?.label ?? id)
            .join(", ");
          const describedText = keystone
            ? `blocked: ${it.dependents?.length ?? 0} item${
                (it.dependents?.length ?? 0) === 1 ? "" : "s"
              } depend on this: ${itemDependentNames}`
            : "safe to delete";

          return (
            <div
              key={it.id}
              ref={(el) => {
                stoneRefs.current[it.id] = el;
              }}
              role="listitem"
              style={stoneStyle(i, it.id)}
              className={[
                "will-change-transform rounded-md border border-border bg-surface px-4 py-3 shadow-sm",
                staticOutline ? "outline outline-2 outline-offset-2 outline-border" : "",
              ].join(" ")}
            >
              <div
                className={tremoring ? "ns-kl-tremor" : undefined}
                key={tremoring ? `tremor-${tremorNonce}` : "still"}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px] text-foreground">
                      {it.label}
                    </p>
                    {it.detail ? (
                      <p className="mt-0.5 truncate text-xs text-muted">{it.detail}</p>
                    ) : null}
                  </div>
                  <button
                    ref={(el) => {
                      deleteBtnRefs.current[it.id] = el;
                    }}
                    type="button"
                    aria-label={
                      keystone ? `Delete ${it.label} — blocked` : `Delete ${it.label}`
                    }
                    aria-describedby={descId}
                    aria-disabled={keystone || undefined}
                    data-kl-delete={keystone ? "blocked" : "safe"}
                    onClick={() => handleDeleteClick(it, i)}
                    onPointerEnter={() => setHoverIndex(i)}
                    onPointerLeave={() =>
                      setHoverIndex((h) => (h === i ? null : h))
                    }
                    onFocus={() => setFocusIndex(i)}
                    onBlur={() => setFocusIndex((f) => (f === i ? null : f))}
                    className={[
                      "ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      keystone
                        ? "border-muted text-muted hover:bg-muted/10"
                        : "border-border text-muted hover:border-foreground/40 hover:text-foreground",
                    ].join(" ")}
                  >
                    {keystone ? <StrikeGlyph /> : <XGlyph />}
                  </button>
                </div>
              </div>
              <span id={descId} className="sr-only">
                {describedText}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 min-h-[1.25rem]" aria-live="polite">
        {armedHereCaption(armed, armedItem, armedDependentNames)}
      </div>

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>

      <style>{`
@keyframes ns-kl-tremor {
  0% { transform: translateX(0); }
  15% { transform: translateX(1px); }
  30% { transform: translateX(-1px); }
  45% { transform: translateX(0.6px); }
  60% { transform: translateX(-0.6px); }
  75% { transform: translateX(0.3px); }
  90% { transform: translateX(-0.3px); }
  100% { transform: translateX(0); }
}
.ns-kl-tremor { animation: ns-kl-tremor 300ms ease-in-out; }
@media (prefers-reduced-motion: reduce) {
  .ns-kl-tremor { animation: none !important; }
}
      `}</style>
    </div>
  );
}

function armedHereCaption(
  armed: Armed,
  armedItem: KeystoneLeanItem | undefined,
  dependentNames: string[]
) {
  if (!armed || !armedItem) return null;
  if (armed.kind === "keystone") {
    return (
      <p data-kl-caption className="font-mono text-[11px] tracking-wide text-muted">
        blocked — {dependentNames.length} item{dependentNames.length === 1 ? "" : "s"} depend
        on this: {dependentNames.join(", ")}
      </p>
    );
  }
  return (
    <p data-kl-caption className="font-mono text-[11px] tracking-wide text-muted">
      safe to delete — closes the gap
    </p>
  );
}
