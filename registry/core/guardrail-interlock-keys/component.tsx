"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// KeyInterlock — output guardrails drawn as a trapped-key interlock.
//
// Every policy gate physically holds one key. A gate that passed has its key
// SEATED in its keyway; a gate still evaluating has an EMPTY keyway with a
// breathing dashed outline; a gate that tripped has an empty keyway with a
// solid bar drawn across it, so it cannot accept a key at all. Every state is
// shape-coded — seated / empty-dashed / empty-barred — and there is no status
// hue anywhere in the component, so it survives monochrome and both themes.
//
// Released keys travel to the RELEASE LOCK on the right. The lock's bolt only
// retracts once every slot is filled; until then it stays shut across the
// output port and the output panel below renders dimmed behind a diagonal
// hatch. Overriding a tripped gate seats a HATCHED key instead of a solid one
// and writes a permanent audit line — an overridden interlock stays visually
// distinguishable from a passed one forever. That is the safety property.
// ---------------------------------------------------------------------------

export type InterlockGateState = "pending" | "released" | "tripped";

export type InterlockGate = {
  /** rule id, shown in Geist Mono and used in the audit line, e.g. "pii_scan" */
  id: string;
  label: string;
  state: InterlockGateState;
  /** one line shown in the mono strip while the gate is hovered or focused */
  detail?: string;
};

export interface KeyInterlockProps {
  gates: InterlockGate[];
  /** the model output the lock is holding */
  output: string;
  /** accessible name for the interlock group */
  label?: string;
  /** short caption above the row */
  title?: string;
  /** who is recorded on an override audit line */
  operator?: string;
  /** fired when a tripped gate is overridden — the owner flips that gate to
   * "released" (this component never mutates the gates it was handed) */
  onOverride?: (id: string) => void;
  className?: string;
}

const GATE_W = 40;
const GATE_H = 54;
const LOCK_W = 88;
/** keeps the slot run off the lock's own side walls, so the outermost slot is
 * never drawn half on top of the body outline */
const SLOT_INSET = 10;
const TRAVEL_MS = 420;
const TRAVEL_EASE = "cubic-bezier(0.22,1,0.36,1)";

type Flight = {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  hatched: boolean;
  moved: boolean;
};

function stamp() {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function stateWord(g: InterlockGate, overridden: boolean) {
  if (g.state === "released")
    return overridden ? "released by override" : "key seated";
  if (g.state === "tripped") return "tripped, keyway barred";
  return "awaiting key";
}

/** the key glyph: a 7px bit filling the keyway over a 3px stem */
function KeyGlyph({
  hatch,
  patternId,
}: {
  hatch: boolean;
  patternId: string;
}) {
  const fill = hatch ? `url(#${patternId})` : "currentColor";
  return (
    <>
      <rect
        x="0.5"
        y="0"
        width="7"
        height="8"
        fill={fill}
        stroke={hatch ? "currentColor" : "none"}
        strokeWidth={hatch ? 1 : 0}
      />
      <rect x="2.5" y="8" width="3" height="18" fill="currentColor" />
    </>
  );
}

export function KeyInterlock({
  gates,
  output,
  label = "Output guardrails",
  title = "Output interlock",
  operator = "operator",
  onOverride,
  className = "",
}: KeyInterlockProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const hatchId = `ns-ilk-hatch-${uid}`;

  const rowRef = useRef<HTMLDivElement>(null);
  const gateKeyRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const lockSlotRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  // seeded from props so the very first paint (server and client alike) already
  // shows the keys that are in, instead of flashing an empty lock
  const arrivedRef = useRef<Set<string>>(
    new Set(gates.filter((g) => g.state === "released").map((g) => g.id))
  );
  const inFlightRef = useRef<Set<string>>(new Set());
  const overriddenRef = useRef<Set<string>>(new Set());
  const announcedRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const [flights, setFlights] = useState<Flight[]>([]);
  const [audit, setAudit] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timersRef.current.push(t);
  }, []);

  const startFlight = useCallback(
    (id: string) => {
      const row = rowRef.current;
      const from = gateKeyRefs.current[id];
      const to = lockSlotRefs.current[id];
      if (!row || !from || !to) {
        arrivedRef.current.add(id);
        bump();
        return;
      }
      const r = row.getBoundingClientRect();
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      inFlightRef.current.add(id);
      const flight: Flight = {
        id,
        x0: a.left - r.left,
        y0: a.top - r.top,
        x1: b.left - r.left,
        y1: b.top - r.top,
        hatched: overriddenRef.current.has(id),
        moved: false,
      };
      setFlights((f) => [...f.filter((x) => x.id !== id), flight]);
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setFlights((f) =>
            f.map((x) => (x.id === id ? { ...x, moved: true } : x))
          )
        )
      );
      later(() => {
        inFlightRef.current.delete(id);
        arrivedRef.current.add(id);
        setFlights((f) => f.filter((x) => x.id !== id));
        bump();
      }, TRAVEL_MS);
    },
    [later]
  );

  // reconcile the lock against the gates it was handed: a gate that reaches
  // "released" sends its key across; a gate that leaves "released" (re-armed
  // upstream) takes its key back out of the lock.
  useEffect(() => {
    let changed = false;
    for (const g of gates) {
      const arrived = arrivedRef.current.has(g.id);
      const flying = inFlightRef.current.has(g.id);
      if (g.state === "released" && !arrived && !flying) {
        if (!mountedRef.current || reduced) {
          arrivedRef.current.add(g.id);
          changed = true;
        } else {
          startFlight(g.id);
        }
      }
      if (g.state !== "released" && arrived) {
        arrivedRef.current.delete(g.id);
        changed = true;
      }
    }
    mountedRef.current = true;
    if (changed) bump();
  }, [gates, reduced, startFlight]);

  // announce each trip exactly once
  useEffect(() => {
    const fresh = gates.filter(
      (g) => g.state === "tripped" && !announcedRef.current.has(g.id)
    );
    for (const g of gates) {
      if (g.state !== "tripped") announcedRef.current.delete(g.id);
    }
    if (fresh.length === 0) return;
    fresh.forEach((g) => announcedRef.current.add(g.id));
    setAnnounce(
      fresh.map((g) => `${g.id} tripped, output held`).join(". ") + "."
    );
  }, [gates]);

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId]);

  const seated = gates.filter((g) => arrivedRef.current.has(g.id)).length;
  const released = seated === gates.length && gates.length > 0;
  const tripped = gates.filter((g) => g.state === "tripped");
  const active = gates.find((g) => g.id === activeId) ?? null;

  const slotXs = useMemo(() => {
    const n = Math.max(gates.length, 1);
    const step = (LOCK_W - SLOT_INSET * 2) / n;
    return gates.map((_, i) => SLOT_INSET + step * (i + 0.5));
  }, [gates]);

  function override(g: InterlockGate) {
    if (g.state !== "tripped") return;
    overriddenRef.current.add(g.id);
    // newest first, and the list is height-bounded rather than unbounded: an
    // audit trail that grows the component's own box forever makes the card
    // reframe on every entry. Nothing is ever dropped — it scrolls.
    setAudit((a) => [`override ${g.id} · ${operator} · ${stamp()}`, ...a]);
    setAnnounce(`${g.id} overridden by ${operator}`);
    onOverride?.(g.id);
  }

  return (
    <div
      data-interlock
      role="group"
      aria-label={label}
      className={"font-sans " + className}
    >
      <style>{`
.ns-ilk-breathe{animation:ns-ilk-breathe 3.2s ease-in-out infinite alternate}
@keyframes ns-ilk-breathe{from{opacity:.45}to{opacity:1}}
.ns-ilk-gate{transition:transform 180ms ease-out,opacity 180ms ease-out}
.ns-ilk-strip{transition:opacity 180ms ease-out,transform 180ms ease-out}
.ns-ilk-bolt{transition:transform ${TRAVEL_MS}ms cubic-bezier(0.34,1.8,0.64,1)}
.ns-ilk-fly{transition:transform ${TRAVEL_MS}ms ${TRAVEL_EASE}}
.ns-ilk-veil{transition:opacity 320ms ease-out}
@media (prefers-reduced-motion: reduce){
  .ns-ilk-breathe{animation:none;opacity:.75}
  .ns-ilk-gate,.ns-ilk-strip,.ns-ilk-bolt,.ns-ilk-fly,.ns-ilk-veil{transition:none}
}
`}</style>

      <div className="mb-4 flex items-end justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          {title}
        </p>
        <p
          data-interlock-readout
          className="shrink-0 font-mono text-[11px] text-foreground"
        >
          {seated}/{gates.length} keys
          <span className="px-1.5 text-muted">·</span>
          {released ? "output released" : "output held"}
        </p>
      </div>

      {/* ---- the interlock row ------------------------------------------ */}
      <div
        ref={rowRef}
        data-interlock-row
        className="relative flex items-start"
        onPointerLeave={() => setActiveId(null)}
        onBlur={() => setActiveId(null)}
      >
        <div className="flex items-start gap-3">
          {gates.map((g, i) => {
            const dim = activeId !== null && activeId !== g.id;
            const lift = activeId === g.id;
            const overridden = overriddenRef.current.has(g.id);
            return (
              <button
                key={g.id}
                type="button"
                data-interlock-gate={g.id}
                data-state={g.state}
                aria-label={`${g.label}: ${stateWord(g, overridden)}${
                  g.detail ? `. ${g.detail}` : ""
                }`}
                onPointerEnter={() => setActiveId(g.id)}
                onFocus={() => setActiveId(g.id)}
                // a tap/click pins this gate's detail. Deliberately NOT a
                // toggle: pointerenter has already set activeId, so toggling
                // would blank the strip on the very click that asked for it.
                onClick={() => setActiveId(g.id)}
                className={
                  "ns-ilk-gate group flex w-16 flex-col items-center rounded-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent " +
                  (dim ? "opacity-30 " : "opacity-100 ") +
                  (lift ? "-translate-y-0.5" : "translate-y-0")
                }
              >
                <span className="relative block">
                  {/* keyway centre marker — the flight origin */}
                  <span
                    ref={(el) => {
                      gateKeyRefs.current[g.id] = el;
                    }}
                    aria-hidden
                    className="pointer-events-none absolute left-[16.5px] top-[3px] block h-0 w-0"
                  />
                  <svg
                    width={GATE_W}
                    height={GATE_H}
                    viewBox={`0 0 ${GATE_W} ${GATE_H}`}
                    fill="none"
                    aria-hidden
                    className="block text-foreground"
                  >
                    <defs>
                      <pattern
                        id={`${hatchId}-${i}`}
                        width="4"
                        height="4"
                        patternUnits="userSpaceOnUse"
                        patternTransform="rotate(45)"
                      >
                        <rect
                          width="2"
                          height="4"
                          fill="currentColor"
                          opacity="0.85"
                        />
                      </pattern>
                    </defs>
                    {/* slot body with the keyway notch cut into its top edge */}
                    <path
                      d="M0.5 53.5 V0.5 H16.5 V14 H23.5 V0.5 H39.5 V53.5 Z"
                      className="stroke-border"
                      strokeWidth="1"
                    />
                    {g.state === "released" ? (
                      <g transform="translate(16,3.5)">
                        <KeyGlyph
                          hatch={overridden}
                          patternId={`${hatchId}-${i}`}
                        />
                      </g>
                    ) : null}
                    {g.state === "pending" ? (
                      <rect
                        className="ns-ilk-breathe stroke-foreground"
                        style={{ animationDelay: `${((i * 260) % 1040) - 520}ms` }}
                        x="16.75"
                        y="2.75"
                        width="6.5"
                        height="10.5"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                        fill="none"
                      />
                    ) : null}
                    {g.state === "tripped" ? (
                      <line
                        x1="8"
                        y1="18"
                        x2="32"
                        y2="4.1"
                        className="stroke-foreground"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    ) : null}
                  </svg>
                </span>
                <span
                  className={
                    "mt-2 block w-full break-all text-center font-mono text-[10px] leading-[1.15] " +
                    (g.state === "tripped"
                      ? "font-medium text-foreground"
                      : "text-muted")
                  }
                  title={g.id}
                >
                  {g.id}
                </span>
              </button>
            );
          })}
        </div>

        {/* rail from the gates to the lock */}
        <div className="relative mx-3 h-[54px] w-8 shrink-0" aria-hidden>
          <div className="absolute inset-x-0 top-[9px] h-px bg-border" />
        </div>

        {/* ---- the release lock ----------------------------------------- */}
        <div className="flex shrink-0 flex-col items-center">
          <span className="relative block">
            {gates.map((g, i) => (
              <span
                key={g.id}
                ref={(el) => {
                  lockSlotRefs.current[g.id] = el;
                }}
                aria-hidden
                className="pointer-events-none absolute top-[8px] block h-0 w-0"
                style={{ left: `${slotXs[i] - 3.5}px` }}
              />
            ))}
            <svg
              width={LOCK_W}
              height={GATE_H}
              viewBox={`0 0 ${LOCK_W} ${GATE_H}`}
              fill="none"
              aria-hidden
              className="block text-foreground"
            >
              <defs>
                <pattern
                  id={`${hatchId}-lock`}
                  width="4"
                  height="4"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="2" height="4" fill="currentColor" opacity="0.85" />
                </pattern>
              </defs>
              {/* lock body, open at the bottom where the output port is */}
              <path
                d="M32.5 53.5 H0.5 V0.5 H87.5 V53.5 H55.5"
                className="stroke-border"
                strokeWidth="1"
              />
              {gates.map((g, i) => {
                const filled = arrivedRef.current.has(g.id);
                const overridden = overriddenRef.current.has(g.id);
                return (
                  <rect
                    key={g.id}
                    data-lock-slot={g.id}
                    data-filled={filled ? "true" : "false"}
                    x={slotXs[i] - 3.5}
                    y="8"
                    width="7"
                    height="12"
                    fill={
                      filled
                        ? overridden
                          ? `url(#${hatchId}-lock)`
                          : "currentColor"
                        : "none"
                    }
                    className={filled ? "stroke-foreground" : "stroke-border"}
                    strokeWidth="1"
                  />
                );
              })}
              {/* the bolt: shut across the output port until every key is in */}
              <rect
                data-interlock-bolt
                data-retracted={released ? "true" : "false"}
                className="ns-ilk-bolt fill-current"
                x="33"
                y="44"
                width="22"
                height="6"
                rx="1"
                style={{
                  transform: released ? "translateX(20px)" : "translateX(0)",
                }}
              />
            </svg>
          </span>
          <span className="mt-2 block font-mono text-[9px] leading-none text-muted">
            release lock
          </span>
        </div>

        {/* ---- key travel overlay --------------------------------------- */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {flights.length > 0 ? (
            <svg className="absolute inset-0 h-full w-full" fill="none">
              {flights.map((f) => (
                <line
                  key={f.id}
                  x1={f.x0 + 4}
                  y1={f.y0 + 4}
                  x2={f.x1 + 4}
                  y2={f.y1 + 4}
                  className="stroke-border"
                  strokeWidth="1"
                />
              ))}
            </svg>
          ) : null}
          {flights.map((f) => (
            <svg
              key={f.id}
              width="8"
              height="26"
              viewBox="0 0 8 26"
              fill="none"
              className="ns-ilk-fly absolute left-0 top-0 text-foreground"
              style={{
                transform: f.moved
                  ? `translate(${f.x1}px, ${f.y1}px)`
                  : `translate(${f.x0}px, ${f.y0}px)`,
              }}
            >
              <defs>
                <pattern
                  id={`${hatchId}-fly-${f.id}`}
                  width="4"
                  height="4"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="2" height="4" fill="currentColor" opacity="0.85" />
                </pattern>
              </defs>
              <KeyGlyph
                hatch={f.hatched}
                patternId={`${hatchId}-fly-${f.id}`}
              />
            </svg>
          ))}
        </div>
      </div>

      {/* ---- detail strip ------------------------------------------------ */}
      <div
        id={`${uid}-strip`}
        className="ns-ilk-strip mt-4 h-[16px] font-mono text-[11px] leading-[16px] text-muted"
        style={{
          opacity: active ? 1 : 0,
          transform: active ? "translateY(0)" : "translateY(-2px)",
        }}
      >
        {active ? (
          <>
            <span className="text-foreground">{active.id}</span>
            <span className="px-1.5">·</span>
            {active.detail ?? stateWord(active, overriddenRef.current.has(active.id))}
          </>
        ) : null}
      </div>

      {/* ---- override controls ------------------------------------------- */}
      {tripped.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tripped.map((g) => (
            <button
              key={g.id}
              type="button"
              data-override={g.id}
              onClick={() => override(g)}
              className="rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              override {g.id}
            </button>
          ))}
        </div>
      ) : null}

      {/* ---- the held output --------------------------------------------- */}
      <div className="relative mt-5">
        <div
          className="ns-ilk-veil rounded-md border border-border bg-surface p-4"
          style={{ opacity: released ? 1 : 0.35 }}
        >
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            model output
          </p>
          <p className="text-sm leading-relaxed text-foreground">{output}</p>
        </div>
        <div
          aria-hidden
          className="ns-ilk-veil pointer-events-none absolute inset-0 rounded-md"
          style={{
            opacity: released ? 0 : 1,
            backgroundImage:
              "repeating-linear-gradient(45deg, color-mix(in srgb, var(--foreground) 8%, transparent) 0 1px, transparent 1px 4px)",
          }}
        />
      </div>

      {/* ---- permanent audit trail --------------------------------------- */}
      {audit.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            audit
          </p>
          {/* exactly three 17px lines + two 4px gaps — a partial clipped line
              would read as a rendering bug rather than a scroll affordance */}
          <ul className="max-h-[59px] space-y-1 overflow-y-auto">
            {audit.map((line, i) => (
              <li
                key={i}
                data-audit-line
                className="font-mono text-[11px] text-foreground"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
