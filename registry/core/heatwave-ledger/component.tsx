"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from "react";

// ---------------------------------------------------------------------------
// HeatwaveLedger — dense ops table where rows above a heat threshold shimmer
// like air over asphalt: real DOM text refracts through an animated SVG
// feTurbulence → feDisplacementMap filter (one filter per hot-row slot, unique
// per instance), while cold rows sit dead-still behind hairline borders. A
// pointer-events-none overlay canvas adds per-hot-row edge haze strips, fully
// cleared and redrawn each frame. The hot/cold contrast IS the piece — warmth
// is implied by motion, never by hue. One shared rAF walks only the hot list;
// hover/focus on a hot row snaps its displacement to 0 for legibility.
// ---------------------------------------------------------------------------

export type LedgerRow = {
  id: string;
  /** service name */
  service: string;
  /** deploy region */
  region: string;
  /** requests per second */
  reqs: number;
  /** p95 latency in ms */
  p95: number;
  /** heat score 0–100 — rows at/above `threshold` shimmer */
  heat: number;
};

type SortKey = "service" | "region" | "reqs" | "p95" | "heat";
type SortDir = "asc" | "desc";

type Vec3 = [number, number, number];

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const DEFAULT_ROWS: LedgerRow[] = [
  { id: "edge-gateway", service: "edge-gateway", region: "iad-1", reqs: 12480, p95: 811, heat: 92 },
  { id: "auth-service", service: "auth-service", region: "fra-1", reqs: 8921, p95: 640, heat: 84 },
  { id: "search-index", service: "search-index", region: "sfo-2", reqs: 6115, p95: 505, heat: 76 },
  { id: "billing-api", service: "billing-api", region: "iad-1", reqs: 2210, p95: 189, heat: 48 },
  { id: "media-transcode", service: "media-transcode", region: "ams-1", reqs: 940, p95: 152, heat: 41 },
  { id: "notifications", service: "notifications", region: "sfo-2", reqs: 3308, p95: 96, heat: 34 },
  { id: "feature-flags", service: "feature-flags", region: "fra-1", reqs: 5170, p95: 22, heat: 21 },
  { id: "audit-log", service: "audit-log", region: "iad-2", reqs: 1204, p95: 64, heat: 18 },
  { id: "static-assets", service: "static-assets", region: "global", reqs: 22930, p95: 12, heat: 11 },
  { id: "cron-runner", service: "cron-runner", region: "ams-1", reqs: 88, p95: 45, heat: 7 },
];

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "service", label: "Service", numeric: false },
  { key: "region", label: "Region", numeric: false },
  { key: "reqs", label: "Req/s", numeric: true },
  { key: "p95", label: "p95 ms", numeric: true },
  { key: "heat", label: "Heat", numeric: true },
];

// shimmer numbers
const PERIOD_S = 2.2; // per-row sine period
const PHASE_S = 0.4; // phase offset per hot-row index
const SCALE_MIN = 1.5; // px displacement floor
const SCALE_MAX = 3.0; // px displacement ceiling
const RESEED_MS = 4000; // turbulence seed re-randomize interval
const ATTR_MS = 1000 / 30; // SVG attribute writes throttled to 30fps
const FREEZE_IN_MS = 120; // hover legibility snap
const FREEZE_OUT_MS = 400; // ease back on leave
const FREEZE_DEADLINE_MS = 500; // forced completion — no stranded mid-wobble
const HAZE_H = 24; // gradient strip height in px
const HAZE_ALPHA = 0.08;

type FreezeState = { v: number; from: number; target: number; start: number };

export function HeatwaveLedger({
  rows = DEFAULT_ROWS,
  threshold = 70,
  title = "Server load — last 24h",
  timestamp = "updated 09:41:07 UTC",
  className = "",
}: {
  /** table data — rows with heat >= threshold shimmer */
  rows?: LedgerRow[];
  /** heat score at/above which a row is hot */
  threshold?: number;
  /** card title */
  title?: string;
  /** mono timestamp shown beside the title */
  timestamp?: string;
  className?: string;
}) {
  // unique, hydration-stable filter id prefix (useId sanitized for url(#…))
  const rawId = useId();
  const uid = useMemo(() => "heat" + rawId.replace(/[^a-zA-Z0-9_-]/g, ""), [rawId]);

  const [sortKey, setSortKey] = useState<SortKey>("heat");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [reduced, setReduced] = useState(false);
  // mirrors row hover into a data-attribute alongside the CSS `hover:` classes
  // below — Chromium never advances `:hover` for the site's synthetic
  // (isTrusted: false) autoplay driver, so the cosmetic hover tint needs a JS
  // source of truth too (same pattern as glass-button).
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());
  const dispEls = useRef<(SVGFEDisplacementMapElement | null)[]>([]);
  const turbEls = useRef<(SVGFETurbulenceElement | null)[]>([]);
  const freezeRef = useRef(new Map<string, FreezeState>());
  const wakeRef = useRef<(() => void) | null>(null);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const c =
        sortKey === "service" || sortKey === "region"
          ? a[sortKey].localeCompare(b[sortKey])
          : a[sortKey] - b[sortKey];
      return sortDir === "asc" ? c : -c;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  // hot rows in sorted order — index drives the shimmer phase, so sorting
  // (by heat or anything else) re-phases the field
  const hot = useMemo(
    () =>
      sorted
        .map((r, i) => ({ id: r.id, index: i }))
        .filter((_, i) => (sorted[i]?.heat ?? 0) >= threshold),
    [sorted, threshold]
  );
  const hotSlotById = useMemo(
    () => new Map(hot.map((h, k) => [h.id, k])),
    [hot]
  );
  const hotSig = useMemo(
    () => hot.map((h) => `${h.id}:${h.index}`).join("|"),
    [hot]
  );

  // reduced motion: no filter, no canvas — static accent rule instead
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // -- hover/focus freeze: eases a hot row's displacement to 0 for legibility
  const setFreeze = (id: string, target: number) => {
    const m = freezeRef.current;
    const s = m.get(id) ?? { v: 0, from: 0, target: 0, start: 0 };
    if (s.target === target) return;
    s.from = s.v;
    s.target = target;
    s.start = performance.now();
    m.set(id, s);
    wakeRef.current?.();
  };

  // -- shared rAF: walks ONLY the hot list ---------------------------------
  useEffect(() => {
    if (reduced || hot.length === 0) return;
    const wrap = wrapRef.current;
    const table = tableRef.current;
    const tbody = tbodyRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !table || !tbody || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hotList = hot; // captured — effect re-runs when hotSig changes

    // haze ink: --accent mixed 20% into --muted, derived at mount and
    // re-derived live on documentElement class flips
    let haze: Vec3 = [114, 121, 145];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      const muted = parseColor(cs.getPropertyValue("--muted")) ?? [143, 143, 143];
      const accent = parseColor(cs.getPropertyValue("--accent")) ?? [0, 107, 255];
      haze = mix(muted, accent, 0.2);
    };
    derive();

    // overlay canvas is a replaced element — explicit style.width/height,
    // backing store scaled by dpr
    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false; // zero-size guard — RO wakes us when real
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sized = true;
    };
    resize();

    let raf = 0;
    let visible = true;
    let lastAttr = 0;
    let lastSeed = 0;

    const clearCanvas = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const allFrozen = () =>
      hotList.every((hr) => {
        const s = freezeRef.current.get(hr.id);
        return s !== undefined && s.target === 1 && s.v >= 0.999;
      });

    const strip = (yFrom: number, yTo: number, a: number) => {
      const g = ctx.createLinearGradient(0, yFrom, 0, yTo);
      const [r, gg, b] = haze;
      g.addColorStop(0, `rgba(${r},${gg},${b},${a})`);
      g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.min(yFrom, yTo), w, Math.abs(yTo - yFrom));
    };

    const step = (now: number) => {
      raf = 0;
      if (!visible) return; // paused offscreen — IO wakes us

      // advance freeze transitions (ease-out cubic, hard deadline at 500ms
      // so a fast hover-scrub can never strand a row mid-wobble)
      for (const hr of hotList) {
        const s = freezeRef.current.get(hr.id);
        if (!s || s.v === s.target) continue;
        const el = now - s.start;
        const dur = s.target === 1 ? FREEZE_IN_MS : FREEZE_OUT_MS;
        if (el >= dur || el >= FREEZE_DEADLINE_MS) {
          s.v = s.target;
        } else {
          const p = el / dur;
          const e = 1 - Math.pow(1 - p, 3);
          s.v = s.from + (s.target - s.from) * e;
        }
      }

      const writeAttrs = now - lastAttr >= ATTR_MS;
      if (writeAttrs) lastAttr = now;
      // reseed rides an attribute-write frame so the throttle can't drop it
      const reseed = writeAttrs && now - lastSeed >= RESEED_MS;
      if (reseed) lastSeed = now;

      // haze canvas: fully cleared and redrawn every frame — no accumulation
      const tbodyH = tbody.offsetHeight;
      const drawable = sized && tbodyH >= 2;
      if (sized) clearCanvas();
      if (drawable) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.save();
        // clip to the tbody band — haze never bleeds into thead/footer
        const clipTop = table.offsetTop + tbody.offsetTop;
        ctx.beginPath();
        ctx.rect(0, clipTop, w, tbodyH);
        ctx.clip();
      }

      const t = now / 1000;
      for (let k = 0; k < hotList.length; k++) {
        const hr = hotList[k];
        if (!hr) continue;
        const fr = freezeRef.current.get(hr.id)?.v ?? 0;
        const osc =
          0.5 + 0.5 * Math.sin(((t - hr.index * PHASE_S) / PERIOD_S) * Math.PI * 2);
        const scale = (SCALE_MIN + (SCALE_MAX - SCALE_MIN) * osc) * (1 - fr);

        if (writeAttrs) {
          dispEls.current[k]?.setAttribute("scale", scale.toFixed(2));
          if (reseed)
            turbEls.current[k]?.setAttribute(
              "seed",
              String(Math.floor(Math.random() * 1000))
            );
        }

        if (drawable && fr < 0.999) {
          const tr = rowEls.current.get(hr.id);
          if (tr) {
            // offset coords within the wrapper (tr.offsetParent is the table,
            // table's offsetParent is the relative wrapper) — never page-absolute
            const top = table.offsetTop + tr.offsetTop;
            const bottom = top + tr.offsetHeight;
            const a = HAZE_ALPHA * (0.55 + 0.45 * osc) * (1 - fr);
            strip(top, top - HAZE_H, a); // rises off the top edge
            strip(bottom, bottom + HAZE_H, a); // sinks off the bottom edge
          }
        }
      }
      if (drawable) ctx.restore();

      // sleep: every hot row hover-frozen and settled — displacement is 0,
      // haze is 0; pin scales to exactly 0 and stop the loop entirely
      if (allFrozen()) {
        for (let k = 0; k < hotList.length; k++)
          dispEls.current[k]?.setAttribute("scale", "0");
        if (sized) clearCanvas();
        return;
      }
      raf = requestAnimationFrame(step);
    };

    const wake = () => {
      if (!raf && visible) raf = requestAnimationFrame(step);
    };
    wakeRef.current = wake;
    raf = requestAnimationFrame(step);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(wrap);

    const ro = new ResizeObserver(() => {
      resize();
      wake();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      derive();
      wake();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      wakeRef.current = null;
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      clearCanvas();
    };
  }, [reduced, hotSig, hot]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "service" || key === "region" ? "asc" : "desc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onRowBlur = (id: string) => (e: FocusEvent<HTMLTableRowElement>) => {
    // focus-within: stay frozen while focus moves inside the row
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setFreeze(id, 0);
  };

  return (
    <div
      className={`overflow-hidden rounded-md border border-border bg-surface ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pb-4 pt-5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <span className="font-mono text-[11px] tracking-wider text-muted">
          {timestamp}
        </span>
      </div>

      <div ref={wrapRef} className="relative">
        {/* one filter per hot-row slot, ids unique per instance */}
        {!reduced && hot.length > 0 && (
          <svg aria-hidden width="0" height="0" className="absolute" focusable="false">
            <defs>
              {hot.map((h, k) => (
                <filter
                  key={h.id}
                  id={`${uid}-h${k}`}
                  x="-2%"
                  y="-60%"
                  width="104%"
                  height="220%"
                  colorInterpolationFilters="sRGB"
                >
                  <feTurbulence
                    ref={(el) => {
                      turbEls.current[k] = el;
                    }}
                    type="fractalNoise"
                    baseFrequency="0.008 0.02"
                    numOctaves={2}
                    seed={7 + k * 13}
                    result="n"
                  />
                  <feDisplacementMap
                    ref={(el) => {
                      dispEls.current[k] = el;
                    }}
                    in="SourceGraphic"
                    in2="n"
                    scale="0"
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </filter>
              ))}
            </defs>
          </svg>
        )}

        <table ref={tableRef} className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-10 px-5 py-2.5">
                <span className="sr-only">Select</span>
              </th>
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      active
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={`px-3 py-2.5 first:pl-5 last:pr-5 ${
                      col.numeric ? "text-right" : "text-left"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`inline-flex items-center gap-1 rounded-sm font-mono text-[11px] uppercase tracking-widest transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        active ? "text-foreground" : "text-muted hover:text-foreground"
                      } ${col.numeric ? "flex-row-reverse" : ""}`}
                    >
                      {col.label}
                      <svg
                        viewBox="0 0 8 8"
                        aria-hidden
                        className={`h-2 w-2 transition-opacity duration-150 ${
                          active ? "opacity-100" : "opacity-0"
                        } ${active && sortDir === "asc" ? "rotate-180" : ""}`}
                        fill="currentColor"
                      >
                        <path d="M4 6 0.8 2h6.4Z" />
                      </svg>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {sorted.map((row) => {
              const slot = hotSlotById.get(row.id);
              const isHot = slot !== undefined;
              const isSel = selected.has(row.id);

              const style: CSSProperties = {};
              if (isHot && !reduced) style.filter = `url(#${uid}-h${slot})`;
              const shadows: string[] = [];
              if (isHot && reduced)
                shadows.push("inset 2px 0 0 0 var(--accent)"); // static heat rule
              if (isSel)
                shadows.push(
                  "inset 0 0 0 1px color-mix(in srgb, var(--foreground) 35%, var(--muted))"
                );
              if (shadows.length > 0) style.boxShadow = shadows.join(", ");

              // token-relative fills only: hover raises one surface step,
              // selection sits one step above that
              // (`data-[hover=true]` mirrors `:hover` for synthetic/driver input)
              const bg = isSel
                ? "bg-foreground/[0.06]"
                : isHot && reduced
                  ? "bg-foreground/[0.04] hover:bg-foreground/[0.06] data-[hover=true]:bg-foreground/[0.06]"
                  : "hover:bg-foreground/[0.04] data-[hover=true]:bg-foreground/[0.04]";

              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    if (el) rowEls.current.set(row.id, el);
                    else rowEls.current.delete(row.id);
                  }}
                  style={style}
                  aria-selected={isSel}
                  data-hover={hoveredId === row.id}
                  onPointerEnter={() => {
                    setHoveredId(row.id);
                    if (isHot && !reduced) setFreeze(row.id, 1);
                  }}
                  onPointerLeave={() => {
                    setHoveredId((h) => (h === row.id ? null : h));
                    if (isHot && !reduced) setFreeze(row.id, 0);
                  }}
                  onFocus={isHot && !reduced ? () => setFreeze(row.id, 1) : undefined}
                  onBlur={isHot && !reduced ? onRowBlur(row.id) : undefined}
                  className={`border-b border-border transition-colors duration-150 last:border-b-0 ${bg}`}
                >
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleSelect(row.id)}
                      aria-label={`Select ${row.service}`}
                      className="block h-3.5 w-3.5 cursor-pointer"
                      style={{ accentColor: "var(--accent)" }}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground">
                    {row.service}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs tracking-wide text-muted">
                    {row.region}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted">
                    {row.reqs.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted">
                    {row.p95.toLocaleString("en-US")}
                  </td>
                  <td
                    className={`px-3 py-3 pr-5 text-right font-mono text-xs tabular-nums ${
                      isHot ? "font-medium text-foreground" : "text-muted"
                    }`}
                  >
                    {row.heat}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* edge-haze overlay — explicit CSS size set in the resize handler */}
        {!reduced && hot.length > 0 && (
          <canvas
            ref={canvasRef}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-5 py-3">
        <span className="font-mono text-[11px] tracking-wider text-muted">
          {sorted.length} services · {hot.length} above threshold · {selected.size}{" "}
          selected
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-muted opacity-50 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Prev
          </button>
          <span className="font-mono text-[11px] tabular-nums text-muted">1 / 1</span>
          <button
            type="button"
            disabled
            className="rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-muted opacity-50 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
