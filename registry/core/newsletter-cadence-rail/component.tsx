"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

// ---------------------------------------------------------------------------
// NewsletterCadenceRail — a newsletter capture whose headline element is the
// publication's actual rhythm, drawn as a mono day-rail. Six weeks of days at
// a 1ch pitch: a dot per ordinary day, a `│` on every issue day (derived from
// one anchor date plus an interval, so the spacing IS the cadence and can be
// counted), and a `▮` caret on today. The same arithmetic that draws the rail
// writes the readout line beneath it, so the information is never trapped in
// the decoration — the rail is aria-hidden, the sentence is the accessible
// truth.
//
// The only ambient motion is today's caret, breathing on a pure CSS keyframe
// whose duration is jittered once at mount so two instances on a page never
// lock step. There is no rAF loop. Nothing responds to the pointer.
// ---------------------------------------------------------------------------

export interface NewsletterIssue {
  /** issue number, e.g. 48 */
  number: number;
  title: string;
  /** ISO date (YYYY-MM-DD) the issue shipped */
  dateISO: string;
  href?: string;
}

export interface NewsletterCadenceRailProps {
  /** any known past issue date, ISO (YYYY-MM-DD). Anchors the whole cadence. */
  anchorISO: string;
  /** days between issues. Default 14. */
  intervalDays?: number;
  /** recent issues, newest first — rendered as a short archive list */
  issues?: NewsletterIssue[];
  onSubmit?: (email: string) => void;
  className?: string;
}

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** cells, and how many of them sit before today */
const NO_ISSUES: NewsletterIssue[] = [];
const WIDE = { cells: 42, past: 28 };
const NARROW = { cells: 28, past: 21 };

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function parseISO(iso: string): number {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

function dayDiff(a: number, b: number): number {
  return Math.round((a - b) / DAY_MS);
}

/** `Jul 07` */
function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
}

/** `Tue 12 Aug` */
function longDate(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
}

function agoPhrase(days: number): string {
  if (days === 0) return "ships today";
  if (days === 1) return "shipped yesterday";
  return `shipped ${days} days ago`;
}

export function NewsletterCadenceRail({
  anchorISO,
  intervalDays = 14,
  issues = NO_ISSUES,
  onSubmit,
  className = "",
}: NewsletterCadenceRailProps) {
  const uid = useId();
  const interval = Math.max(1, Math.round(intervalDays));

  const railRef = useRef<HTMLDivElement | null>(null);
  const chRef = useRef<HTMLSpanElement | null>(null);
  const travelRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [size, setSize] = useState<"wide" | "narrow" | "none">("wide");
  const [pulse, setPulse] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const [marker, setMarker] = useState<number | null>(null);
  // The server renders in its own timezone; a viewer east or west of it can be
  // on a different calendar day, which would slide the whole rail by one cell.
  // Seeded at render so SSR still emits a real rail, re-read once at mount so
  // the client's own midnight wins (identical value ⇒ React bails out).
  const [nowMs, setNowMs] = useState(() => startOfDay(new Date()));

  // ---- cadence arithmetic (one source for both the rail and the readout) ---
  const cadence = useMemo(() => {
    const today = nowMs;
    const anchor = parseISO(anchorISO);
    const elapsed = dayDiff(today, anchor);
    const offset = ((elapsed % interval) + interval) % interval;
    const last = addDays(today, -offset);
    const next = offset === 0 ? addDays(today, interval) : addDays(last, interval);

    // issue number of `last`, extrapolated from the newest archive entry
    let lastNumber: number | null = null;
    if (issues.length > 0) {
      const newest = issues.reduce((a, b) => (b.number > a.number ? b : a));
      const steps = Math.round(dayDiff(last, parseISO(newest.dateISO)) / interval);
      lastNumber = newest.number + steps;
    }
    return { today, anchor, last, next, lastNumber, sinceLast: offset };
  }, [anchorISO, interval, issues, nowMs]);

  const dims = size === "narrow" ? NARROW : WIDE;

  const cells = useMemo(() => {
    const out: { ms: number; issue: boolean; today: boolean }[] = [];
    for (let i = 0; i < dims.cells; i++) {
      const ms = addDays(cadence.today, i - dims.past);
      const delta = Math.floor(dayDiff(ms, cadence.anchor));
      out.push({
        ms,
        issue: ((delta % interval) + interval) % interval === 0,
        today: i === dims.past,
      });
    }
    return out;
  }, [cadence.today, cadence.anchor, dims, interval]);

  // The next issue can fall past the end of the rail (most days in narrow,
  // where the rail only reaches today+6). Clamp where the marker stops, but remember
  // that the stop is NOT the issue cell — nothing may flip to a destination
  // glyph on an ordinary day. The readout still carries the real date.
  const next = useMemo(() => {
    const raw = dims.past + dayDiff(cadence.next, cadence.today);
    return { idx: Math.min(raw, dims.cells - 1), onRail: raw <= dims.cells - 1 };
  }, [cadence.next, cadence.today, dims]);
  const nextIdx = next.idx;

  // ---- mount-time jitter: no two instances breathe in lockstep -------------
  useEffect(() => {
    setNowMs(startOfDay(new Date()));
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (!mq.matches) setPulse(`${(3.2 * (0.92 + Math.random() * 0.16)).toFixed(3)}s`);
    const onChange = () => {
      setReduced(mq.matches);
      setPulse(mq.matches ? null : `${(3.2 * (0.92 + Math.random() * 0.16)).toFixed(3)}s`);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ---- responsive: measure the rail box in ch -----------------------------
  const measure = useCallback(() => {
    const rail = railRef.current;
    const probe = chRef.current;
    if (!rail || !probe) return;
    const ch = probe.getBoundingClientRect().width / 10;
    if (!ch) return;
    const capacity = rail.getBoundingClientRect().width / ch;
    setSize(capacity >= WIDE.cells ? "wide" : capacity >= 20 ? "narrow" : "none");
  }, []);

  useEffect(() => {
    measure();
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(rail);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => () => {
    if (travelRef.current) clearInterval(travelRef.current);
  }, []);

  // ---- form ---------------------------------------------------------------
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (value.length === 0) {
      setInvalid(true);
      setStatus("Enter an email address");
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setInvalid(true);
      setStatus("That address looks incomplete");
      return;
    }
    setInvalid(false);
    setDone(true);
    setStatus(`You're on the list — first issue lands ${longDate(cadence.next)}`);
    onSubmit?.(value);

    if (reduced) {
      setMarker(nextIdx);
      return;
    }
    let idx = dims.past;
    setMarker(idx);
    if (travelRef.current) clearInterval(travelRef.current);
    travelRef.current = setInterval(() => {
      idx += 1;
      setMarker(idx);
      if (idx >= nextIdx && travelRef.current) {
        clearInterval(travelRef.current);
        travelRef.current = null;
      }
    }, 90);
  }

  const arrived = marker !== null && marker >= nextIdx;

  const weekLabels: { idx: number; text: string }[] = [];
  for (let i = 0; i + 6 < dims.cells; i += 7) {
    weekLabels.push({ idx: i, text: shortDate(cells[i]?.ms ?? cadence.today).padEnd(7, " ") });
  }

  const readout = [
    cadence.lastNumber !== null
      ? `issue #${cadence.lastNumber} ${agoPhrase(cadence.sinceLast)}`
      : `last issue ${agoPhrase(cadence.sinceLast)}`,
    `next issue ${longDate(cadence.next)}`,
    `every ${interval} days`,
  ].join(" · ");

  const fieldId = `${uid}-email`;
  const statusId = `${uid}-status`;

  return (
    <div className={`ns-ncr relative w-full ${className}`}>
      <style>{CSS}</style>

      {/* ch probe — measured, never seen */}
      <span
        ref={chRef}
        aria-hidden="true"
        className="pointer-events-none absolute -z-10 select-none font-mono text-[13px] leading-none opacity-0"
      >
        0000000000
      </span>

      <div ref={railRef} className="w-full overflow-hidden">
        {size !== "none" && (
          <div aria-hidden="true" className="font-mono text-[13px] leading-[1.5] whitespace-pre">
            <div suppressHydrationWarning>
              {cells.map((cell, i) => {
                const isDest = arrived && next.onRail && i === nextIdx;
                const isMarker = marker !== null && marker === i && !isDest;
                let glyph = cell.issue ? "│" : "·";
                if (cell.today) glyph = "▮";
                if (isDest) glyph = "█";
                if (isMarker) glyph = "▸";

                let color = "var(--ns-muted)";
                let opacity = i < dims.past ? 0.35 : 0.6;
                if (cell.issue) {
                  color = "var(--foreground)";
                  opacity = 0.9;
                }
                if (cell.today || isMarker || isDest) {
                  color = "var(--ns-accent)";
                  opacity = 1;
                }

                return (
                  <span
                    key={i}
                    suppressHydrationWarning
                    className={cell.today && pulse && !isMarker ? "ns-ncr-caret" : undefined}
                    style={{
                      color,
                      opacity,
                      animationDuration: cell.today && pulse && !isMarker ? pulse : undefined,
                    }}
                  >
                    {glyph}
                  </span>
                );
              })}
            </div>
            <div
              suppressHydrationWarning
              className="tabular-nums text-ns-muted opacity-70 text-[13px] leading-[1.5]"
            >
              {weekLabels.map((w) => (
                <span key={w.idx} suppressHydrationWarning>
                  {w.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <p
        suppressHydrationWarning
        className="mt-3 font-mono text-xs tabular-nums text-ns-muted"
      >
        {readout}
      </p>

      {issues.length > 0 && (
        <ul className="mt-4 flex flex-col border-t border-border">
          {issues.slice(0, 3).map((issue) => (
            <li key={issue.number} className="border-b border-border">
              <a
                href={issue.href ?? "#"}
                className="flex items-baseline gap-3 py-2 text-sm text-foreground transition-colors duration-150 hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                <span className="font-mono text-xs tabular-nums text-ns-muted">
                  #{issue.number}
                </span>
                <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                <span className="font-mono text-xs tabular-nums text-ns-muted">
                  {shortDate(parseISO(issue.dateISO))}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {done ? (
        <p className="mt-5 font-mono text-sm text-foreground">
          <span className="text-ns-accent">▸</span> Subscribed.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-2" noValidate>
          <label
            htmlFor={fieldId}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted"
          >
            Email
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={fieldId}
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              placeholder="you@studio.com"
              aria-invalid={invalid || undefined}
              aria-describedby={statusId}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-sm border border-border bg-background px-3 py-2 font-mono text-sm text-foreground transition-colors duration-150 placeholder:text-ns-muted/60 hover:border-ns-muted focus-visible:border-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent aria-[invalid=true]:border-[var(--error)]"
            />
            <button
              type="submit"
              className="shrink-0 rounded-sm border border-border px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-foreground transition-colors duration-150 hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              Subscribe
            </button>
          </div>
        </form>
      )}

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={`mt-2 min-h-[1.25rem] font-mono text-xs ${
          invalid ? "text-[var(--error)]" : "text-ns-muted"
        }`}
      >
        {status}
      </p>
    </div>
  );
}

const CSS = `
@keyframes ns-ncr-breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
.ns-ncr-caret { animation-name: ns-ncr-breathe; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
@media (prefers-reduced-motion: reduce) { .ns-ncr-caret { animation: none; } }
`;

export default NewsletterCadenceRail;
