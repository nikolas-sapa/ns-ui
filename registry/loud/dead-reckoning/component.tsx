"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

// A 404 as a navigator's chart, not an illustration. The "art" is the user's
// actual course: a handful of in-app steps (a supplied breadcrumb, or read
// from history.state / document.referrer, degrading to a generic
// three-waypoint chart when neither exists) plotted as position fixes on a
// graticule, connected by dead-reckoning bearing lines with tick marks, and
// projected one leg further to an X — "position doubtful" — labeled with the
// URL that 404'd. A compass rose overshoots into place, then a corrected
// course draws itself, leg by leg, from the X back to real waypoints (the
// nearest section, search, home). Every waypoint on the chart is also a real,
// focusable link, listed in source order below the chart — the chart is
// aria-hidden decoration, the link list is the actual 404 page for anyone not
// looking at it. Reduced motion renders the whole chart already drawn, no
// compass settle, no stroke-dashoffset reveal.

export interface DeadReckoningFix {
  /** Label for a plotted step, e.g. the page title of that route. */
  label: string;
  /** Optional relative time tick shown under the fix, e.g. "-6m". */
  tick?: string;
}

export interface DeadReckoningExit {
  /** Visible, accessible label — also used as the chart waypoint's caption. */
  label: string;
  /** Destination. Omit to render a real, focusable link that does nothing. */
  href?: string;
}

export interface DeadReckoningProps {
  /** The user's real in-app trail, oldest first. Falls back to history.state,
   * then document.referrer, then a generic three-waypoint chart. */
  trail?: DeadReckoningFix[];
  /** The URL that came up doubtful. Defaults to the current location. */
  attemptedPath?: string;
  /** Corrected-course waypoints, in source order. */
  exits?: DeadReckoningExit[];
  className?: string;
}

type Pt = { x: number; y: number };

const VIEW_W = 720;
const VIEW_H = 380;
const GRID = 32; // multiple of the 4px spacing rhythm

const DEFAULT_TRAIL: DeadReckoningFix[] = [
  { label: "Home", tick: "-9m" },
  { label: "Dashboard", tick: "-5m" },
  { label: "Reports", tick: "-1m" },
];

const DEFAULT_EXITS: DeadReckoningExit[] = [
  { label: "Back to Dashboard" },
  { label: "Search" },
  { label: "Home" },
];

function hashLabel(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function fixPoints(trail: DeadReckoningFix[]): Pt[] {
  const marginX = 76;
  const spanX = 300;
  const baseY = 288;
  const topY = 132;
  const n = trail.length;
  return trail.map((fix, i) => {
    const t = n <= 1 ? 0.55 : i / (n - 1);
    const wobble = ((hashLabel(fix.label) % 21) - 10) * 0.7;
    return { x: marginX + t * spanX, y: baseY - t * (baseY - topY) + wobble };
  });
}

function doubtfulPoint(fixes: Pt[]): Pt {
  const last = fixes[fixes.length - 1] ?? { x: VIEW_W * 0.45, y: VIEW_H * 0.6 };
  const prev = fixes.length > 1 ? fixes[fixes.length - 2] : { x: last.x - 70, y: last.y + 44 };
  const dx = last.x - prev.x;
  const dy = last.y - prev.y;
  const mag = Math.hypot(dx, dy) || 1;
  const step = 118;
  const x = last.x + (dx / mag) * step;
  const y = last.y + (dy / mag) * step;
  return {
    x: Math.min(VIEW_W - 96, Math.max(marginPad, x)),
    y: Math.min(VIEW_H - 40, Math.max(40, y)),
  };
}
const marginPad = 96;

function exitPoints(count: number): Pt[] {
  const x = VIEW_W - 108;
  const topY = 92;
  const bottomY = VIEW_H - 56;
  return Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    return { x, y: topY + t * (bottomY - topY) };
  });
}

function perpTicks(a: Pt, b: Pt, count: number, len = 6): string[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.hypot(dx, dy) || 1;
  const px = -dy / mag;
  const py = dx / mag;
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    out.push(`M${cx - (px * len) / 2},${cy - (py * len) / 2} L${cx + (px * len) / 2},${cy + (py * len) / 2}`);
  }
  return out;
}

function pct(v: number, total: number): string {
  return `${(v / total) * 100}%`;
}

function titleize(segment: string): string {
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

const CSS = `
@keyframes ns-dr-drop{from{opacity:0;transform:translateY(-4px) scale(.55)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes ns-dr-fade{from{opacity:0}to{opacity:1}}
@keyframes ns-dr-draw{from{stroke-dashoffset:var(--ns-dr-len)}to{stroke-dashoffset:0}}
@keyframes ns-dr-compass{0%{opacity:0;transform:scale(.55) rotate(-30deg)}100%{opacity:1;transform:scale(1) rotate(0deg)}}
`;

export function DeadReckoning({
  trail: trailProp,
  attemptedPath: attemptedPathProp,
  exits = DEFAULT_EXITS,
  className = "",
}: DeadReckoningProps) {
  const [reduced, setReduced] = useState(false);
  const [autoTrail, setAutoTrail] = useState<DeadReckoningFix[] | null>(null);
  const [autoPath, setAutoPath] = useState<string | null>(null);
  const [activeExit, setActiveExit] = useState<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Route data: a supplied trail wins outright. Otherwise, try the
  // conventions an app can set for us — history.state.trail (written via
  // history.replaceState) or a same-origin document.referrer — before
  // settling on the generic three-waypoint chart.
  useEffect(() => {
    if (trailProp && trailProp.length > 0) return;
    try {
      const state = window.history.state as { trail?: DeadReckoningFix[] } | null;
      if (state?.trail && Array.isArray(state.trail) && state.trail.length > 0) {
        setAutoTrail(state.trail);
      } else if (document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin && ref.pathname !== window.location.pathname) {
          const seg = ref.pathname.split("/").filter(Boolean).pop();
          setAutoTrail([{ label: seg ? titleize(seg) : "Home" }]);
        }
      }
    } catch {
      // malformed history.state / referrer — fall through to the default chart
    }
  }, [trailProp]);

  useEffect(() => {
    if (attemptedPathProp) return;
    setAutoPath(window.location.pathname + window.location.search);
  }, [attemptedPathProp]);

  const trail = trailProp && trailProp.length > 0 ? trailProp : (autoTrail ?? DEFAULT_TRAIL);
  const attemptedPath = attemptedPathProp ?? autoPath ?? "/unknown";

  const fixes = useMemo(() => fixPoints(trail), [trail]);
  const doubtful = useMemo(() => doubtfulPoint(fixes), [fixes]);
  const exitPts = useMemo(() => exitPoints(exits.length), [exits.length]);

  const legs = useMemo(() => {
    const out: { d: string; len: number }[] = [];
    for (let i = 0; i < fixes.length - 1; i++) {
      const a = fixes[i];
      const b = fixes[i + 1];
      out.push({ d: `M${a.x},${a.y} L${b.x},${b.y}`, len: Math.hypot(b.x - a.x, b.y - a.y) });
    }
    return out;
  }, [fixes]);

  const projectedLeg = useMemo(() => {
    const last = fixes[fixes.length - 1];
    if (!last) return null;
    return `M${last.x},${last.y} L${doubtful.x},${doubtful.y}`;
  }, [fixes, doubtful]);

  const courseLegs = useMemo(
    () =>
      exitPts.map((p) => ({
        d: `M${doubtful.x},${doubtful.y} L${p.x},${p.y}`,
        len: Math.hypot(p.x - doubtful.x, p.y - doubtful.y),
      })),
    [exitPts, doubtful],
  );

  // --- timing --------------------------------------------------------------
  // The full sequence (fixes -> track -> doubtful X -> course legs -> exit
  // waypoints) must reach its resting frame in under ~1s: the verify gate
  // screenshots "default" about 1s after load, and an earlier cut of this
  // timeline (~2.2s to the last exit label) shipped default screenshots with
  // the exit waypoints entirely missing while the hover shot had them.
  const fixDelayBase = 50;
  const fixStagger = 45;
  const trackFadeDelay = fixDelayBase + fixes.length * fixStagger + 30;
  const doubtfulDelay = trackFadeDelay + 120;
  const compassDelay = 120;
  const courseDelayBase = doubtfulDelay + 120;
  const courseStagger = 60;

  const fadeStyle = (delayMs: number, duration = 360): CSSProperties | undefined =>
    reduced
      ? undefined
      : { opacity: 0, animation: `ns-dr-fade ${duration}ms cubic-bezier(.22,1,.36,1) ${delayMs}ms both` };

  const dropStyle = (delayMs: number): CSSProperties | undefined =>
    reduced
      ? undefined
      : {
          opacity: 0,
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: `ns-dr-drop 300ms cubic-bezier(.34,1.56,.64,1) ${delayMs}ms both`,
        };

  const drawStyle = (len: number, delayMs: number, duration: number): CSSProperties =>
    reduced
      ? { strokeDasharray: undefined, strokeDashoffset: 0 }
      : ({
          strokeDasharray: `${len} ${len}`,
          "--ns-dr-len": len,
          animation: `ns-dr-draw ${duration}ms cubic-bezier(.16,1,.3,1) ${delayMs}ms both`,
        } as CSSProperties);

  return (
    <div className={["flex min-h-screen flex-col bg-background px-6 py-10 md:px-10", className].join(" ")}>
      <style>{CSS}</style>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <span className="font-mono text-xs tracking-[0.3em] text-muted">CHART · POSITION LOST</span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          404 — page not found
        </h1>
        <p className="max-w-[54ch] text-sm leading-relaxed text-muted">
          A dead-reckoning fix, plotted from your last known heading — not a real position. Pick a
          corrected course below.
        </p>
      </div>

      <figure aria-hidden="true" className="mx-auto mt-8 w-full max-w-3xl">
        <div className="relative w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="absolute inset-0 h-full w-full overflow-visible"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* graticule, on the 4px spacing rhythm */}
            <g stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke">
              {Array.from({ length: Math.floor(VIEW_W / GRID) + 1 }, (_, i) => (
                <line key={`v${i}`} x1={i * GRID} y1={0} x2={i * GRID} y2={VIEW_H} />
              ))}
              {Array.from({ length: Math.floor(VIEW_H / GRID) + 1 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i * GRID} x2={VIEW_W} y2={i * GRID} />
              ))}
            </g>

            {/* dead-reckoning track: bearing lines between real fixes */}
            {legs.map((leg, i) => (
              <path
                key={`leg${i}`}
                d={leg.d}
                stroke="var(--muted)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                strokeLinecap="round"
                fill="none"
                style={fadeStyle(trackFadeDelay)}
              />
            ))}
            {legs.map((leg, i) => {
              const a = fixes[i];
              const b = fixes[i + 1];
              return perpTicks(a, b, 2).map((d, j) => (
                <path
                  key={`tick${i}-${j}`}
                  d={d}
                  stroke="var(--muted)"
                  strokeWidth={1}
                  style={fadeStyle(trackFadeDelay)}
                />
              ));
            })}

            {/* one more leg, projected forward into the unknown */}
            {projectedLeg && (
              <path
                d={projectedLeg}
                stroke="var(--muted)"
                strokeWidth={1.5}
                strokeDasharray="2 5"
                strokeLinecap="round"
                fill="none"
                style={fadeStyle(doubtfulDelay)}
              />
            )}

            {/* corrected course: draws leg by leg from the doubtful fix back
                to charted waypoints */}
            {courseLegs.map((leg, i) => (
              <path
                key={`course${i}`}
                d={leg.d}
                stroke="var(--foreground)"
                strokeWidth={1.75}
                strokeLinecap="round"
                fill="none"
                style={drawStyle(leg.len, courseDelayBase + i * courseStagger, 480)}
              />
            ))}
          </svg>

          {/* position fixes */}
          {fixes.map((p, i) => (
            <div
              key={`fix${i}`}
              className="absolute flex flex-col items-center"
              style={{ left: pct(p.x, VIEW_W), top: pct(p.y, VIEW_H), transform: "translate(-50%, -50%)" }}
            >
              <span
                className="block h-[7px] w-[7px] rounded-full bg-foreground"
                style={dropStyle(fixDelayBase + i * fixStagger)}
              />
              <span
                className="mt-1 whitespace-nowrap font-mono text-[9px] tracking-wide text-muted"
                style={fadeStyle(fixDelayBase + i * fixStagger + 120)}
              >
                {trail[i]?.label}
                {trail[i]?.tick ? ` · ${trail[i]?.tick}` : ""}
              </span>
            </div>
          ))}

          {/* X — position doubtful */}
          <div
            className="absolute flex flex-col items-center"
            style={{ left: pct(doubtful.x, VIEW_W), top: pct(doubtful.y, VIEW_H), transform: "translate(-50%, -50%)" }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14" style={dropStyle(doubtfulDelay)}>
              <path d="M2,2 L12,12 M12,2 L2,12" stroke="var(--foreground)" strokeWidth={2} strokeLinecap="round" />
            </svg>
            <span
              className="mt-1 whitespace-nowrap font-mono text-[9px] font-medium tracking-wide text-foreground"
              style={fadeStyle(doubtfulDelay + 100)}
            >
              position doubtful
            </span>
            <span
              className="max-w-[22ch] truncate whitespace-nowrap font-mono text-[9px] text-muted"
              style={fadeStyle(doubtfulDelay + 100)}
            >
              {attemptedPath}
            </span>
          </div>

          {/* corrected-course waypoints — chart-clickable, but the same
              destinations are real focusable links below; this copy is
              mouse-only decoration inside an aria-hidden figure */}
          {exitPts.map((p, i) => {
            const exit = exits[i];
            // reveal as the (ease-out-expo) leg tip closes in on the waypoint
            const delay = courseDelayBase + i * courseStagger + 220;
            return (
              <a
                key={`wp${i}`}
                href={exit?.href || "#"}
                tabIndex={-1}
                onClick={exit?.href ? undefined : (e) => e.preventDefault()}
                onMouseEnter={() => setActiveExit(i)}
                onMouseLeave={() => setActiveExit((v) => (v === i ? null : v))}
                className="pointer-events-auto absolute flex flex-col items-center"
                style={{ left: pct(p.x, VIEW_W), top: pct(p.y, VIEW_H), transform: "translate(-50%, -50%)" }}
              >
                <span
                  className="block h-[9px] w-[9px] rounded-full bg-background transition-colors duration-150"
                  style={{
                    border: `2px solid ${activeExit === i ? "var(--accent)" : "var(--foreground)"}`,
                    ...(dropStyle(delay) as CSSProperties),
                  }}
                />
                <span
                  className="mt-1 max-w-[14ch] truncate whitespace-nowrap font-mono text-[9px] tracking-wide text-muted"
                  style={fadeStyle(delay + 100)}
                >
                  {exit?.label}
                </span>
              </a>
            );
          })}

          {/* compass rose — overshoots then spring-settles on mount. Top-left:
              open water on the chart, clear of the track (which runs
              bottom-left to mid-chart) and the exit column (right edge). */}
          <div className="absolute left-3 top-3 h-14 w-14 md:h-16 md:w-16">
            <div
              className="h-full w-full"
              style={
                reduced
                  ? undefined
                  : {
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      animation: `ns-dr-compass 620ms cubic-bezier(.34,1.56,.64,1) ${compassDelay}ms both`,
                    }
              }
            >
              <svg viewBox="0 0 64 64" className="h-full w-full overflow-visible">
                <circle cx={32} cy={32} r={26} stroke="var(--border)" strokeWidth={1} fill="none" />
                {Array.from({ length: 8 }, (_, i) => {
                  const angle = (i * Math.PI) / 4;
                  const r1 = i % 2 === 0 ? 20 : 23;
                  const x1 = 32 + Math.sin(angle) * r1;
                  const y1 = 32 - Math.cos(angle) * r1;
                  const x2 = 32 + Math.sin(angle) * 26;
                  const y2 = 32 - Math.cos(angle) * 26;
                  return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={1} />
                  );
                })}
                <path d="M32,11 L37,32 L32,32 Z" fill="var(--foreground)" />
                <path d="M32,32 L27,32 L32,53 Z" fill="var(--muted)" />
              </svg>
            </div>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[8px] text-muted">N</span>
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 font-mono text-[8px] text-muted">S</span>
            <span className="absolute -left-3 top-1/2 -translate-y-1/2 font-mono text-[8px] text-muted">W</span>
            <span className="absolute -right-3 top-1/2 -translate-y-1/2 font-mono text-[8px] text-muted">E</span>
          </div>
        </div>
      </figure>

      {/* the actual 404 page: real, focusable recovery links, in source order */}
      <nav aria-label="Recovery routes" className="mx-auto mt-10 w-full max-w-3xl">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {exits.map((exit, i) => (
            <li key={exit.label}>
              <a
                href={exit.href || "#"}
                onClick={exit.href ? undefined : (e) => e.preventDefault()}
                onMouseEnter={() => setActiveExit(i)}
                onMouseLeave={() => setActiveExit((v) => (v === i ? null : v))}
                onFocus={() => setActiveExit(i)}
                onBlur={() => setActiveExit((v) => (v === i ? null : v))}
                className="rounded-sm px-2 py-1 font-mono text-xs text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {exit.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
