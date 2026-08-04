"use client";

import { useCallback, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ScheduleAsciiFreebusy — a meeting-time finder that shows its own work.
//
// One row of block glyphs per attendee over 18 half-hour slots (09:00–18:00),
// a density skyline summing how many required people are busy in each column,
// and an underlined accent window marking the earliest slot where everyone
// required is actually free. The solver is a bitwise AND of the required
// attendees' inverted busy masks followed by a single left-to-right
// run-length scan — dropping one person to optional removes their mask from
// the AND and the answer visibly moves, which is the whole argument of the
// component.
//
// Status is glyph-encoded, never color-encoded: free ·, tentative ▒, busy █,
// outside working hours blank. Pure DOM + tokens: no canvas, no rAF loop.
// ---------------------------------------------------------------------------

export type SlotStatus = "free" | "tentative" | "busy" | "out";

export interface Attendee {
  /** stable lowercase id, also used for [data-attendee-toggle] */
  id: string;
  name: string;
  /** one status per slot; length must equal `slots` */
  day: SlotStatus[];
}

export interface ScheduleAsciiFreebusyProps {
  attendees?: Attendee[];
  /** number of half-hour columns (default 18 = 09:00–18:00) */
  slots?: number;
  /** minutes at the first column (default 540 = 09:00) */
  dayStartMinutes?: number;
  /** initial meeting length in minutes; must be one of `durations` */
  defaultDuration?: number;
  durations?: number[];
  title?: string;
  className?: string;
}

const F: SlotStatus = "free";
const T: SlotStatus = "tentative";
const B: SlotStatus = "busy";
const O: SlotStatus = "out";

const DEFAULT_ATTENDEES: Attendee[] = [
  { id: "dana", name: "Dana", day: [F, B, B, F, F, F, B, B, F, F, B, B, F, F, F, F, O, O] },
  { id: "priya", name: "Priya", day: [B, F, F, F, F, B, B, F, F, T, B, B, B, F, F, F, F, F] },
  { id: "marcus", name: "Marcus", day: [B, F, F, F, F, F, B, B, B, F, F, F, B, B, F, T, F, F] },
  { id: "ines", name: "Inés", day: [F, F, T, F, F, B, F, B, B, F, B, F, F, B, F, F, F, F] },
  { id: "tobias", name: "Tobias", day: [B, F, F, F, F, F, B, F, F, B, F, B, B, F, F, F, B, B] },
  { id: "wei", name: "Wei", day: [F, F, F, F, F, B, B, B, F, B, F, F, F, B, T, F, F, O] },
];

/** ink-density ramp, shared with the ASCII field components in this registry */
const RAMP = " .:-=+*#%@";

const GLYPH: Record<SlotStatus, string> = {
  free: "·",
  tentative: "▒",
  busy: "█",
  out: " ",
};

// Resting ink. NOT `text-border` — --border is tuned for 1px hairlines and is
// invisible as type on the light theme (#ebebeb on #fafafa), which would leave
// the free cells and the rule blank at rest. Muted tints read in both themes
// and still sit below the busy blocks in the hierarchy.
const FREE_INK = "text-muted/50";
const RULE_INK = "text-muted/55";
const OPTIONAL_INK = "text-muted/30";

const GLYPH_CLASS: Record<SlotStatus, string> = {
  free: FREE_INK,
  tentative: "text-muted",
  busy: "text-foreground",
  out: FREE_INK,
};

const STATUS_WORD: Record<SlotStatus, string> = {
  free: "free",
  tentative: "tentative",
  busy: "busy",
  out: "outside working hours",
};

/** busy for solving purposes: a hard conflict or a slot outside working hours */
const isBlocked = (s: SlotStatus) => s === "busy" || s === "out";

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

type Run = { start: number; end: number };

/** every maximal run of set bits in `mask` whose length is at least `min` */
function maximalRuns(mask: boolean[], min: number): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let k = 0; k <= mask.length; k++) {
    if (k < mask.length && mask[k]) {
      if (start === -1) start = k;
    } else if (start !== -1) {
      if (k - start >= min) runs.push({ start, end: k - 1 });
      start = -1;
    }
  }
  return runs;
}

export function ScheduleAsciiFreebusy({
  attendees = DEFAULT_ATTENDEES,
  slots = 18,
  dayStartMinutes = 9 * 60,
  defaultDuration = 60,
  durations = [30, 60, 90],
  title = "Design sync — find a time",
  className = "",
}: ScheduleAsciiFreebusyProps) {
  const [duration, setDuration] = useState(defaultDuration);
  const [optional, setOptional] = useState<Record<string, boolean>>({});
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [active, setActive] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const gridRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<HTMLDivElement>(null);

  const durationSlots = Math.max(1, Math.round(duration / 30));

  const timeAt = useCallback(
    (k: number) => {
      const m = dayStartMinutes + k * 30;
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    },
    [dayStartMinutes]
  );

  const required = useMemo(() => attendees.filter((a) => !optional[a.id]), [attendees, optional]);

  /** freeMask[k] = AND over required attendees of NOT blocked */
  const freeMask = useMemo(() => {
    const mask: boolean[] = [];
    for (let k = 0; k < slots; k++) {
      mask.push(required.length > 0 && required.every((a) => !isBlocked(a.day[k] ?? "out")));
    }
    return mask;
  }, [required, slots]);

  /** how many required attendees are blocked in column k — drives the skyline */
  const busyCount = useMemo(() => {
    const counts: number[] = [];
    for (let k = 0; k < slots; k++) {
      counts.push(required.reduce((n, a) => n + (isBlocked(a.day[k] ?? "out") ? 1 : 0), 0));
    }
    return counts;
  }, [required, slots]);

  const runs = useMemo(() => maximalRuns(freeMask, durationSlots), [freeMask, durationSlots]);

  /** earliest of the longest qualifying runs */
  const best = useMemo(() => {
    let win: Run | null = null;
    for (const r of runs) {
      const len = r.end - r.start + 1;
      if (!win || len > win.end - win.start + 1) win = r;
    }
    return win;
  }, [runs]);

  /** when nothing qualifies: the window of `durationSlots` with the fewest blocked people */
  const nearMiss = useMemo(() => {
    if (best || required.length === 0) return null;
    let winner: { start: number; names: string[] } | null = null;
    for (let s = 0; s + durationSlots <= slots; s++) {
      const names: string[] = [];
      for (const a of required) {
        for (let k = s; k < s + durationSlots; k++) {
          if (isBlocked(a.day[k] ?? "out")) {
            names.push(a.name);
            break;
          }
        }
      }
      if (!winner || names.length < winner.names.length) winner = { start: s, names };
    }
    return winner;
  }, [best, required, durationSlots, slots]);

  const answer = useMemo(() => {
    if (required.length === 0) return "no one required — pick at least one attendee";
    if (best) {
      const who =
        required.length === attendees.length
          ? `all ${required.length} free`
          : `${required.length} required free`;
      return `${timeAt(best.start)} → ${timeAt(best.end + 1)}   ${who}`;
    }
    if (nearMiss) {
      const names = nearMiss.names.join(", ");
      return `no window — best is ${timeAt(nearMiss.start)} → ${timeAt(nearMiss.start + durationSlots)} with ${names} busy`;
    }
    return "no window";
  }, [required, attendees.length, best, nearMiss, timeAt, durationSlots]);

  const hoverLine = useMemo(() => {
    if (hoverCol === null) return null;
    const blocked = required.filter((a) => isBlocked(a.day[hoverCol] ?? "out"));
    if (required.length === 0) return `${timeAt(hoverCol)} — no one required`;
    if (blocked.length === 0) return `${timeAt(hoverCol)} — everyone free`;
    const names = blocked
      .map((a) => (a.day[hoverCol] === "out" ? `${a.name} (off)` : a.name))
      .join(", ");
    return `${timeAt(hoverCol)} — ${blocked.length} of ${required.length} busy: ${names}`;
  }, [hoverCol, required, timeAt]);

  const restLine = `${runs.length} window${runs.length === 1 ? "" : "s"} ≥ ${duration} min · click a name to drop them to optional`;

  const toggle = (id: string) => setOptional((o) => ({ ...o, [id]: !o[id] }));

  const focusCell = (r: number, c: number) => {
    gridRef.current
      ?.querySelector<HTMLDivElement>(`[data-cell-r="${r}"][data-cell-c="${c}"]`)
      ?.focus();
  };

  const onCellKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === "Escape") {
      setHoverCol(null);
      return;
    }
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    const nr = clamp(r + d[0], 0, attendees.length - 1);
    const nc = clamp(c + d[1], 0, slots - 1);
    setActive({ r: nr, c: nc });
    setHoverCol(nc);
    focusCell(nr, nc);
  };

  /** radiogroup semantics: arrows move the selection and the single tab stop */
  const onDurationKeyDown = (e: React.KeyboardEvent, i: number) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = durations[(i + step + durations.length) % durations.length];
    if (next === undefined) return;
    setDuration(next);
    durationRef.current
      ?.querySelector<HTMLButtonElement>(`[data-duration="${next}"]`)
      ?.focus();
  };

  const inBest = (k: number) => !!best && k >= best.start && k <= best.end;

  const colTint = (k: number) =>
    hoverCol === k ? "bg-accent/[0.10]" : inBest(k) ? "bg-accent/[0.06]" : "";

  /** underline glyph for a window of `len` columns at offset `i` */
  const underline = (len: number, i: number) => {
    if (len === 1) return "┴";
    if (i === 0) return "└";
    if (i === len - 1) return "┘";
    return "─";
  };

  const runAt = (k: number) => runs.find((r) => k >= r.start && k <= r.end) ?? null;

  const cell = "flex h-[1.35em] items-center justify-center select-none";
  const labelColumn = "7em";
  const cellWidth = "1.5em";

  return (
    <div className={`inline-flex flex-col gap-3 font-mono text-[14px] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">{title}</span>
        <div
          ref={durationRef}
          role="radiogroup"
          aria-label="Meeting length"
          className="flex items-center rounded-sm border border-border"
        >
          {durations.map((d, i) => {
            const on = d === duration;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={on}
                data-duration={d}
                tabIndex={on || (!durations.includes(duration) && i === 0) ? 0 : -1}
                onClick={() => setDuration(d)}
                onKeyDown={(e) => onDurationKeyDown(e, i)}
                className={`px-2.5 py-1 text-[11px] tabular-nums outline-none transition-colors duration-150 first:rounded-l-sm last:rounded-r-sm motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent ${
                  on ? "bg-accent/[0.14] text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {d} min
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`Attendee availability, ${timeAt(0)} to ${timeAt(slots)} in half-hour slots`}
        aria-colcount={slots + 1}
        onPointerLeave={() => setHoverCol(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setHoverCol(null);
        }}
        className="grid rounded-sm border border-border bg-surface px-3 py-2.5"
        style={{ gridTemplateColumns: `${labelColumn} repeat(${slots}, ${cellWidth})` }}
      >
        {/* hour ruler */}
        <div role="row" className="contents">
          <div role="columnheader" aria-colindex={1} className="h-[1.35em]" />
          {Array.from({ length: slots }, (_, k) =>
            k % 2 === 0 ? (
              <div
                key={k}
                role="columnheader"
                aria-colindex={k + 2}
                aria-colspan={Math.min(2, slots - k)}
                style={{ gridColumn: `span ${Math.min(2, slots - k)}` }}
                className="flex h-[1.35em] items-center text-[10px] tabular-nums text-muted"
              >
                {timeAt(k).slice(0, 2)}
              </div>
            ) : null
          )}
        </div>

        {/* one row per attendee */}
        {attendees.map((a, r) => {
          const off = !!optional[a.id];
          return (
            <div key={a.id} role="row" className="contents">
              <div role="rowheader" className="flex h-[1.35em] items-center pr-2">
                <button
                  type="button"
                  data-attendee-toggle={a.id}
                  aria-pressed={!off}
                  aria-label={`${a.name} — ${off ? "optional, excluded from the search" : "required"}. Toggle.`}
                  onClick={() => toggle(a.id)}
                  className={`w-full truncate rounded-[2px] text-left text-[12px] outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent ${
                    off ? "text-muted/60 hover:text-muted" : "text-foreground hover:text-accent"
                  }`}
                >
                  {off ? `(${a.name})` : a.name}
                </button>
              </div>
              {Array.from({ length: slots }, (_, k) => {
                const status = a.day[k] ?? "out";
                const isActive = active.r === r && active.c === k;
                const ruled = hoverCol === k && !isBlocked(status);
                return (
                  <div
                    key={k}
                    role="gridcell"
                    data-cell-r={r}
                    data-cell-c={k}
                    tabIndex={isActive ? 0 : -1}
                    aria-selected={!off && inBest(k)}
                    aria-label={`${a.name}, ${timeAt(k)}, ${STATUS_WORD[status]}${off ? ", optional" : ""}`}
                    onPointerEnter={() => setHoverCol(k)}
                    onFocus={() => {
                      setActive({ r, c: k });
                      setHoverCol(k);
                    }}
                    onKeyDown={(e) => onCellKeyDown(e, r, k)}
                    className={`${cell} rounded-[1px] outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent ${colTint(k)} ${
                      off ? OPTIONAL_INK : GLYPH_CLASS[status]
                    }`}
                  >
                    {ruled ? "┊" : GLYPH[status]}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* separator rule */}
        <div role="row" aria-hidden className="contents">
          <div className="h-[1.1em]" />
          {Array.from({ length: slots }, (_, k) => (
            <div key={k} className={`flex h-[1.1em] items-center justify-center ${RULE_INK}`}>
              {k === 0 ? "├" : k === slots - 1 ? "┤" : "─"}
            </div>
          ))}
        </div>

        {/* density skyline: ink where the team is booked */}
        <div role="row" className="contents">
          <div
            role="rowheader"
            className="flex h-[1.35em] items-center pr-2 text-[10px] uppercase tracking-[0.14em] text-muted"
          >
            load
          </div>
          {Array.from({ length: slots }, (_, k) => {
            const n = required.length;
            const idx = n === 0 ? 0 : Math.round((busyCount[k] / n) * 9);
            return (
              <div
                key={k}
                role="gridcell"
                aria-label={`${timeAt(k)}, ${busyCount[k]} of ${n} busy`}
                onPointerEnter={() => setHoverCol(k)}
                className={`${cell} text-foreground ${colTint(k)}`}
              >
                {RAMP[idx]}
              </div>
            );
          })}
        </div>

        {/* every qualifying window underlined; the best one in accent */}
        <div role="row" aria-hidden className="contents">
          <div className="h-[1.1em]" />
          {Array.from({ length: slots }, (_, k) => {
            const r = runAt(k);
            const isBest = !!best && !!r && r.start === best.start;
            const len = r ? r.end - r.start + 1 : 0;
            return (
              <div
                key={k}
                className={`flex h-[1.1em] items-center justify-center leading-none ${
                  isBest ? "text-accent" : "text-muted"
                }`}
              >
                {r ? underline(len, k - r.start) : ""}
              </div>
            );
          })}
        </div>

        {/* the answer, seated under its own window */}
        <div role="row" className="contents">
          <div role="rowheader" className="h-[1.35em]" />
          <div
            role="gridcell"
            aria-live="polite"
            style={{ gridColumn: `${(best ? Math.min(best.start, 5) : 0) + 2} / -1` }}
            className={`flex h-[1.35em] items-center whitespace-nowrap text-[12px] tabular-nums ${
              best ? "text-accent" : "text-muted"
            }`}
          >
            {answer}
          </div>
        </div>
      </div>

      {/* readout: hover detail crossfading with the resting hint */}
      <div className="relative h-[1.4em] text-[11px] text-muted">
        <span
          className={`absolute inset-0 flex items-center whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none ${
            hoverLine ? "opacity-0" : "opacity-100"
          }`}
        >
          {restLine}
        </span>
        <span
          aria-live="polite"
          className={`absolute inset-0 flex items-center whitespace-nowrap tabular-nums text-foreground transition-opacity duration-150 motion-reduce:transition-none ${
            hoverLine ? "opacity-100" : "opacity-0"
          }`}
        >
          {hoverLine ?? ""}
        </span>
      </div>
    </div>
  );
}
