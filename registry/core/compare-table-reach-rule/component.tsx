"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ReachRuleTable — a tier comparison matrix where each feature row draws a real
// box-drawing rule that starts at the x-centre of the first tier column and
// terminates with ┤ on the x-centre of the LAST tier that includes it. Columns
// the feature skips are drawn ┄ rather than ─, so a non-monotone matrix is
// shown honestly instead of smoothed. The staircase of rule lengths is the
// comparison — there is no field of check glyphs to scan.
// ---------------------------------------------------------------------------

export type CompareTier = {
  id: string;
  /** tier name, e.g. "Pro" */
  name: string;
  /** price string, rendered verbatim — e.g. "$20/mo" or "Custom" */
  price: string;
};

export type CompareFeatureRow = {
  id: string;
  /** feature name — becomes the row's pin button label */
  label: string;
  /** optional second line under the label */
  note?: string;
  /** one entry per tier, in tier order. `false` = not included, a string = the
   *  tier-specific value ("14 days"), `true` = plainly included */
  support: (boolean | string)[];
};

const STEP_IN_MS = 14; // per glyph cell, drawing
const STEP_OUT_MS = 9; // per glyph cell, retracting
const MAX_IN_MS = 320; // total draw budget — long rules step faster, never slower
const REST_OPACITY = 0.42; // resting rule ink — the idle staircase must read
const DIM_OPACITY = 0.35; // tiers excluded by the active row
const TRACK_CELLS = 12; // completeness readout width
const STACK_BREAKPOINT = 720; // px — below this the matrix becomes stacked cards
const WIDTH_EPSILON = 2; // px — remeasure only past this much layout change

const GLYPH_RUN = "─";
const GLYPH_GAP = "┄";
const GLYPH_END = "┤";

const DEFAULT_TIERS: CompareTier[] = [
  { id: "hobby", name: "Hobby", price: "$0" },
  { id: "pro", name: "Pro", price: "$20/mo" },
  { id: "team", name: "Team", price: "$60/mo" },
  { id: "enterprise", name: "Enterprise", price: "Custom" },
];

// Ordered by reach, so the rules descend as a staircase at rest.
const DEFAULT_ROWS: CompareFeatureRow[] = [
  {
    id: "deployments",
    label: "Unlimited deployments",
    support: [true, true, true, true],
  },
  {
    id: "regions",
    label: "Edge regions",
    note: "Where builds are served from",
    support: ["3", "18", "34", "34 + private"],
  },
  {
    id: "analytics",
    label: "Traffic analytics",
    note: "Retention window",
    support: [false, "30 days", "1 year", "3 years"],
  },
  {
    id: "seats",
    label: "Collaborator seats",
    support: ["1", "5", "25", "Unlimited"],
  },
  {
    id: "sso",
    label: "SAML single sign-on",
    support: [false, false, true, true],
  },
  {
    id: "audit",
    label: "Audit log export",
    note: "Streamed to your own bucket",
    support: [false, false, false, true],
  },
  {
    id: "checkout",
    label: "Self-serve checkout",
    note: "Enterprise is invoiced instead",
    support: [true, true, true, false],
  },
  {
    id: "overage",
    label: "Usage overage on card",
    support: [true, true, true, false],
  },
  {
    id: "community",
    label: "Community forum support",
    note: "Superseded by a named contact on Enterprise",
    support: [true, true, true, false],
  },
  {
    id: "trial",
    label: "14-day trial without a card",
    support: [true, true, false, false],
  },
  {
    id: "sandbox",
    label: "Shared sandbox runners",
    note: "Dedicated runners replace these higher up",
    support: [true, true, false, false],
  },
  {
    id: "badge",
    label: "Public project badge",
    note: "Free-tier attribution",
    support: [true, false, false, false],
  },
];

const has = (v: boolean | string | undefined): boolean =>
  v === true || (typeof v === "string" && v.trim().length > 0);

/** highest tier index this feature still appears in, −1 if none */
function reachOf(row: CompareFeatureRow, n: number): number {
  for (let i = n - 1; i >= 0; i--) if (has(row.support[i])) return i;
  return -1;
}

type Geom = { text: string; left: number; width: number; len: number };
type Anim = { dir: 1 | -1; k: number };

export function ReachRuleTable({
  tiers = DEFAULT_TIERS,
  rows = DEFAULT_ROWS,
  title = "Plan comparison",
  className = "",
}: {
  /** tier columns, cheapest first */
  tiers?: CompareTier[];
  /** feature rows, one `support` entry per tier */
  rows?: CompareFeatureRow[];
  /** accessible name for the matrix */
  title?: string;
  className?: string;
}) {
  const n = tiers.length;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [stacked, setStacked] = useState(false);
  const [reduced, setReduced] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const headRowRef = useRef<HTMLDivElement | null>(null);
  const headCellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const ruleRefs = useRef<Map<string, HTMLSpanElement>>(new Map());

  const geomRef = useRef<Map<string, Geom>>(new Map());
  const animRef = useRef<Map<string, Anim>>(new Map());
  const rafRef = useRef(0);
  const lastWidthRef = useRef(-1);
  const pinnedRef = useRef<string | null>(null);
  pinnedRef.current = pinnedId;
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

  const reaches = useMemo(
    () => rows.map((r) => reachOf(r, n)),
    [rows, n]
  );

  // completeness per tier: how many features that tier actually includes
  const included = useMemo(
    () => tiers.map((_, i) => rows.reduce((a, r) => a + (has(r.support[i]) ? 1 : 0), 0)),
    [tiers, rows]
  );

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `minmax(12rem,1.4fr) repeat(${n}, minmax(6rem,1fr))`,
    }),
    [n]
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /** body glyphs + the ┤ cap live in two child spans, so the terminator can
   *  take accent ink on a pinned row while the run stays --foreground */
  const parts = (id: string) => {
    const el = ruleRefs.current.get(id);
    if (!el) return null;
    const body = el.firstElementChild as HTMLElement | null;
    const cap = el.lastElementChild as HTMLElement | null;
    if (!body || !cap || body === cap) return null;
    return { el, body, cap };
  };

  /** paint one rule at a given glyph count */
  const paint = useCallback((id: string, k: number) => {
    const p = parts(id);
    const g = geomRef.current.get(id);
    if (!p || !g) return;
    const shown = Math.max(0, Math.min(g.len, Math.round(k)));
    p.body.textContent = shown > 0 ? g.text.slice(0, shown - 1) : "";
    p.cap.textContent = shown > 0 ? GLYPH_END : "";
    p.cap.style.color =
      pinnedRef.current === id ? "var(--accent)" : "currentColor";
    const t = g.len > 0 ? shown / g.len : 1;
    p.el.style.opacity = String(REST_OPACITY + (1 - REST_OPACITY) * t);
  }, []);

  const settle = useCallback((id: string, lit: boolean) => {
    const p = parts(id);
    const g = geomRef.current.get(id);
    if (!p || !g) return;
    p.body.textContent = g.text.slice(0, g.len - 1);
    p.cap.textContent = GLYPH_END;
    p.cap.style.color =
      pinnedRef.current === id ? "var(--accent)" : "currentColor";
    p.el.style.opacity = String(lit ? 1 : REST_OPACITY);
  }, []);

  /** single shared rAF stepping every in-flight rule */
  const tick = useCallback(
    (now: number, prev: number) => {
      const dt = Math.min(64, now - prev);
      const anims = animRef.current;
      for (const [id, a] of anims) {
        const g = geomRef.current.get(id);
        if (!g) {
          anims.delete(id);
          continue;
        }
        const len = Math.max(1, g.len);
        const stepMs =
          a.dir === 1 ? Math.min(STEP_IN_MS, MAX_IN_MS / len) : STEP_OUT_MS;
        a.k += (dt / stepMs) * a.dir;
        if (a.dir === 1 && a.k >= g.len) {
          settle(id, true);
          anims.delete(id);
        } else if (a.dir === -1 && a.k <= 0) {
          settle(id, pinnedRef.current === id);
          anims.delete(id);
        } else {
          paint(id, a.k);
        }
      }
    },
    [paint, settle]
  );

  const pump = useCallback(() => {
    if (rafRef.current) return;
    let prev = performance.now();
    const loop = (now: number) => {
      tick(now, prev);
      prev = now;
      if (animRef.current.size > 0) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [tick]);

  const drive = useCallback(
    (id: string, dir: 1 | -1) => {
      const g = geomRef.current.get(id);
      if (!g) return;
      if (reduced) {
        animRef.current.delete(id);
        settle(id, dir === 1 || pinnedRef.current === id);
        return;
      }
      const cur = animRef.current.get(id);
      const k = dir === 1 ? 0 : cur ? cur.k : g.len;
      animRef.current.set(id, { dir, k });
      if (dir === 1) paint(id, 0);
      pump();
    },
    [paint, pump, reduced, settle]
  );

  /** one measurement pass: header centres → per-row rule text + box */
  const layout = useCallback(
    (force: boolean) => {
      const root = rootRef.current;
      const headRow = headRowRef.current;
      if (!root) return;

      const w = root.clientWidth;
      if (w < 2) return;
      if (!force && Math.abs(w - lastWidthRef.current) <= WIDTH_EPSILON) return;
      lastWidthRef.current = w;

      const nextStacked = w < STACK_BREAKPOINT;
      setStacked(nextStacked);
      if (nextStacked || !headRow) return;

      const probe = probeRef.current;
      const chW = probe ? probe.getBoundingClientRect().width / 40 : 8;
      if (!(chW > 0.5)) return;

      const rowLeft = headRow.getBoundingClientRect().left;
      const centres: number[] = [];
      for (let i = 0; i < n; i++) {
        const cell = headCellRefs.current[i];
        if (!cell) return;
        const r = cell.getBoundingClientRect();
        centres.push(r.left + r.width / 2 - rowLeft);
      }

      rows.forEach((row, ri) => {
        const reach = reaches[ri];
        const el = ruleRefs.current.get(row.id);
        if (reach < 0) {
          geomRef.current.delete(row.id);
          const p = el ? parts(row.id) : null;
          if (p) {
            p.body.textContent = "";
            p.cap.textContent = "";
          }
          return;
        }
        const left = centres[0];
        const width = Math.max(0, centres[reach] - left);
        const cells = Math.max(0, Math.round(width / chW));
        let text = "";
        for (let j = 0; j < cells; j++) {
          const x = left + j * chW;
          // nearest tier column owns this glyph
          let col = 0;
          let best = Infinity;
          for (let i = 0; i <= reach; i++) {
            const d = Math.abs(centres[i] - x);
            if (d < best) {
              best = d;
              col = i;
            }
          }
          text += has(row.support[col]) ? GLYPH_RUN : GLYPH_GAP;
        }
        text += GLYPH_END;
        const g: Geom = {
          text,
          left: left - chW / 2,
          width: width + chW,
          len: text.length,
        };
        geomRef.current.set(row.id, g);
        if (el) {
          el.style.left = `${g.left}px`;
          el.style.width = `${g.width}px`;
          if (!animRef.current.has(row.id)) {
            settle(row.id, pinnedRef.current === row.id);
          }
        }
      });
    },
    [n, reaches, rows, settle]
  );

  useEffect(() => {
    layout(true);
    let alive = true;
    // the 1ch probe is measured in whatever font is resolved at mount; when the
    // mono face swaps in the pitch changes, so re-measure once fonts settle or
    // every ┤ lands off its column centre
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => {
        if (alive) layout(true);
      });
    }
    const root = rootRef.current;
    if (!root) {
      return () => {
        alive = false;
      };
    }
    const ro = new ResizeObserver(() => layout(false));
    ro.observe(root);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [layout]);

  // crossing back above the breakpoint remounts the matrix — the header cells
  // only exist after that paint, so measure once more on the flip
  useEffect(() => {
    if (stacked) return;
    const id = requestAnimationFrame(() => layout(true));
    return () => cancelAnimationFrame(id);
  }, [stacked, layout]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      animRef.current.clear();
    },
    []
  );

  const enter = (id: string) => {
    activeRef.current = id;
    setActiveId(id);
    drive(id, 1);
  };
  const leave = (id: string) => {
    if (activeRef.current === id) activeRef.current = null;
    setActiveId((cur) => (cur === id ? null : cur));
    if (pinnedRef.current === id) {
      animRef.current.delete(id);
      settle(id, true);
      return;
    }
    drive(id, -1);
  };
  // side effects live in the handler, never inside the state updater — a
  // StrictMode double-invoke would otherwise paint twice
  const togglePin = (id: string) => {
    const prev = pinnedRef.current;
    const next = prev === id ? null : id;
    pinnedRef.current = next;
    setPinnedId(next);
    if (prev && prev !== next) settle(prev, activeRef.current === prev);
    if (next) settle(next, true);
  };

  const activeRow = activeId ? rows.find((r) => r.id === activeId) : undefined;
  const shownRow = activeRow ?? (pinnedId ? rows.find((r) => r.id === pinnedId) : undefined);

  const track = (i: number) => {
    const filled = Math.round((TRACK_CELLS * included[i]) / Math.max(1, rows.length));
    return "▪".repeat(filled) + "·".repeat(Math.max(0, TRACK_CELLS - filled));
  };

  return (
    <div
      ref={rootRef}
      className={`w-full text-foreground ${className}`.trim()}
    >
      {/* mono advance probe — measured, never seen */}
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] top-0 font-mono text-[13px] leading-none"
        style={{ whiteSpace: "pre", letterSpacing: 0 }}
      >
        {GLYPH_RUN.repeat(40)}
      </span>

      {stacked ? (
        <div className="flex flex-col gap-3">
          {tiers.map((tier, i) => (
            <section
              key={tier.id}
              aria-label={`${tier.name} — ${tier.price}`}
              className="rounded-md border border-border bg-surface p-4"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium">{tier.name}</h3>
                <span className="font-mono text-xs text-muted">{tier.price}</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted">
                <span aria-hidden style={{ letterSpacing: "0.12em" }}>
                  {track(i)}
                </span>
                <span className="ml-2">
                  {included[i]}/{rows.length}
                </span>
              </p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {rows.map((row) => {
                  const on = has(row.support[i]);
                  const val = typeof row.support[i] === "string" ? (row.support[i] as string) : null;
                  return (
                    <li
                      key={row.id}
                      className={`flex items-baseline justify-between gap-3 text-[13px] ${
                        on ? "text-foreground" : "text-muted"
                      }`}
                    >
                      <span className="flex items-baseline gap-2">
                        <span aria-hidden className="font-mono text-[11px]">
                          {on ? "●" : "○"}
                        </span>
                        <span>{row.label}</span>
                        <span className="sr-only">
                          {on ? "included" : "not included"}
                        </span>
                      </span>
                      {val ? (
                        <span className="font-mono text-[11px] text-muted">{val}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div
          role="table"
          aria-label={title}
          className="overflow-hidden rounded-md border border-border bg-surface"
        >
          {/* header */}
          <div
            ref={headRowRef}
            role="row"
            className="grid items-end gap-x-2 border-b border-border px-4 pb-3 pt-4"
            style={gridStyle}
          >
            <div role="columnheader" className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Feature
            </div>
            {tiers.map((tier, i) => {
              const dim = shownRow ? !has(shownRow.support[i]) : false;
              return (
                <div
                  key={tier.id}
                  role="columnheader"
                  ref={(el) => {
                    headCellRefs.current[i] = el;
                  }}
                  className="text-center transition-opacity duration-200"
                  style={{ opacity: dim ? DIM_OPACITY : 1 }}
                >
                  <div className="text-sm font-medium">{tier.name}</div>
                  <div className="font-mono text-[11px] text-muted">{tier.price}</div>
                  <div className="mt-1.5 font-mono text-[10px] text-muted">
                    <span aria-hidden style={{ letterSpacing: "0.1em" }}>
                      {track(i)}
                    </span>
                    <span className="ml-1.5">
                      {included[i]}/{rows.length}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* feature rows */}
          {rows.map((row, ri) => {
            const isActive = activeId === row.id;
            const isPinned = pinnedId === row.id;
            const reach = reaches[ri];
            return (
              <div
                key={row.id}
                role="row"
                className="relative grid items-start gap-x-2 border-b border-border/60 px-4 py-2.5 last:border-b-0"
                style={gridStyle}
              >
                <div role="rowheader" className="min-w-0">
                  <button
                    type="button"
                    data-compare-row={row.id}
                    aria-pressed={isPinned}
                    onPointerEnter={() => enter(row.id)}
                    onPointerLeave={() => leave(row.id)}
                    onFocus={() => enter(row.id)}
                    onBlur={() => leave(row.id)}
                    onClick={() => togglePin(row.id)}
                    className={`-mx-1 block w-full rounded-sm px-1 text-left text-[13px] leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      isActive || isPinned ? "text-foreground" : "text-foreground/80"
                    }`}
                  >
                    {row.label}
                    {isPinned ? (
                      <span className="sr-only"> (pinned)</span>
                    ) : null}
                  </button>
                  {row.note ? (
                    <p className="mt-0.5 px-0 text-[11px] leading-4 text-muted">
                      {row.note}
                    </p>
                  ) : null}
                </div>

                {tiers.map((tier, i) => {
                  const raw = row.support[i];
                  const on = has(raw);
                  const dim = (isActive || (!activeId && isPinned)) && !on;
                  return (
                    <div
                      key={tier.id}
                      role="cell"
                      className="text-center transition-opacity duration-200"
                      style={{ opacity: dim ? DIM_OPACITY : 1 }}
                    >
                      {/* the rule seats on the row's first line; values hang below it */}
                      <span aria-hidden className="block h-5" />
                      {typeof raw === "string" ? (
                        <span className="block font-mono text-[11px] leading-4 text-muted">
                          {raw}
                        </span>
                      ) : null}
                      <span className="sr-only">
                        {on
                          ? typeof raw === "string"
                            ? raw
                            : "included"
                          : "not included"}
                      </span>
                    </div>
                  );
                })}

                {reach >= 0 ? (
                  <span
                    aria-hidden
                    ref={(el) => {
                      if (el) ruleRefs.current.set(row.id, el);
                      else ruleRefs.current.delete(row.id);
                    }}
                    data-reach-rule={row.id}
                    className="pointer-events-none absolute font-mono text-[13px] leading-none"
                    style={{
                      top: "1.24rem",
                      transform: "translateY(-50%)",
                      whiteSpace: "pre",
                      letterSpacing: 0,
                      overflow: "hidden",
                      opacity: REST_OPACITY,
                      color: "var(--foreground)",
                    }}
                  >
                    <span />
                    <span />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ReachRuleTable;
