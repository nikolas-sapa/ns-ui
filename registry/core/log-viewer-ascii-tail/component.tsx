"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

// ---------------------------------------------------------------------------
// TailPane — a `tail -f` log viewer with a real bounded ring buffer, an ASCII
// severity column, a density gutter and follow-mode that detaches the instant
// you scroll up.
//
// The three things that make it honest rather than a log-shaped animation:
//  1. memory is bounded — appends overwrite the oldest slot of a fixed
//     Array(capacity); nothing grows without limit, however long it runs.
//  2. the stream is deterministic — one LCG drives both the inter-line delay
//     and the severity draw, so cadence jitters like real traffic instead of
//     ticking, and the same seed always replays the same log.
//  3. appends never render per-line — they land in a ref and flush to React
//     through ONE rAF-coalesced setState per frame, and only the rows inside
//     the viewport are in the DOM (fixed 18px rows, absolute positioning).
// ---------------------------------------------------------------------------

export type LogSeverity = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type LogLine = {
  /** monotonically increasing sequence number; also its ring slot (seq % capacity) */
  seq: number;
  /** pre-formatted HH:MM:SS.mmm wall clock */
  time: string;
  sev: LogSeverity;
  service: string;
  message: string;
};

export interface LogViewerAsciiTailProps {
  /** ring buffer size — appends past this overwrite the oldest line. Default 2000. */
  capacity?: number;
  /** LCG seed; the same seed replays the same stream exactly. Default 20240804. */
  seed?: number;
  /** lines synthesised before the stream starts, so the pane is dense at rest. Default 200. */
  initialLines?: number;
  /** service column values drawn from. */
  services?: string[];
  className?: string;
  "aria-label"?: string;
}

const RAMP = " .:-=+*#%@";
const ROW_H = 18; // px — fixed, which is what makes windowing trivial
const CHUNK = 16; // lines per density-gutter cell (grows to keep MAX_CELLS)
const MAX_CELLS = 48; // gutter cells stay tall enough to read and to hit
const OVERSCAN = 6; // rows rendered beyond the viewport, each side
const NEAR_BOTTOM = 8; // px — inside this, follow re-attaches
const SERVICE_W = 11; // chars, padded so the pipes form true vertical rules

const LEVELS: LogSeverity[] = ["DEBUG", "INFO", "WARN", "ERROR"];
const LEVEL_RANK: Record<LogSeverity, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

const GLYPH: Record<LogSeverity, string> = {
  DEBUG: "·", // ·
  INFO: "─", // ─
  WARN: "≡", // ≡
  ERROR: "█", // █
};

// glyph AND weight together, never hue alone. The faintest ink is a muted
// tint, NOT `text-border` — --border is tuned for 1px hairlines and is
// invisible as type on the light theme (#ebebeb on #ffffff).
const FAINT = "text-muted/45";

const SEV_INK: Record<LogSeverity, string> = {
  DEBUG: FAINT,
  INFO: "text-muted",
  WARN: "text-foreground font-medium",
  ERROR: "text-accent font-semibold",
};

const DEFAULT_SERVICES = [
  "api-gateway",
  "auth-worker",
  "orders-svc",
  "ledger-sync",
  "edge-cache",
  "search-idx",
];

const MESSAGES: Record<LogSeverity, string[]> = {
  DEBUG: [
    "cache hit ratio 0.94 over 512 keys",
    "span emitted trace=9f2a1c parent=3bd881",
    "pool idle 12/32 connections",
    "heartbeat ack in 4ms",
    "resolved 3 dns records ttl=30s",
    "compacted 18 segments into 6",
    "token introspection cached 240s",
  ],
  INFO: [
    "GET /v2/orders 200 in 38ms",
    "POST /v2/checkout 201 in 112ms",
    "session refreshed for user 84213",
    "published 128 events to orders.v2",
    "shard 4 rebalanced in 1.8s",
    "index snapshot written 41MB",
    "GET /health 200 in 2ms",
    "invoice 4471 settled in 74ms",
  ],
  WARN: [
    "retry 2/5 after connection reset",
    "queue depth 8420 above soft limit",
    "p99 latency 812ms over budget",
    "clock skew 340ms against peer 3",
    "rate limit 80% consumed for key ak_19",
  ],
  ERROR: [
    "upstream 502 after 3 retries",
    "deadline exceeded on shard 7",
    "checksum mismatch on segment 41",
    "connection refused to ledger:5432",
  ],
};

// deterministic LCG — one stream drives delay, severity, service and message
function nextSeed(s: number): number {
  return (s * 1664525 + 1013904223) >>> 0;
}

function formatClock(msOfDay: number): string {
  const ms = Math.floor(msOfDay) % 86_400_000;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const f = Math.floor(ms) % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(f).padStart(3, "0")}`;
}

function drawSeverity(r: number): LogSeverity {
  if (r < 0.42) return "DEBUG";
  if (r < 0.82) return "INFO";
  if (r < 0.95) return "WARN";
  return "ERROR";
}

/** splits a message around every case-insensitive occurrence of `q` */
function inkMatches(message: string, q: string) {
  if (!q) return [{ text: message, hit: false }];
  const out: { text: string; hit: boolean }[] = [];
  const hay = message.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  for (;;) {
    const at = hay.indexOf(needle, i);
    if (at === -1) break;
    if (at > i) out.push({ text: message.slice(i, at), hit: false });
    out.push({ text: message.slice(at, at + needle.length), hit: true });
    i = at + needle.length;
  }
  if (i < message.length) out.push({ text: message.slice(i), hit: false });
  return out;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function LogViewerAsciiTail({
  capacity = 2000,
  seed = 20240804,
  initialLines = 200,
  services = DEFAULT_SERVICES,
  className = "",
  "aria-label": ariaLabel = "Application log, live tail",
}: LogViewerAsciiTailProps) {
  // an inline `services={[...]}` prop would otherwise be a new array every
  // render, re-creating appendOne and re-running the seed effect forever;
  // rebuilding from a joined key makes the identity depend on the CONTENT
  const serviceKey = services.join("|");
  const serviceList = useMemo(() => serviceKey.split("|"), [serviceKey]);

  // --- ring buffer ---------------------------------------------------------
  const ringRef = useRef<(LogLine | undefined)[]>([]);
  const totalRef = useRef(0); // total lines ever appended; head slot = total % capacity
  const rngRef = useRef(seed >>> 0);
  const clockRef = useRef(43_471_882); // 12:04:31.882, a fixed start so SSR/CSR agree

  // --- flush plumbing (one setState per frame, never one per line) ----------
  const [tick, setTick] = useState(0);
  const rafRef = useRef(0);
  const newRef = useRef(0);
  const [newCount, setNewCount] = useState(0);

  // --- follow mode ---------------------------------------------------------
  const paneRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const [follow, setFollow] = useState(true);

  // --- windowing -----------------------------------------------------------
  const [range, setRange] = useState({ start: 0, end: 60 });

  // --- filters -------------------------------------------------------------
  const [minLevel, setMinLevel] = useState<LogSeverity>("DEBUG");
  const [query, setQuery] = useState("");

  // --- motion / lifecycle --------------------------------------------------
  const [reduced, setReduced] = useState(false);
  const [running, setRunning] = useState(true);
  const runningRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setNewCount(newRef.current);
      setTick((t) => t + 1);
    });
  }, []);

  /** synthesise exactly one line and write it into its ring slot */
  const appendOne = useCallback(() => {
    let s = rngRef.current;

    s = nextSeed(s);
    const delay = 90 + (s / 4_294_967_296) * 260;
    clockRef.current += delay;

    s = nextSeed(s);
    const sev = drawSeverity(s / 4_294_967_296);

    s = nextSeed(s);
    const service =
      serviceList[Math.floor((s / 4_294_967_296) * serviceList.length)] ?? serviceList[0]!;

    s = nextSeed(s);
    const pool = MESSAGES[sev];
    const message = pool[Math.floor((s / 4_294_967_296) * pool.length)] ?? pool[0]!;

    rngRef.current = s;

    const seq = totalRef.current;
    ringRef.current[seq % capacity] = {
      seq,
      time: formatClock(clockRef.current),
      sev,
      service,
      message,
    };
    totalRef.current = seq + 1;
    if (!followRef.current) newRef.current += 1;
    return delay;
  }, [capacity, serviceList]);

  // reduced motion
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(mql.matches);
      if (mql.matches) {
        setRunning(false);
        runningRef.current = false;
      }
    };
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // seed the buffer once — the pane is dense and legible before any motion
  useEffect(() => {
    ringRef.current = new Array(capacity);
    totalRef.current = 0;
    rngRef.current = seed >>> 0;
    clockRef.current = 43_471_882;
    for (let i = 0; i < initialLines; i++) appendOne();
    newRef.current = 0;
    setNewCount(0);
    setTick((t) => t + 1);
  }, [capacity, seed, initialLines, appendOne]);

  // the stream: a self-rescheduling timeout whose delay is drawn from the LCG,
  // paused while the tab is hidden and while `running` is false
  useEffect(() => {
    runningRef.current = running;
    if (!running) return;

    let cancelled = false;
    // document.hidden truly stops the generator (no polling); visibilitychange
    // restarts it, so a backgrounded tab costs nothing.
    const step = () => {
      if (cancelled || document.hidden) {
        timerRef.current = null;
        return;
      }
      const delay = appendOne();
      scheduleFlush();
      timerRef.current = setTimeout(step, delay);
    };
    timerRef.current = setTimeout(step, 120);

    const onVis = () => {
      if (!document.hidden && !cancelled && timerRef.current === null) {
        timerRef.current = setTimeout(step, 120);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [running, appendOne, scheduleFlush]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // --- derived views -------------------------------------------------------
  const lines = useMemo(() => {
    const total = totalRef.current;
    const from = Math.max(0, total - capacity);
    const out: LogLine[] = [];
    for (let i = from; i < total; i++) {
      const l = ringRef.current[i % capacity];
      if (l) out.push(l);
    }
    return out;
    // tick is the flush signal; the data itself lives in refs
  }, [tick, capacity]);

  const rows = useMemo(() => {
    const min = LEVEL_RANK[minLevel];
    const q = query.trim().toLowerCase();
    return lines.filter(
      (l) =>
        LEVEL_RANK[l.sev] >= min &&
        (q === "" ||
          l.message.toLowerCase().includes(q) ||
          l.service.toLowerCase().includes(q))
    );
  }, [lines, minLevel, query]);

  const chunks = useMemo(() => {
    // one cell per CHUNK lines, but the chunk grows once the buffer would
    // otherwise push the index past MAX_CELLS — a 2000-line ring at a fixed 16
    // would be 125 cells of ~3px, unreadable and untappable.
    const size = Math.max(CHUNK, Math.ceil(rows.length / MAX_CELLS));
    const out: { start: number; size: number; glyph: string; errors: number; warns: number }[] = [];
    for (let i = 0; i < rows.length; i += size) {
      let errors = 0;
      let warns = 0;
      const stop = Math.min(i + size, rows.length);
      for (let j = i; j < stop; j++) {
        if (rows[j]!.sev === "ERROR") errors++;
        else if (rows[j]!.sev === "WARN") warns++;
      }
      const idx = Math.min(9, errors * 3 + warns);
      out.push({ start: i, size: stop - i, glyph: RAMP[idx]!, errors, warns });
    }
    return out;
  }, [rows]);

  // --- scroll plumbing -----------------------------------------------------
  const measure = useCallback(() => {
    const el = paneRef.current;
    if (!el) return;
    const start = Math.max(0, Math.floor(el.scrollTop / ROW_H) - OVERSCAN);
    const end = Math.ceil((el.scrollTop + el.clientHeight) / ROW_H) + OVERSCAN;
    setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
  }, []);

  const attach = useCallback(() => {
    followRef.current = true;
    newRef.current = 0;
    setNewCount(0);
    setFollow(true);
    const el = paneRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    measure();
  }, [measure]);

  const onScroll = useCallback(() => {
    const el = paneRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance > NEAR_BOTTOM) {
      if (followRef.current) {
        followRef.current = false;
        setFollow(false);
      }
    } else if (!followRef.current) {
      followRef.current = true;
      newRef.current = 0;
      setNewCount(0);
      setFollow(true);
    }
    measure();
  }, [measure]);

  // pin to the bottom while following — after every flush and every filter change
  useIsoLayoutEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    if (followRef.current) el.scrollTop = el.scrollHeight;
    measure();
  }, [rows, measure]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const el = paneRef.current;
    if (!el) return;
    if (e.key === "End") {
      e.preventDefault();
      attach();
    } else if (e.key === "Home") {
      e.preventDefault();
      el.scrollTop = 0;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      el.scrollTop += ROW_H;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      el.scrollTop -= ROW_H;
    } else if (e.key === "PageDown") {
      e.preventDefault();
      el.scrollTop += el.clientHeight - ROW_H;
    } else if (e.key === "PageUp") {
      e.preventDefault();
      el.scrollTop -= el.clientHeight - ROW_H;
    }
  };

  // roving tabindex: selecting with the arrow keys must MOVE focus too,
  // otherwise the ring is left behind on a button that is now tabIndex=-1
  const radioRefs = useRef<Partial<Record<LogSeverity, HTMLButtonElement | null>>>({});

  const moveLevel = (to: LogSeverity) => {
    setMinLevel(to);
    radioRefs.current[to]?.focus();
  };

  const onLevelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = LEVELS.indexOf(minLevel);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      moveLevel(LEVELS[Math.min(LEVELS.length - 1, i + 1)]!);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      moveLevel(LEVELS[Math.max(0, i - 1)]!);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveLevel(LEVELS[0]!);
    } else if (e.key === "End") {
      e.preventDefault();
      moveLevel(LEVELS[LEVELS.length - 1]!);
    }
  };

  const visible = rows.slice(range.start, range.end);
  const inputId = "log-tail-filter";

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background font-mono text-xs ${className}`}
    >
      {/* header: the level control doubles as the glyph legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
        <span className="text-muted">
          tail -f <span className="text-foreground">/var/log/edge.log</span>
        </span>

        <div
          role="radiogroup"
          aria-label="Minimum severity"
          onKeyDown={onLevelKeyDown}
          className="flex items-center overflow-hidden rounded-sm border border-border"
        >
          {LEVELS.map((lv) => {
            const on = lv === minLevel;
            return (
              <button
                key={lv}
                ref={(node) => {
                  radioRefs.current[lv] = node;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setMinLevel(lv)}
                className={`px-2 py-1 whitespace-pre transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                  on ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <span className={on ? "" : SEV_INK[lv]}>{GLYPH[lv]}</span> {lv}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className="text-muted">
            grep
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="502"
            spellCheck={false}
            className="w-28 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          />
        </div>

        <span className="ml-auto tabular-nums text-muted">
          {rows.length}/{lines.length} lines · ring {capacity}
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* the log pane */}
        <div
          ref={paneRef}
          data-log-pane
          role="log"
          aria-live="off"
          aria-label={ariaLabel}
          tabIndex={0}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        >
          <div className="relative w-full" style={{ height: rows.length * ROW_H }}>
            {visible.map((l, i) => (
              <div
                key={l.seq}
                className="absolute inset-x-0 flex items-center whitespace-pre px-3 text-muted transition-colors duration-100 hover:bg-surface hover:text-foreground"
                style={{ top: (range.start + i) * ROW_H, height: ROW_H }}
              >
                <span className="tabular-nums">{l.time}</span>
                <span className={FAINT}>{" │ "}</span>
                <span className={SEV_INK[l.sev]}>{GLYPH[l.sev]}</span>
                <span className={FAINT}>{" │ "}</span>
                <span>{l.service.padEnd(SERVICE_W)}</span>
                <span className={FAINT}>{" │ "}</span>
                <span>
                  {inkMatches(l.message, query.trim()).map((seg, k) => (
                    <span key={k} className={seg.hit ? "text-accent" : undefined}>
                      {seg.text}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* density gutter — a severity index, one cell per 16-line chunk */}
        <div
          role="group"
          aria-label="Severity density index"
          className="flex w-5 shrink-0 flex-col border-l border-border bg-surface/40 py-1"
        >
          {chunks.map((c) => {
            const weight =
              c.errors > 0
                ? "text-accent"
                : c.warns > 1
                  ? "text-foreground"
                  : c.warns > 0
                    ? "text-muted"
                    : FAINT;
            return (
              <button
                key={c.start}
                type="button"
                onClick={() => {
                  const el = paneRef.current;
                  if (!el) return;
                  el.scrollTop = c.start * ROW_H;
                }}
                aria-label={`Jump to lines ${c.start + 1} to ${c.start + c.size}, ${c.errors} errors and ${c.warns} warnings`}
                className={`flex min-h-0 flex-1 items-center justify-center overflow-hidden leading-none transition-colors duration-100 hover:bg-surface hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${weight}`}
              >
                {c.glyph === " " ? "·" : c.glyph}
              </button>
            );
          })}
        </div>

        {/* detach bar — the count of what arrived while you were reading */}
        {!follow && (
          <button
            type="button"
            onClick={attach}
            className="absolute right-5 bottom-0 left-0 border-t border-border bg-surface py-1.5 text-center whitespace-pre text-muted transition-colors duration-100 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            {"└─ "}
            <span className="tabular-nums text-accent">{newCount}</span>
            {` new line${newCount === 1 ? "" : "s"} ─ End to follow ─┘`}
          </button>
        )}
      </div>

      {reduced && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
          <span className="text-muted">
            {running
              ? `stream running — ${lines.length} lines in the ring`
              : `stream paused — ${lines.length} lines loaded`}
          </span>
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="rounded-sm border border-border px-2 py-1 whitespace-pre text-muted transition-colors duration-100 hover:border-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            {running ? "■ pause stream" : "▸ resume stream"}
          </button>
        </div>
      )}
    </div>
  );
}
