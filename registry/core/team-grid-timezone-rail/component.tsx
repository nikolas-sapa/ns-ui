"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TeamGridTimezoneRail — a team grid that answers "who is reachable right now".
//
// A 24-cell UTC hour track sits above the cards. Every cell is either dead
// (`·` in --border) or inked (`━` in --accent), and the inked run is the
// INTERSECTION of everybody's working window — the viewer's included — mapped
// back onto UTC. At rest that run is the whole team's shared meeting window —
// the tightest one there is. Hover or focus one person and the run opens out
// to just your overlap with them; leave and a 220ms relax timer pulls it back
// to the team-wide run, so sweeping the grid doesn't strobe. A caret `▮` marks
// the current UTC hour.
//
// The clock is a clock, not an animation: one timer aligned to the real minute
// boundary drives the caret and every card's local time through direct DOM
// writes. No rAF anywhere. Zero dependencies, tokens only.
// ---------------------------------------------------------------------------

export interface TeamMember {
  /** stable id, also the value of [data-member] */
  id: string;
  name: string;
  role: string;
  /** 2–3 letters for the mark */
  initials: string;
  /** hours ahead of UTC; fractional allowed (5.5 = UTC+5:30) */
  utcOffset: number;
}

export interface TeamGridTimezoneRailProps {
  members?: TeamMember[];
  /** local working window as [startHour, endHour), applied to everyone */
  workingHours?: [number, number];
  /** the viewer's own offset; defaults to the browser's, resolved after mount */
  viewerOffset?: number;
  className?: string;
}

const DEFAULT_MEMBERS: TeamMember[] = [
  { id: "marcus", name: "Marcus Hale", role: "Staff Engineer", initials: "MH", utcOffset: -5 },
  { id: "ana", name: "Ana Reyes", role: "Design Lead", initials: "AR", utcOffset: -3 },
  { id: "joana", name: "Joana Duarte", role: "Support Lead", initials: "JD", utcOffset: 0 },
  { id: "lukas", name: "Lukas Brandt", role: "Infrastructure", initials: "LB", utcOffset: 1 },
  { id: "wanjiru", name: "Wanjiru Kimani", role: "Data Science", initials: "WK", utcOffset: 3 },
  { id: "darya", name: "Darya Sadeghi", role: "QA Engineer", initials: "DS", utcOffset: 3.5 },
];

const DEFAULT_HOURS: [number, number] = [9, 18];

/** ms of pointer-out before the band relaxes back to the team-wide window */
const RELAX_MS = 220;
/** rail cells below this many ch of root width collapse to 2h per cell */
const COMPACT_CH = 30;

const mod = (n: number, m: number) => ((n % m) + m) % m;

function insideWindow(localHour: number, start: number, end: number) {
  const h = mod(localHour, 24);
  return start <= end ? h >= start && h < end : h >= start || h < end;
}

/** shortest circular distance in hours from `localHour` to the working window */
function distanceToWindow(localHour: number, start: number, end: number) {
  if (insideWindow(localHour, start, end)) return 0;
  const h = mod(localHour, 24);
  const gap = (a: number, b: number) => {
    const d = mod(a - b, 24);
    return Math.min(d, 24 - d);
  };
  return Math.min(gap(h, mod(start, 24)), gap(h, mod(end, 24)));
}

/** live[c] = some hour in cell c is inside the window for EVERY offset */
function bandFor(offsets: number[], start: number, end: number, cells: number, step: number) {
  const out: boolean[] = [];
  for (let c = 0; c < cells; c++) {
    let live = false;
    for (let k = 0; k < step && !live; k++) {
      const h = c * step + k;
      live = offsets.every((o) => insideWindow(h + o, start, end));
    }
    out.push(live);
  }
  return out;
}

type Run = { start: number; length: number };

/** maximal runs of set bits, wrapping across midnight */
function runsOf(mask: boolean[]): Run[] {
  const n = mask.length;
  if (mask.every(Boolean)) return [{ start: 0, length: n }];
  const runs: Run[] = [];
  for (let i = 0; i < n; i++) {
    if (!mask[i] || mask[mod(i - 1, n)]) continue;
    let len = 1;
    while (len < n && mask[mod(i + len, n)]) len++;
    runs.push({ start: i, length: len });
  }
  return runs;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function fmtClock(totalMinutes: number) {
  const m = mod(Math.round(totalMinutes), 1440);
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

function fmtOffset(o: number) {
  const sign = o < 0 ? "-" : "+";
  const abs = Math.abs(o);
  const h = Math.floor(abs);
  const mm = Math.round((abs - h) * 60);
  return `UTC${sign}${h}${mm ? `:${pad2(mm)}` : ""}`;
}

export function TeamGridTimezoneRail({
  members = DEFAULT_MEMBERS,
  workingHours = DEFAULT_HOURS,
  viewerOffset,
  className = "",
}: TeamGridTimezoneRailProps) {
  const [whStart, whEnd] = workingHours;

  const rootRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<HTMLSpanElement>(null);
  const relaxRef = useRef<number | undefined>(undefined);

  const [viewer, setViewer] = useState(viewerOffset ?? 0);
  const [cols, setCols] = useState(3);
  const [compact, setCompact] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // the viewer's real offset is client-only; adopting it after mount keeps the
  // server and first client render byte-identical.
  useEffect(() => {
    if (viewerOffset !== undefined) {
      setViewer(viewerOffset);
      return;
    }
    setViewer(-new Date().getTimezoneOffset() / 60);
  }, [viewerOffset]);

  const activeId = hoverId ?? pinnedId;
  const activeMember = useMemo(
    () => members.find((m) => m.id === activeId) ?? null,
    [members, activeId]
  );

  /** offsets currently being intersected: the whole team, or you ∩ one person
   *  (a pair always shares at least as many hours as the team, so the band can
   *  only open out from rest — rest is the tightest run the grid ever shows) */
  const offsets = useMemo(
    () =>
      activeMember
        ? [viewer, activeMember.utcOffset]
        : [viewer, ...members.map((m) => m.utcOffset)],
    [activeMember, members, viewer]
  );

  const step = compact ? 2 : 1;
  const cells = compact ? 12 : 24;

  const band = useMemo(
    () => bandFor(offsets, whStart, whEnd, cells, step),
    [offsets, whStart, whEnd, cells, step]
  );

  /** full-resolution band, used for the spoken readout regardless of density */
  const hourBand = useMemo(
    () => bandFor(offsets, whStart, whEnd, 24, 1),
    [offsets, whStart, whEnd]
  );

  const runs = useMemo(() => runsOf(hourBand), [hourBand]);
  const shared = runs.reduce((n, r) => n + r.length, 0);

  /** when nothing intersects: the UTC hour of minimum total distance-to-window */
  const nearest = useMemo(() => {
    if (shared > 0) return null;
    const people = [{ name: "you", utcOffset: viewer }, ...members];
    let best = { hour: 0, cost: Infinity, who: people[0]?.name ?? "", gap: 0 };
    for (let h = 0; h < 24; h++) {
      let cost = 0;
      let worst = { name: "", gap: 0 };
      for (const p of people) {
        const g = distanceToWindow(h + p.utcOffset, whStart, whEnd);
        cost += g;
        if (g > worst.gap) worst = { name: p.name.split(" ")[0], gap: g };
      }
      if (cost < best.cost) best = { hour: h, cost, who: worst.name, gap: worst.gap };
    }
    return best;
  }, [shared, members, viewer, whStart, whEnd]);

  const readout = useMemo(() => {
    if (nearest) {
      return `no shared hours — nearest overlap ${pad2(nearest.hour)}:00 UTC (${nearest.who} +${nearest.gap}h)`;
    }
    const window =
      shared >= 24
        ? "every hour UTC"
        : runs
            .map((r) => `${pad2(r.start)}:00–${pad2(mod(r.start + r.length, 24))}:00 UTC`)
            .join(", ");
    const who = activeMember ? `you and ${activeMember.name}` : `all ${members.length} + you`;
    return `${who} free ${window} · ${shared}h shared`;
  }, [nearest, runs, activeMember, members.length, shared]);

  // ---- the clock: one minute-aligned timer, direct DOM writes ---------------

  const paint = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const now = new Date();
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    const utcEl = root.querySelector<HTMLElement>("[data-clock-utc]");
    if (utcEl) utcEl.textContent = `${fmtClock(utcMinutes)} UTC`;

    const caret = root.querySelector<HTMLElement>("[data-caret]");
    if (caret) {
      const idx = Math.floor(utcMinutes / 60 / step);
      caret.style.left = `${idx}ch`;
      caret.style.opacity = "1";
    }

    for (const m of members) {
      const btn = root.querySelector<HTMLElement>(`[data-member="${m.id}"]`);
      if (!btn) continue;
      const localMinutes = utcMinutes + m.utcOffset * 60;
      const awake = insideWindow(localMinutes / 60, whStart, whEnd);
      const clock = fmtClock(localMinutes);
      const time = btn.querySelector<HTMLElement>("[data-time]");
      if (time) time.textContent = clock;
      const dot = btn.querySelector<HTMLElement>("[data-dot]");
      if (dot) dot.textContent = awake ? "●" : "○";
      btn.style.opacity = awake ? "1" : "0.5";
      btn.setAttribute(
        "aria-label",
        `${m.name}, ${m.role}, local time ${clock}, ${fmtOffset(m.utcOffset)}, currently ${awake ? "available" : "outside working hours"}`
      );
    }
  }, [members, whStart, whEnd, step]);

  useEffect(() => {
    paint();
    let interval: number | undefined;
    const timeout = window.setTimeout(
      () => {
        paint();
        interval = window.setInterval(paint, 60000);
      },
      60000 - (Date.now() % 60000)
    );
    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [paint]);

  // ---- responsive: columns, and a coarser rail in a narrow frame ------------

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.clientWidth;
      setCols(w < 480 ? 1 : w < 860 ? 2 : 3);
      const ch = (chRef.current?.offsetWidth ?? 100) / 10;
      setCompact(w < COMPACT_CH * ch);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(relaxRef.current), []);

  const enter = (id: string) => {
    window.clearTimeout(relaxRef.current);
    setHoverId(id);
  };
  const leave = () => {
    window.clearTimeout(relaxRef.current);
    relaxRef.current = window.setTimeout(() => setHoverId(null), RELAX_MS);
  };

  const tickEvery = compact ? 3 : 6;
  const tickLabels = Array.from({ length: 4 }, (_, k) => ({
    idx: k * tickEvery,
    text: pad2(k * 6),
  }));

  const fade =
    "transition-opacity duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

  return (
    <div ref={rootRef} data-tz-rail className={`relative flex w-full flex-col gap-4 ${className}`}>
      <span
        ref={chRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 h-0 w-[10ch] font-mono text-[18px]"
      />

      {/* ---- the rail ------------------------------------------------------ */}
      <div className="rounded-sm border border-border bg-surface px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            utc day
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            core {pad2(whStart)}:00–{pad2(whEnd)}:00 local
          </span>
        </div>

        <div className="mt-2.5 flex items-end justify-between gap-4">
          <div aria-hidden className="relative select-none font-mono text-[18px] leading-none">
            <div className="flex whitespace-pre">
              {Array.from({ length: cells }, (_, i) => {
                const divider = i % tickEvery === 0;
                const on = band[i];
                return (
                  <span key={i} className="relative inline-block w-[1ch] text-center">
                    <span
                      style={{ opacity: on ? 0 : 1 }}
                      className={`block ${fade} ${divider ? "text-muted" : "text-border"}`}
                    >
                      {divider ? "│" : "·"}
                    </span>
                    <span
                      style={{ opacity: on ? 1 : 0 }}
                      className={`absolute inset-0 text-accent ${fade}`}
                    >
                      ━
                    </span>
                  </span>
                );
              })}
            </div>
            <span
              data-caret
              className="absolute top-0 w-[1ch] text-center leading-none text-accent opacity-0"
            >
              ▮
            </span>
            <div className="relative mt-1 h-[1em] text-[10px] leading-none text-muted">
              {tickLabels.map((t) => (
                <span
                  key={t.idx}
                  className="absolute top-0 font-mono text-[18px] leading-none"
                  style={{ left: `${t.idx}ch` }}
                >
                  <span className="text-[10px]">{t.text}</span>
                </span>
              ))}
            </div>
          </div>

          <span
            data-clock-utc
            className="shrink-0 font-mono text-[13px] tabular-nums text-foreground"
          >
            --:-- UTC
          </span>
        </div>

        <p
          aria-live="polite"
          className={`mt-2 font-mono text-[11px] tabular-nums ${nearest ? "text-muted" : "text-foreground"}`}
        >
          {readout}
        </p>
      </div>

      {/* ---- the team ------------------------------------------------------ */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            data-member={m.id}
            aria-pressed={pinnedId === m.id}
            aria-label={`${m.name}, ${m.role}, ${fmtOffset(m.utcOffset)}`}
            onPointerEnter={() => enter(m.id)}
            onPointerLeave={leave}
            onFocus={() => enter(m.id)}
            onBlur={leave}
            onClick={() => setPinnedId((p) => (p === m.id ? null : m.id))}
            className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-3 text-left outline-none transition-[opacity,border-color] duration-200 motion-reduce:transition-none hover:border-muted focus-visible:ring-2 focus-visible:ring-accent aria-pressed:border-foreground"
          >
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border font-mono text-[11px] tracking-[0.06em] text-muted"
            >
              {m.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-foreground">{m.name}</span>
              <span className="block truncate text-[11px] text-muted">{m.role}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="flex items-center gap-1.5 font-mono text-[13px] tabular-nums text-foreground">
                <span data-time>--:--</span>
                <span data-dot className="text-[9px] leading-none">
                  ○
                </span>
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted">
                {fmtOffset(m.utcOffset)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
