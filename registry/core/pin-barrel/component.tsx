"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

// ---------------------------------------------------------------------------
// PinBarrel — a cron-expression field with a physical firing preview.
//
// Five mono sub-inputs (minute hour dom month dow) sit above a seven-day
// time rule of muted `·` glyphs. Every hour the current expression actually
// fires, its cell in the rule is replaced by a raised pin `╹` — exactly like
// the pins set into a real music-box barrel, fixed in place while a `▏`
// read-head (`now`) creeps across them in real time. The abstract syntax
// (the five fields) and its concrete consequence (which cells carry a pin)
// are always on screen together, which is the whole point: the "wait, does
// */2 mean every two hours?" question gets answered by the rule, not by
// mental math.
//
// MECHANISM: each field is parsed independently (`*`, `a`, `a,b,c`, `a-b`,
// `*/n`, `a-b/n`); a bad token invalidates that one field only. With all
// five fields valid, every hour in the rolling 7-day window (168 cells,
// anchored to local midnight) is tested against hour/month/day-of-month/
// day-of-week (day-of-month and day-of-week OR together when BOTH are
// restricted, matching real cron semantics) and the matching cells get a
// pin; the representative minute shown on hover is the smallest value in
// the parsed minute set. A second, independent minute-by-minute scan finds
// the next actual firing from "now" for the live-region readout. An invalid
// field leaves the whole barrel bare (no pin survives on bad syntax) and
// gets a dashed underline of its own — never a color-only cue.
//
// MOTION: pins are plain inline glyphs inside the 168-cell flow (no
// absolute layer, no canvas) so they never disturb the row's width. Adding
// an expression change diffs the new pin set against what's on screen:
// newly-appearing cells render pre-transition (translateY(4px) scale(0.4)
// opacity 0, transition:none) and a doubled rAF flips them to their resting
// transform over 220ms on a back-out bezier (0.34,1.56,0.64,1) — the small
// mechanical overshoot a physical pin makes seating into its slot, the same
// technique counter-carry-ripple uses for its column reveals, just without
// a spring differential-equation loop. Departing cells keep rendering for
// 120ms with a plain ease-in drop+fade before their DOM node is dropped.
// `now` creeps by getting a fresh target `left` every 30s with a matching
// 30s linear CSS transition, so it advances continuously with zero rAF
// cost. prefers-reduced-motion drops straight to the resting frame (no
// enter/exit choreography, no creep) — never a stuck or half-animated cell.
//
// A11Y: the rule is aria-hidden; the same information is a plain-language
// sentence ("At minute 0 past every 2nd hour") plus a "next run: Tue 14:00"
// line, both in one aria-live=polite region referenced by every field's
// aria-describedby, and a <button aria-expanded> disclosure that lists
// every upcoming firing as real text for anyone who cannot hover a pin.
// ---------------------------------------------------------------------------

const FIELD_ORDER = ["minute", "hour", "dom", "month", "dow"] as const;
type FieldKey = (typeof FIELD_ORDER)[number];

const FIELD_DEFS: Record<FieldKey, { label: string; min: number; max: number; width: string }> = {
  minute: { label: "minute", min: 0, max: 59, width: "calc(6ch + 0.75rem + 2px)" },
  hour: { label: "hour", min: 0, max: 23, width: "calc(6ch + 0.75rem + 2px)" },
  dom: { label: "day of month", min: 1, max: 31, width: "calc(6ch + 0.75rem + 2px)" },
  month: { label: "month", min: 1, max: 12, width: "calc(6ch + 0.75rem + 2px)" },
  dow: { label: "day of week", min: 0, max: 6, width: "calc(6ch + 0.75rem + 2px)" },
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TOTAL_DAYS = 7;
const TOTAL_HOURS = TOTAL_DAYS * 24; // 168 cells
const CELL_PX = 7;
const ENTER_MS = 220;
const EXIT_MS = 120;
const NOW_TICK_MS = 30_000;
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // small mechanical overshoot, seating
const EXIT_EASE = "cubic-bezier(0.55, 0, 1, 0.45)"; // plain accelerating drop

// -- parsing ------------------------------------------------------------

/** One cron field -> the set of values it matches, or null if any token is malformed. */
function parseField(raw: string, min: number, max: number): Set<number> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const out = new Set<number>();
  for (const token of trimmed.split(",")) {
    const t = token.trim();
    if (!t) return null;
    const step = t.match(/^(\*|\d+-\d+)\/(\d+)$/);
    if (step) {
      const [, range, stepStr] = step;
      const n = Number(stepStr);
      if (!n || n < 1) return null;
      let lo = min;
      let hi = max;
      if (range !== "*") {
        const [a, b] = range.split("-").map(Number);
        if (Number.isNaN(a) || Number.isNaN(b) || a > b || a < min || b > max) return null;
        lo = a;
        hi = b;
      }
      for (let v = lo; v <= hi; v += n) out.add(v);
      continue;
    }
    if (t === "*") {
      for (let v = min; v <= max; v++) out.add(v);
      continue;
    }
    const range = t.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (a > b || a < min || b > max) return null;
      for (let v = a; v <= b; v++) out.add(v);
      continue;
    }
    if (/^\d+$/.test(t)) {
      const v = Number(t);
      if (v < min || v > max) return null;
      out.add(v);
      continue;
    }
    return null;
  }
  return out.size ? out : null;
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

/** Plain-language phrase for one field, e.g. "every 2nd hour" or "minute 0". */
function describeUnit(
  raw: string,
  singular: string,
  opts: { names?: string[]; base?: number; plural?: string } = {}
): string {
  const t = raw.trim();
  const plural = opts.plural ?? `${singular}s`;
  const label = (n: number) => (opts.names ? (opts.names[n - (opts.base ?? 0)] ?? String(n)) : String(n));
  if (t === "*") return `every ${singular}`;
  const step = t.match(/^(\*|\d+-\d+)\/(\d+)$/);
  if (step) {
    const [, range, nStr] = step;
    const n = Number(nStr);
    if (range === "*") return `every ${ordinal(n)} ${singular}`;
    const [a, b] = range.split("-").map(Number);
    return `every ${ordinal(n)} ${singular} from ${label(a)} through ${label(b)}`;
  }
  const range = t.match(/^(\d+)-(\d+)$/);
  if (range) return `${plural} ${label(Number(range[1]))} through ${label(Number(range[2]))}`;
  if (t.includes(",")) return `${plural} ${t.split(",").map((p) => label(Number(p))).join(", ")}`;
  return `${singular} ${label(Number(t))}`;
}

interface ParsedFields {
  minute: Set<number> | null;
  hour: Set<number> | null;
  dom: Set<number> | null;
  month: Set<number> | null;
  dow: Set<number> | null;
}

/** Real cron day semantics: dom OR dow when BOTH are restricted, else whichever one is. */
function dayMatches(p: ParsedFields, domRestricted: boolean, dowRestricted: boolean, date: Date): boolean {
  const domOk = !!p.dom?.has(date.getDate());
  const dowOk = !!p.dow?.has(date.getDay());
  if (domRestricted && dowRestricted) return domOk || dowOk;
  if (domRestricted) return domOk;
  if (dowRestricted) return dowOk;
  return true;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatShort(d: Date): string {
  return `${WEEKDAY_NAMES[d.getDay()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatFull(d: Date): string {
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

interface Bucket {
  index: number; // hour offset from windowStart, 0..167
  date: Date; // representative (earliest-minute) firing inside that hour
  count: number; // how many distinct minutes fire within that hour
}

type PinPhase = "idle" | "enter" | "exit";
type PinCol = Bucket & { phase: PinPhase };

function pinStyle(phase: PinPhase, armed: boolean): CSSProperties {
  if (phase === "enter") {
    return {
      display: "inline-block",
      transitionProperty: "transform, opacity",
      transitionDuration: armed ? `${ENTER_MS}ms` : "0ms",
      transitionTimingFunction: SPRING_EASE,
      opacity: armed ? 1 : 0,
      transform: armed ? "translateY(0) scale(1)" : "translateY(4px) scale(0.4)",
    };
  }
  if (phase === "exit") {
    return {
      display: "inline-block",
      transitionProperty: "transform, opacity",
      transitionDuration: `${EXIT_MS}ms`,
      transitionTimingFunction: EXIT_EASE,
      opacity: 0,
      transform: "translateY(6px)",
    };
  }
  return { display: "inline-block" };
}

export interface PinBarrelProps {
  /** "m h dom mon dow" — 5 space-separated cron fields. */
  defaultValue?: string;
  /** fires on every keystroke with the full expression and whether it parses. */
  onChange?: (expression: string, valid: boolean) => void;
  /** legend text over the five fields. */
  label?: string;
  className?: string;
}

export function PinBarrel({
  defaultValue = "0 */2 * * *",
  onChange,
  label = "Cron schedule",
  className = "",
}: PinBarrelProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const initial = useMemo(() => {
    const parts = defaultValue.trim().split(/\s+/);
    return {
      minute: parts[0] ?? "0",
      hour: parts[1] ?? "*",
      dom: parts[2] ?? "*",
      month: parts[3] ?? "*",
      dow: parts[4] ?? "*",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [raw, setRaw] = useState<Record<FieldKey, string>>(initial);
  const [activeField, setActiveField] = useState<FieldKey | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const uid = useId();
  const sentenceId = `${uid}-sentence`;
  const listId = `${uid}-firings`;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const parsed: ParsedFields = useMemo(
    () => ({
      minute: parseField(raw.minute, FIELD_DEFS.minute.min, FIELD_DEFS.minute.max),
      hour: parseField(raw.hour, FIELD_DEFS.hour.min, FIELD_DEFS.hour.max),
      dom: parseField(raw.dom, FIELD_DEFS.dom.min, FIELD_DEFS.dom.max),
      month: parseField(raw.month, FIELD_DEFS.month.min, FIELD_DEFS.month.max),
      dow: parseField(raw.dow, FIELD_DEFS.dow.min, FIELD_DEFS.dow.max),
    }),
    [raw.minute, raw.hour, raw.dom, raw.month, raw.dow]
  );

  const invalidFields = useMemo(() => {
    const s = new Set<FieldKey>();
    for (const k of FIELD_ORDER) if (parsed[k] === null) s.add(k);
    return s;
  }, [parsed]);

  const isValid = invalidFields.size === 0;
  const domRestricted = raw.dom.trim() !== "*";
  const dowRestricted = raw.dow.trim() !== "*";

  useEffect(() => {
    onChangeRef.current?.(FIELD_ORDER.map((k) => raw[k]).join(" "), isValid);
  }, [raw, isValid]);

  const sentence = useMemo(() => {
    if (!isValid) return "Invalid expression — fix the underlined field.";
    let s = `At ${describeUnit(raw.minute, "minute")} past ${describeUnit(raw.hour, "hour")}`;
    if (domRestricted) s += `, on ${describeUnit(raw.dom, "day-of-month", { plural: "day-of-month" })}`;
    if (raw.month.trim() !== "*") s += `, in ${describeUnit(raw.month, "month", { names: MONTH_NAMES, base: 1 })}`;
    if (dowRestricted) s += `, on ${describeUnit(raw.dow, "day-of-week", { names: WEEKDAY_NAMES, plural: "day-of-week" })}`;
    return `${s}.`;
  }, [raw, isValid, domRestricted, dowRestricted]);

  const windowStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.toDateString()]);

  const buckets = useMemo<Bucket[]>(() => {
    if (!isValid) return [];
    const minuteVals = [...parsed.minute!].sort((a, b) => a - b);
    const firstMinute = minuteVals[0] ?? 0;
    const list: Bucket[] = [];
    for (let i = 0; i < TOTAL_HOURS; i++) {
      const d = new Date(windowStart.getTime() + i * 3_600_000);
      if (!parsed.hour!.has(d.getHours())) continue;
      if (!parsed.month!.has(d.getMonth() + 1)) continue;
      if (!dayMatches(parsed, domRestricted, dowRestricted, d)) continue;
      const firing = new Date(d);
      firing.setMinutes(firstMinute, 0, 0);
      list.push({ index: i, date: firing, count: minuteVals.length });
    }
    return list;
  }, [isValid, parsed, windowStart, domRestricted, dowRestricted]);

  const bucketSignature = useMemo(() => buckets.map((b) => b.index).join(","), [buckets]);

  const nextRun = useMemo(() => {
    if (!isValid) return null;
    const cursor = new Date(now);
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + 1);
    for (let i = 0; i < TOTAL_HOURS * 60; i++) {
      if (
        parsed.minute!.has(cursor.getMinutes()) &&
        parsed.hour!.has(cursor.getHours()) &&
        parsed.month!.has(cursor.getMonth() + 1) &&
        dayMatches(parsed, domRestricted, dowRestricted, cursor)
      ) {
        return new Date(cursor);
      }
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return null;
  }, [isValid, parsed, now, domRestricted, dowRestricted]);

  // -- pin enter/exit choreography ----------------------------------------
  const [pinCols, setPinCols] = useState<PinCol[]>([]);
  const [armed, setArmed] = useState(false);
  const firstRunRef = useRef(true);
  const armRafRef = useRef<number | undefined>(undefined);
  const settleTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(settleTimerRef.current);

    if (firstRunRef.current) {
      firstRunRef.current = false;
      setPinCols(buckets.map((b) => ({ ...b, phase: "idle" as PinPhase })));
      setArmed(false);
      return;
    }

    const nextMap = new Map(buckets.map((b) => [b.index, b]));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setPinCols((prevCols) => {
      const settledIdx = new Set(prevCols.filter((c) => c.phase !== "exit").map((c) => c.index));
      const nextCols: PinCol[] = [];
      for (const [idx, b] of nextMap) {
        nextCols.push({ ...b, phase: settledIdx.has(idx) ? "idle" : "enter" });
      }
      for (const c of prevCols) {
        if (!nextMap.has(c.index)) nextCols.push({ ...c, phase: "exit" });
      }
      return nextCols.sort((a, b) => a.index - b.index);
    });

    if (reduced) {
      setPinCols((prev) => prev.filter((c) => c.phase !== "exit").map((c) => ({ ...c, phase: "idle" })));
      setArmed(false);
      return;
    }

    setArmed(false);
    if (armRafRef.current !== undefined) cancelAnimationFrame(armRafRef.current);
    armRafRef.current = requestAnimationFrame(() => {
      armRafRef.current = requestAnimationFrame(() => setArmed(true));
    });

    settleTimerRef.current = window.setTimeout(() => {
      setPinCols((prev) => prev.filter((c) => c.phase !== "exit").map((c) => ({ ...c, phase: "idle" })));
      setArmed(false);
    }, Math.max(ENTER_MS, EXIT_MS) + 60);

    return () => {
      if (armRafRef.current !== undefined) cancelAnimationFrame(armRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketSignature]);

  useEffect(
    () => () => {
      window.clearTimeout(settleTimerRef.current);
      if (armRafRef.current !== undefined) cancelAnimationFrame(armRafRef.current);
    },
    []
  );

  const pinByIndex = useMemo(() => new Map(pinCols.map((c) => [c.index, c])), [pinCols]);

  const nowLeftPx = useMemo(() => {
    const elapsed = now.getTime() - windowStart.getTime();
    const fraction = Math.min(1, Math.max(0, elapsed / (TOTAL_HOURS * 3_600_000)));
    return fraction * TOTAL_HOURS * CELL_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, windowStart]);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChangeMq = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChangeMq);
    return () => mq.removeEventListener("change", onChangeMq);
  }, []);

  const hoverBucket = hoverIndex !== null ? pinByIndex.get(hoverIndex) : undefined;
  const restLine = isValid
    ? `${buckets.length} firing${buckets.length === 1 ? "" : "s"} in the next 7 days — hover a pin for its exact time`
    : "fix the underlined field to preview firings";
  const hoverLine = hoverBucket
    ? `${formatFull(hoverBucket.date)}${hoverBucket.count > 1 ? ` (+${hoverBucket.count - 1} more that hour)` : ""}`
    : null;

  const setField = (key: FieldKey, value: string) => {
    setRaw((r) => ({ ...r, [key]: value }));
  };

  return (
    <div className={`inline-flex flex-col gap-4 font-mono text-[13px] ${className}`}>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-2 block p-0 text-[11px] uppercase tracking-[0.18em] text-ns-muted">{label}</legend>
        <div className="flex items-end gap-2">
          {FIELD_ORDER.map((key) => {
            const def = FIELD_DEFS[key];
            const invalid = invalidFields.has(key);
            const fieldId = `${uid}-${key}`;
            return (
              <div key={key} className="flex flex-col items-center">
                <label htmlFor={fieldId} className="sr-only">
                  {def.label} field
                </label>
                <input
                  id={fieldId}
                  data-field={key}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={20}
                  value={raw[key]}
                  aria-describedby={sentenceId}
                  aria-invalid={invalid}
                  onFocus={() => setActiveField(key)}
                  onBlur={() => setActiveField((f) => (f === key ? null : f))}
                  onChange={(e) => setField(key, e.target.value)}
                  style={{
                    width: def.width,
                    ...(invalid
                      ? { borderBottomStyle: "dashed", borderBottomWidth: 2, borderBottomColor: "var(--foreground)" }
                      : null),
                  }}
                  className="rounded-sm border border-border bg-background px-1.5 py-1 text-center text-foreground outline-none transition-colors duration-150 hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ns-accent"
                />
                <span
                  aria-hidden
                  className={`mt-1 h-[1.1em] whitespace-nowrap text-[10px] text-ns-muted transition-opacity duration-150 motion-reduce:transition-none ${
                    activeField === key ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {def.label}
                </span>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite" className="flex flex-col gap-0.5 text-[11px] text-ns-muted">
        <p id={sentenceId}>{sentence}</p>
        <p className="tabular-nums">{`next run: ${nextRun ? formatShort(nextRun) : "none in the next 7 days"}`}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="overflow-x-auto rounded-sm border border-border bg-background">
          <div
            aria-hidden
            className="relative select-none px-2 py-2 leading-none"
            style={{ width: TOTAL_HOURS * CELL_PX + 16 }}
            onPointerLeave={() => setHoverIndex(null)}
          >
            <div className="flex whitespace-nowrap text-[11px]">
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const pin = pinByIndex.get(i);
                const boundary = i % 24 === 0 && i !== 0;
                const char = pin ? "╹" : boundary ? "┊" : "·";
                const colorClass = pin
                  ? hoverIndex === i
                    ? "text-ns-accent"
                    : "text-foreground"
                  : boundary
                    ? "text-ns-muted/70"
                    : "text-ns-muted/40";
                return (
                  <span
                    key={i}
                    onPointerEnter={pin ? () => setHoverIndex(i) : undefined}
                    className={`inline-flex justify-center transition-colors duration-150 motion-reduce:transition-none ${colorClass}`}
                    style={{ width: CELL_PX, ...pinStyle(pin?.phase ?? "idle", armed) }}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
            <span
              className="pointer-events-none absolute top-1.5 text-foreground"
              style={{
                left: nowLeftPx + 8,
                transition: reducedMotion ? "none" : `left ${NOW_TICK_MS}ms linear`,
              }}
            >
              ▏
            </span>
          </div>
        </div>

        <div aria-hidden className="relative h-[1.4em] text-[11px] text-ns-muted">
          <span
            className={`absolute inset-0 whitespace-nowrap transition-opacity duration-150 motion-reduce:transition-none ${
              hoverLine ? "opacity-0" : "opacity-100"
            }`}
          >
            {restLine}
          </span>
          <span
            className={`absolute inset-0 whitespace-nowrap tabular-nums text-foreground transition-opacity duration-150 motion-reduce:transition-none ${
              hoverLine ? "opacity-100" : "opacity-0"
            }`}
          >
            {hoverLine ?? ""}
          </span>
        </div>
      </div>

      <div>
        <button
          type="button"
          data-firings-toggle
          aria-expanded={disclosureOpen}
          aria-controls={listId}
          onClick={() => setDisclosureOpen((o) => !o)}
          className="rounded-sm border border-border px-2 py-1 text-[11px] text-ns-muted outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          {disclosureOpen ? "Hide" : "Show"} {buckets.length} upcoming firing{buckets.length === 1 ? "" : "s"}
        </button>
        {disclosureOpen && (
          <ul id={listId} className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto text-[11px] text-ns-muted">
            {buckets.length === 0 && <li className="text-ns-muted/70">No firings in the next 7 days.</li>}
            {buckets.map((b) => (
              <li key={b.index} data-firing-item className="tabular-nums text-foreground">
                {formatFull(b.date)}
                {b.count > 1 ? ` (+${b.count - 1} more that hour)` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
