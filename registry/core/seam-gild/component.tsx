"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SeamGild — a kintsugi payoff for consequential actions. Confirming a
// weighty action (payment cleared, migration finished, plan upgraded) fires
// a hairline crack that races across the panel in ~400ms as a biased random
// walk with one branch, then is immediately re-filled from both ends toward
// its middle as a bright raised seam. The seam stays for the rest of the
// browser session — repeated confirmations accumulate distinct scars, so the
// panel's history becomes visible ornament instead of a moment that fades.
//
// Distinct on purpose from two siblings that share the "weighty confirm"
// slot: success-nucleation grows an ordered crystal out of a supercooled
// field (order emerging from disorder, and nothing persists between
// successes — the field just resets). confirm-slide-shatter destroys the
// pane on commit (glass explodes, the surface is gone). SeamGild repairs:
// the panel is damaged and then visibly mended, and the mend is the only
// trace left once the motion stops — successive confirmations accumulate as
// ornament instead of evaporating or resetting.
//
// MECHANISM: on confirm, one seed point is picked on the panel's border
// (retried against a measured exclusion list — the content block, the
// button, the status line — so the crack never starts inside one of them),
// then a short biased random walk grows inward: each step nudges the
// previous heading by a small jitter, and any step that would land inside
// an excluded rect resamples its angle a few times before the walk just
// stops early — a shorter, valid crack rather than an invalid one. Partway
// along, one branch forks off at roughly a 60deg turn and walks a shorter
// distance under the same avoidance.
//
// Both polylines render as SVG <path>s with pathLength=1 (so the real pixel
// length never has to be measured): dasharray "1", dashoffset animated
// 1 -> 0 over 400ms in --border is the crack drawing itself outward from
// the origin — the branch runs on the same 400ms clock but starts partway
// through, so it visibly forks off the trunk mid-propagation rather than
// growing from t=0 alongside it.
//
// The instant the crack finishes, the gild pass starts: the same polyline,
// once forward and once with its points reversed, both pathLength=1
// dashoffset 1 -> 0.5 over ~450ms in --foreground at 1.5px — forward
// reveals the first half from the origin, reversed reveals the first half
// of the flipped path (= the original's second half) from the far end, so
// the bright seam visibly closes toward the middle from both ends at once.
// A `drop-shadow(0 -1px 0 …)` filter on that same stroke is the raised
// highlight — a 1px offset duplicate of exactly the currently-revealed
// geometry, not a separate animated path. The original hairline crack
// stays underneath as the seam's groove.
//
// PERSISTENCE: each finished seam's points (normalized to fractions of the
// panel's box, so a later resize rescales instead of replaying stale pixel
// coordinates) are appended to a capped list kept in sessionStorage under
// `ns-seam-gild:<storageKey>`, alongside a running confirmation count under
// the same key + `:count` — kept separately so the visible tally stays
// accurate even on the rare panel too crowded to fit a new seam (the
// confirmation still counts; it just had nowhere safe left to draw). Seams
// loaded from storage render at their finished, gilded state directly, no
// crack-then-gild replay — only the seam added in the current mount plays
// the intro.
//
// A11Y: the crack/seam SVG layer is aria-hidden and pointer-events:none —
// decoration only, absolutely positioned so it never participates in
// layout or hit-testing. The real confirmation is a role=status
// aria-live=assertive region that receives confirmedMessage the instant
// the action resolves, entirely independent of whether the crack animation
// plays, finishes, or even finds room to draw. A second, visible
// role=status aria-live=polite line tracks the running seam count for
// sighted users. prefers-reduced-motion skips the crack/gild propagation
// entirely and renders every new seam at its finished, gilded state
// immediately — the same code path used for seams loaded from storage.
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };
type Stage = "preCrack" | "crack" | "preGild" | "gild" | "settled";

type SeamRecord = {
  id: string;
  /** normalized [0..1] points, fractions of the panel box at creation time */
  trunk: [number, number][];
  branch: [number, number][] | null;
};

const CRACK_MS = 400;
const GILD_MS = 450;
// Idle stress hairline — the panel's "alive at rest" tell before any
// confirmation exists. Same geometry engine as a real crack (buildSeam), a
// fraction of the opacity, --border only (no --foreground, no gild
// highlight), so it never risks reading as a finished seam or a rendering
// glitch: draws in, holds faintly, dissolves, and a new one starts
// elsewhere after a pause. Only shown while the panel has no real seams yet
// — once one exists, the panel already has its own trace and doesn't also
// need an ambient hint.
const IDLE_START_MS = 900;
const IDLE_APPEAR_MS = 1300;
const IDLE_HOLD_MS = 2600;
const IDLE_FADE_MS = 1200;
const IDLE_GAP_MS = 1400;
const IDLE_OPACITY = 0.42;
const BRANCH_START_FRAC = 0.42; // branch begins this far into the trunk's crack timeline
const STEP = 8; // px per walk step
const EXCLUDE_PAD = 6; // px padding around an excluded rect
const MAX_SEAMS = 5;
const MAX_STEP_ATTEMPTS = 6; // per-step retries before a walk just stops early
const MAX_START_ATTEMPTS = 20;
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const HIGHLIGHT_FILTER =
  "drop-shadow(0 -1px 0 color-mix(in srgb, var(--foreground) 55%, transparent))";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pointInRects(x: number, y: number, rects: DOMRect[], pad: number): boolean {
  return rects.some(
    (r) => x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad
  );
}

/** biased random walk: each step nudges the previous heading, resamples the
 * angle a few times if it would land inside an excluded rect, and simply
 * stops early once it runs out of retries. */
function walk(
  start: Pt,
  startAngle: number,
  steps: number,
  w: number,
  h: number,
  avoid: DOMRect[]
): Pt[] {
  const pts: Pt[] = [start];
  let { x, y } = start;
  let angle = startAngle;
  for (let i = 0; i < steps; i++) {
    let placed = false;
    for (let attempt = 0; attempt < MAX_STEP_ATTEMPTS && !placed; attempt++) {
      const a = angle + (Math.random() - 0.5) * (0.45 + attempt * 0.5);
      const nx = x + Math.cos(a) * STEP;
      const ny = y + Math.sin(a) * STEP;
      if (nx < 3 || nx > w - 3 || ny < 3 || ny > h - 3) {
        angle += (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 3);
        continue;
      }
      if (pointInRects(nx, ny, avoid, EXCLUDE_PAD)) {
        angle += (Math.random() - 0.5) * 1.8;
        continue;
      }
      x = nx;
      y = ny;
      angle = a;
      pts.push({ x, y });
      placed = true;
    }
    if (!placed) break;
  }
  return pts;
}

function pickStart(w: number, h: number, avoid: DOMRect[]): { pt: Pt; angle: number } | null {
  const cx = w / 2;
  const cy = h / 2;
  for (let i = 0; i < MAX_START_ATTEMPTS; i++) {
    const edge = Math.floor(Math.random() * 4);
    let pt: Pt;
    if (edge === 0) pt = { x: Math.random() * w, y: 4 };
    else if (edge === 1) pt = { x: w - 4, y: Math.random() * h };
    else if (edge === 2) pt = { x: Math.random() * w, y: h - 4 };
    else pt = { x: 4, y: Math.random() * h };
    if (pointInRects(pt.x, pt.y, avoid, EXCLUDE_PAD)) continue;
    const angle = Math.atan2(cy - pt.y, cx - pt.x) + (Math.random() - 0.5) * 0.8;
    return { pt, angle };
  }
  return null;
}

/** builds a trunk + one branch, both avoidance-aware, in panel-pixel space */
function buildSeam(
  w: number,
  h: number,
  avoid: DOMRect[]
): { trunk: Pt[]; branch: Pt[] | null } | null {
  if (w < 40 || h < 40) return null;
  const start = pickStart(w, h, avoid);
  if (!start) return null;
  const diag = Math.hypot(w, h);
  const steps = clamp(Math.round((diag / STEP) * 0.55), 6, 40);
  const trunk = walk(start.pt, start.angle, steps, w, h, avoid);
  if (trunk.length < 3) return null;

  const bi = clamp(Math.floor(trunk.length * (0.35 + Math.random() * 0.3)), 1, trunk.length - 2);
  const before = trunk[bi - 1]!;
  const at = trunk[bi]!;
  const trunkAngle = Math.atan2(at.y - before.y, at.x - before.x);
  const side = Math.random() < 0.5 ? 1 : -1;
  const branchAngle = trunkAngle + side * (0.9 + Math.random() * 0.35);
  const branchSteps = clamp(Math.round((trunk.length - bi) * 0.9), 3, 20);
  const branchRaw = walk(at, branchAngle, branchSteps, w, h, avoid);
  const branch = branchRaw.length >= 3 ? branchRaw : null;

  return { trunk, branch };
}

function toPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function normalize(pts: Pt[], w: number, h: number): [number, number][] {
  return pts.map((p) => [p.x / w, p.y / h]);
}

function denormalize(pts: [number, number][], w: number, h: number): Pt[] {
  return pts.map(([nx, ny]) => ({ x: nx * w, y: ny * h }));
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function storageKeyFor(storageKey: string) {
  return `ns-seam-gild:${storageKey}`;
}

function readSeams(storageKey: string): SeamRecord[] {
  try {
    const raw = window.sessionStorage.getItem(storageKeyFor(storageKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSeams(storageKey: string, seams: SeamRecord[]) {
  try {
    window.sessionStorage.setItem(storageKeyFor(storageKey), JSON.stringify(seams));
  } catch {
    // storage unavailable (private mode, quota) — the seam still renders for
    // this mount, it just won't survive a reload. Not fatal.
  }
}

function readCount(storageKey: string): number {
  try {
    const raw = window.sessionStorage.getItem(`${storageKeyFor(storageKey)}:count`);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeCount(storageKey: string, n: number) {
  try {
    window.sessionStorage.setItem(`${storageKeyFor(storageKey)}:count`, String(n));
  } catch {
    // see writeSeams
  }
}

// ---------------------------------------------------------------------------

/** one gild stroke pair (forward + reversed) for a single polyline segment */
function GildSegment({ pts, offset }: { pts: Pt[]; offset: number }) {
  const forwardD = toPath(pts);
  const reversedD = toPath([...pts].reverse());
  const style = {
    strokeDashoffset: offset,
    transition: `stroke-dashoffset ${GILD_MS}ms ${EASE}`,
    filter: HIGHLIGHT_FILTER,
  } as const;
  return (
    <>
      <path
        d={forwardD}
        pathLength={1}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray={1}
        style={style}
      />
      <path
        d={reversedD}
        pathLength={1}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray={1}
        style={style}
      />
    </>
  );
}

function SeamMark({
  trunk,
  branch,
  playIntro,
}: {
  trunk: Pt[];
  branch: Pt[] | null;
  playIntro: boolean;
}) {
  const [stage, setStage] = useState<Stage>(playIntro ? "preCrack" : "settled");

  useEffect(() => {
    if (stage === "preCrack") {
      const raf = requestAnimationFrame(() => setStage("crack"));
      return () => cancelAnimationFrame(raf);
    }
    if (stage === "crack") {
      const t = window.setTimeout(() => setStage("preGild"), CRACK_MS + 20);
      return () => window.clearTimeout(t);
    }
    if (stage === "preGild") {
      const raf = requestAnimationFrame(() => setStage("gild"));
      return () => cancelAnimationFrame(raf);
    }
    if (stage === "gild") {
      const t = window.setTimeout(() => setStage("settled"), GILD_MS + 20);
      return () => window.clearTimeout(t);
    }
  }, [stage]);

  const trunkOffset = stage === "preCrack" ? 1 : 0;
  const branchOffset = stage === "preCrack" ? 1 : 0;
  const showGild = stage === "preGild" || stage === "gild" || stage === "settled";
  const gildOffset = stage === "preGild" ? 1 : 0.5;

  return (
    <g>
      {/* crack: the groove, stays visible under the gild */}
      <path
        d={toPath(trunk)}
        pathLength={1}
        fill="none"
        stroke="var(--border)"
        strokeWidth={1}
        strokeLinecap="round"
        strokeDasharray={1}
        style={{
          strokeDashoffset: trunkOffset,
          transition: `stroke-dashoffset ${CRACK_MS}ms ${EASE}`,
        }}
      />
      {branch && (
        <path
          d={toPath(branch)}
          pathLength={1}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
          strokeLinecap="round"
          strokeDasharray={1}
          style={{
            strokeDashoffset: branchOffset,
            transition: `stroke-dashoffset ${CRACK_MS * (1 - BRANCH_START_FRAC)}ms ${EASE}`,
            transitionDelay: `${CRACK_MS * BRANCH_START_FRAC}ms`,
          }}
        />
      )}

      {/* gild: bright raised seam, re-filling inward from both ends */}
      {showGild && (
        <>
          <GildSegment pts={trunk} offset={gildOffset} />
          {branch && <GildSegment pts={branch} offset={gildOffset} />}
        </>
      )}
    </g>
  );
}

/** one hairline draw-in, mirroring SeamMark's own preCrack -> crack tick so
 * the transition actually animates instead of snapping on mount. */
function IdleStressStroke({ trunk }: { trunk: Pt[] }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <path
      d={toPath(trunk)}
      pathLength={1}
      fill="none"
      stroke="var(--border)"
      strokeWidth={1}
      strokeLinecap="round"
      strokeDasharray={1}
      style={{
        strokeDashoffset: drawn ? 0 : 1,
        transition: `stroke-dashoffset ${IDLE_APPEAR_MS}ms ${EASE}`,
      }}
    />
  );
}

type IdleStage = "hidden" | "appear" | "hold" | "fade";

/** the pristine panel's idle tell — see the constants above for why this
 * exists and stays this restrained. */
function IdleStress({
  panelRef,
  box,
}: {
  panelRef: { current: HTMLDivElement | null };
  box: { w: number; h: number };
}) {
  const [trunk, setTrunk] = useState<Pt[] | null>(null);
  const [cycleKey, setCycleKey] = useState(0);
  const [stage, setStage] = useState<IdleStage>("hidden");

  useEffect(() => {
    if (box.w <= 0 || box.h <= 0) return;
    let cancelled = false;
    let timer: number | undefined;

    const schedule = (fn: () => void, ms: number) => {
      timer = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const tryBuild = () => {
      const panel = panelRef.current;
      if (!panel) {
        schedule(tryBuild, IDLE_GAP_MS);
        return;
      }
      const panelRect = panel.getBoundingClientRect();
      const avoid = Array.from(panel.querySelectorAll<HTMLElement>("[data-seam-avoid]")).map(
        (el) => {
          const r = el.getBoundingClientRect();
          return new DOMRect(r.left - panelRect.left, r.top - panelRect.top, r.width, r.height);
        }
      );
      const built = buildSeam(box.w, box.h, avoid);
      if (!built) {
        schedule(tryBuild, IDLE_GAP_MS); // too crowded this cycle — retry after the usual gap
        return;
      }
      setTrunk(built.trunk);
      setCycleKey((k) => k + 1);
      setStage("appear");
      schedule(() => {
        setStage("hold");
        schedule(fadeOut, IDLE_HOLD_MS);
      }, IDLE_APPEAR_MS);
    };
    const fadeOut = () => {
      setStage("fade");
      schedule(() => {
        setStage("hidden");
        schedule(tryBuild, IDLE_GAP_MS);
      }, IDLE_FADE_MS);
    };

    schedule(tryBuild, IDLE_START_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [box.w, box.h, panelRef]);

  if (!trunk || stage === "hidden") return null;
  return (
    <g
      style={{
        opacity: stage === "fade" ? 0 : IDLE_OPACITY,
        transition: `opacity ${stage === "fade" ? IDLE_FADE_MS : IDLE_APPEAR_MS}ms ${EASE}`,
      }}
    >
      <IdleStressStroke key={cycleKey} trunk={trunk} />
    </g>
  );
}

// ---------------------------------------------------------------------------

export interface SeamGildProps {
  /** idle button label — the weighty action being confirmed. default "Confirm payment" */
  actionLabel?: string;
  /** button label while awaiting an async onConfirm. default "Processing…" */
  pendingLabel?: string;
  /** the real confirmation: fired into an aria-live=assertive region the instant the action resolves, independent of the visual. default "Payment cleared." */
  confirmedMessage?: string;
  /** short description shown in the panel body */
  description?: string;
  /** called on trigger; return a Promise and the seam fires on resolve (reverts to idle on reject) */
  onConfirm?: () => void | Promise<void>;
  /** sessionStorage namespace — give concurrent panels on one page distinct keys. default "panel" */
  storageKey?: string;
  /** how many seams the panel keeps before the oldest is retired. default 5 */
  maxSeams?: number;
  /** bump to wipe this panel's stored seams and start fresh */
  resetKey?: number;
  className?: string;
}

export function SeamGild({
  actionLabel = "Confirm payment",
  pendingLabel = "Processing…",
  confirmedMessage = "Payment cleared.",
  description = "One tap commits the charge. Every confirmation leaves its own mark on this panel for the rest of the session.",
  onConfirm,
  storageKey = "panel",
  maxSeams = MAX_SEAMS,
  resetKey = 0,
  className = "",
}: SeamGildProps) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [seams, setSeams] = useState<SeamRecord[]>([]);
  const [newestId, setNewestId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [count, setCount] = useState(0);
  const [pendingBuild, setPendingBuild] = useState(0);
  const idRef = useRef(0);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  // load persisted seams for this key on mount / when storageKey or resetKey changes
  useEffect(() => {
    if (resetKey > 0) {
      writeSeams(storageKey, []);
      writeCount(storageKey, 0);
      setSeams([]);
      setCount(0);
    } else {
      setSeams(readSeams(storageKey));
      setCount(readCount(storageKey));
    }
    setNewestId(null);
  }, [storageKey, resetKey]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      const r = panel.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);

  async function handleConfirm() {
    if (pending) return;
    const result = onConfirmRef.current?.();
    if (result && typeof (result as Promise<void>).then === "function") {
      setPending(true);
      try {
        await result;
      } catch {
        setPending(false);
        return;
      }
      setPending(false);
    }

    // the real confirmation: fires no matter what happens to the visual below
    const nextCount = readCount(storageKey) + 1;
    writeCount(storageKey, nextCount);
    setCount(nextCount);
    setAnnouncement(confirmedMessage);

    // defer the crack geometry to the layout effect below, which runs after
    // this render (the count above included) has actually committed to the
    // DOM — see its comment for why that ordering matters.
    setPendingBuild((n) => n + 1);
  }

  // Builds a seam against exclusion rects measured from the DOM *after* the
  // triggering render committed. Measuring inside handleConfirm instead
  // (synchronously, before React flushes the state updates above) missed
  // the counter on exactly the confirmation that makes it first appear —
  // count goes 0 -> 1 in the same click that starts the crack, so
  // `querySelectorAll("[data-seam-avoid]")` ran against DOM that hadn't
  // grown the counter span yet, and the crack could route straight through
  // where the number was about to land.
  useLayoutEffect(() => {
    if (pendingBuild === 0) return; // nothing pending on initial mount
    const panel = panelRef.current;
    if (!panel || box.w <= 0 || box.h <= 0) return;
    const panelRect = panel.getBoundingClientRect();
    const localAvoid = Array.from(panel.querySelectorAll<HTMLElement>("[data-seam-avoid]")).map(
      (el) => {
        const r = el.getBoundingClientRect();
        return new DOMRect(r.left - panelRect.left, r.top - panelRect.top, r.width, r.height);
      }
    );
    const built = buildSeam(box.w, box.h, localAvoid);
    if (!built) return; // too crowded to fit a new seam this time — confirmation still counted above

    idRef.current += 1;
    const record: SeamRecord = {
      id: `${Date.now()}-${idRef.current}`,
      trunk: normalize(built.trunk, box.w, box.h),
      branch: built.branch ? normalize(built.branch, box.w, box.h) : null,
    };

    setSeams((prev) => {
      const next = [...prev, record].slice(-maxSeams);
      writeSeams(storageKey, next);
      return next;
    });
    setNewestId(record.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBuild]);

  return (
    <div
      ref={panelRef}
      className={`relative overflow-hidden rounded-[12px] border border-border bg-background p-6 ${className}`}
    >
      <svg
        aria-hidden="true"
        role="presentation"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${Math.max(1, box.w)} ${Math.max(1, box.h)}`}
        preserveAspectRatio="none"
      >
        {box.w > 0 && box.h > 0 && seams.length === 0 && !reduced && (
          <IdleStress panelRef={panelRef} box={box} />
        )}
        {box.w > 0 &&
          box.h > 0 &&
          seams.map((s) => (
            <SeamMark
              key={s.id}
              trunk={denormalize(s.trunk, box.w, box.h)}
              branch={s.branch ? denormalize(s.branch, box.w, box.h) : null}
              playIntro={!reduced && s.id === newestId}
            />
          ))}
      </svg>

      <div data-seam-avoid className="relative flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / seam-gild
        </p>
        <p className="max-w-sm text-sm text-foreground">{description}</p>
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          data-seam-gild-trigger
          data-seam-avoid
          onClick={handleConfirm}
          disabled={pending}
          className="rounded-[6px] border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-ns-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? pendingLabel : actionLabel}
        </button>

        {count > 0 && (
          <span
            data-seam-gild-status
            data-seam-avoid
            role="status"
            aria-live="polite"
            className="font-mono text-xs text-ns-muted"
          >
            {count} seam{count === 1 ? "" : "s"} this session
          </span>
        )}
      </div>

      {/* the real confirmation — independent of whether the visual seam drew */}
      <span role="status" aria-live="assertive" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
