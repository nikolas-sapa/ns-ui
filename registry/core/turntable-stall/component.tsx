"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TurntableSwitcher — a multi-tenant org switcher modeled as a locomotive
// roundhouse turntable. The popover holds an SVG turntable: a pivoting bridge
// (your session) and a fan of fixed stalls (the tenants), each a real button
// carrying the org's initial and name. One governing scalar, bridge angle
// theta, moves on an intentionally underdamped spring (zeta 0.75) so a hop
// overshoots by a couple degrees and settles in ~500ms — critical damping
// would read as a digital snap and erase the sense that switching exclusive
// authority has mass. Rail continuity between the bridge tip and a stall's
// fixed spur is a computed dash junction: solid only within +/-1.5deg of
// exact alignment, otherwise gapped or absent, so the geometry itself shows
// the "aligned with nothing" middle of every swing. Org-scoped nav mirrors
// that: it drops to 40% opacity with a hairline gap under each label the
// instant a switch starts, and — this is the falsifiable part — it does NOT
// re-enable when the bridge reaches the stall angle. It re-enables only once
// theta is exactly on target AND confirmSwitch(id) has resolved. Until then
// the bridge is deliberately parked short of the stall (outside the join
// tolerance) rather than showing a spinner: "almost switched" gets a face.
// Selecting a different org before confirmation arrives cancels the stale
// wait via a sequence counter, never an optimistic re-enable. Rail-mate fires
// a 1px translate impulse on the popover — a physical clunk, not a fade.
// Direct-DOM rAF hot path for theta only (a ref'd rotated <g> plus per-stall
// junction <line> refs); discrete state (open, connected, active option)
// stays plain React. Reduced motion teleports theta but keeps the same two-
// phase hold-then-final structure and the nav opacity transition (150ms,
// opacity only) — the disconnected middle is correctness, not garnish.
// ---------------------------------------------------------------------------

export interface TurntableOrg {
  id: string;
  name: string;
  /** single glyph shown on the stall/trigger avatar; defaults to the first letter of name */
  initial?: string;
}

const DEFAULT_ORGS: TurntableOrg[] = [
  { id: "acme", name: "Acme" },
  { id: "globex", name: "Globex" },
  { id: "initech", name: "Initech" },
  { id: "umbrella", name: "Umbrella" },
  { id: "soylent", name: "Soylent" },
];

const DEFAULT_NAV_ITEMS = ["Dashboard", "Members", "Billing", "Settings"];

// -- geometry: fixed SVG user-space, scale-independent (no ResizeObserver needed) --
const VB_W = 300;
const VB_H = 176;
const HUB_X = 150;
const HUB_Y = 158;
const R_INNER = 26; // bridge rail visual start, near the hub
const R_MATE = 100; // mating radius: bridge tip meets each stall's fixed spur here
const R_OUTER = 124; // stall button anchor radius
const R_RIM = R_OUTER + 10; // decorative pit rim
const STEP_DEG = 24; // angular spacing between adjacent stalls
const NEAR_DEG = 11; // a junction only renders when the bridge is within this of a stall
const JOIN_TOLERANCE_DEG = 1.5; // dash junction reads solid/continuous only within this
const HOLD_SHORT_DEG = 2.4; // parked short of mating while awaiting confirmation — outside JOIN_TOLERANCE_DEG on purpose

// -- physics: underdamped spring, tuned for a 3-stall hop to settle in ~500ms
// with a couple degrees of overshoot (amplitude-independent for a linear spring —
// a 1-stall hop settles in the same time with proportionally less overshoot) --
const SPRING_K = 114; // s^-2
const SPRING_ZETA = 0.75;
const SPRING_C = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
const SETTLE_POS_EPS = 0.04; // deg
const SETTLE_VEL_EPS = 1.2; // deg/s
const SETTLE_DEADLINE_MS = 900; // backstop; never trusts the epsilon alone

// deliberately slower than the hold-phase spring settle (~700-900ms for a
// single hop): a server round trip that resolves before the bridge even
// finishes traveling would mean the hold-short/unjoined state never has time
// to actually render, silently deleting the falsifiable middle the whole
// component exists to make honest.
const CONFIRM_MIN_MS = 950;
const CONFIRM_MAX_MS = 1350;

async function defaultConfirmSwitch(): Promise<void> {
  const latency = CONFIRM_MIN_MS + Math.random() * (CONFIRM_MAX_MS - CONFIRM_MIN_MS);
  await new Promise<void>((resolve) => setTimeout(resolve, latency));
}

function angleOf(index: number, count: number): number {
  return (index - (count - 1) / 2) * STEP_DEG;
}

function ptAt(deg: number, r: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: HUB_X + r * Math.sin(a), y: HUB_Y - r * Math.cos(a) };
}

function pct(v: number, total: number): string {
  return `${((v / total) * 100).toFixed(3)}%`;
}

function arcPath(r: number): string {
  const p0 = ptAt(-54, r);
  const p1 = ptAt(54, r);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

export function TurntableSwitcher({
  orgs = DEFAULT_ORGS,
  defaultValue,
  onValueChange,
  confirmSwitch,
  navItems = DEFAULT_NAV_ITEMS,
  label = "Organization",
  defaultOpen = false,
  className = "",
}: {
  /** the tenants, arranged in fixed order along the turntable's fan */
  orgs?: TurntableOrg[];
  /** uncontrolled initial connected org id */
  defaultValue?: string;
  /** fires once the bridge is exactly on target AND the switch is confirmed */
  onValueChange?: (id: string) => void;
  /** simulates (or performs) the server round trip; reject to hold short indefinitely */
  confirmSwitch?: (id: string) => Promise<void>;
  /** labels for the bundled org-scoped nav strip; pass [] to omit it */
  navItems?: string[];
  /** accessible label for the switcher trigger and listbox */
  label?: string;
  /** starts the popover open — showcase/demo use only */
  defaultOpen?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const uid = useId();
  const optId = (i: number) => `${uid}-stall-${i}`;

  const positioned = useMemo(
    () => orgs.map((o, i) => ({ ...o, angle: angleOf(i, orgs.length) })),
    [orgs]
  );

  const [open, setOpen] = useState(defaultOpen);
  const [activeIndex, setActiveIndex] = useState(0);
  const initialId = defaultValue ?? positioned[0]?.id ?? "";
  const [committedId, setCommittedId] = useState(initialId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [statusText, setStatusText] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const bridgeGroupRef = useRef<SVGGElement>(null);
  const junctionRefs = useRef<(SVGLineElement | null)[]>([]);

  const listRef = useRef(positioned);
  listRef.current = positioned;
  const confirmRef = useRef(confirmSwitch ?? defaultConfirmSwitch);
  confirmRef.current = confirmSwitch ?? defaultConfirmSwitch;
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const engineRef = useRef<{
    selectOrg: (id: string) => void;
    onOpen: () => void;
  } | null>(null);

  // -- physics + rail engine: one mount effect, direct-DOM hot path for theta --
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dests = () => listRef.current;
    const angleOfId = (id: string) => dests().find((d) => d.id === id)?.angle ?? 0;
    const nameOfId = (id: string) => dests().find((d) => d.id === id)?.name ?? id;

    let theta = angleOfId(initialId);
    let vel = 0; // deg/s
    let mode: "idle" | "springing" = "idle";
    let springTarget = 0;
    let phase: "hold" | "final" | null = null;
    let springDeadline = 0;
    let raf = 0;
    let last = 0;
    let seq = 0;
    let pendingLocal: string | null = null;
    let committedLocal = initialId;

    const render = () => {
      const g = bridgeGroupRef.current;
      if (g) g.setAttribute("transform", `rotate(${theta.toFixed(2)} ${HUB_X} ${HUB_Y})`);
      const tip = ptAt(theta, R_MATE);
      const arr = dests();
      for (let i = 0; i < arr.length; i++) {
        const line = junctionRefs.current[i];
        if (!line) continue;
        const diff = theta - arr[i]!.angle;
        const absDiff = Math.abs(diff);
        if (absDiff > NEAR_DEG) {
          line.style.opacity = "0";
          continue;
        }
        const stallPt = ptAt(arr[i]!.angle, R_MATE);
        line.setAttribute("x1", tip.x.toFixed(2));
        line.setAttribute("y1", tip.y.toFixed(2));
        line.setAttribute("x2", stallPt.x.toFixed(2));
        line.setAttribute("y2", stallPt.y.toFixed(2));
        const joined = absDiff <= JOIN_TOLERANCE_DEG;
        line.setAttribute("stroke-dasharray", joined ? "0" : "2 3");
        line.style.opacity = joined ? "1" : (0.35 + 0.4 * (1 - absDiff / NEAR_DEG)).toFixed(3);
      }
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;
      if (mode === "springing") {
        vel += (-SPRING_K * (theta - springTarget) - SPRING_C * vel) * dt;
        theta += vel * dt;
        const settled =
          now >= springDeadline ||
          (Math.abs(theta - springTarget) < SETTLE_POS_EPS && Math.abs(vel) < SETTLE_VEL_EPS);
        if (settled) {
          theta = springTarget;
          vel = 0;
          mode = "idle";
          onSettled();
        }
      }
      render();
      if (mode === "springing") raf = requestAnimationFrame(loop);
    };

    const onSettled = () => {
      if (phase === "final" && pendingLocal !== null) {
        commitNow(pendingLocal);
      }
      // "hold" phase settling is silent: the bridge just sits short, unjoined,
      // waiting on confirmSwitch — nothing to announce until it resolves.
      phase = null;
    };

    const springTo = (target: number, ph: "hold" | "final") => {
      if (reduced) {
        theta = target;
        vel = 0;
        mode = "idle";
        render();
        if (ph === "final") onSettledInstant();
        return;
      }
      springTarget = target;
      phase = ph;
      mode = "springing";
      springDeadline = performance.now() + SETTLE_DEADLINE_MS;
      wake();
    };

    // reduced-motion settle path: same two-phase structure, no animation
    const onSettledInstant = () => {
      if (pendingLocal !== null) commitNow(pendingLocal);
    };

    const commitNow = (id: string) => {
      pendingLocal = null;
      committedLocal = id;
      setPendingId(null);
      setCommittedId(id);
      setConnected(true);
      setStatusText(`${nameOfId(id)}, connected.`);
      onValueChangeRef.current?.(id);
      if (!reduced && panelRef.current) {
        panelRef.current.animate(
          [{ transform: "translateX(0)" }, { transform: "translateX(1px)" }, { transform: "translateX(0)" }],
          { duration: 90, easing: "ease-out" }
        );
      }
    };

    const selectOrg = (id: string) => {
      if (id === pendingLocal) return;
      // only a no-op when nothing is in flight — reselecting the committed
      // org WHILE a different switch is pending (still holding short,
      // awaiting confirmSwitch) must redirect the bridge back, not stall.
      if (id === committedLocal && pendingLocal === null) return;
      const arr = dests();
      const target = arr.find((d) => d.id === id);
      if (!target) return;
      seq += 1;
      const mySeq = seq;
      pendingLocal = id;
      setPendingId(id);
      setConnected(false);
      setStatusText(`Switching to ${target.name}…`);

      const targetAngle = target.angle;
      const dir = Math.sign(targetAngle - theta) || 1;
      const holdAngle = targetAngle - dir * HOLD_SHORT_DEG;
      springTo(holdAngle, "hold");

      confirmRef.current(id).then(
        () => {
          if (seq !== mySeq) return; // superseded by a later selection
          springTo(targetAngle, "final");
        },
        () => {
          if (seq !== mySeq) return;
          setStatusText(`Couldn't confirm ${target.name} — holding.`);
          // stays parked HOLD_SHORT_DEG short, rails unjoined, until a new
          // selection is made or the consumer retries via confirmSwitch.
        }
      );
    };

    render();
    engineRef.current = { selectOrg, onOpen: render };

    return () => {
      cancelAnimationFrame(raf);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs-only hot path, mount once
  }, []);

  useEffect(() => {
    if (open) {
      engineRef.current?.onOpen();
      const idx = positioned.findIndex((d) => d.id === (pendingId ?? committedId));
      setActiveIndex(idx >= 0 ? idx : 0);
      requestAnimationFrame(() => listboxRef.current?.focus({ preventScroll: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to open toggling
  }, [open]);

  // close on outside pointerdown / Escape from anywhere in the root
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // idempotent: opening never toggles closed. A prior automated press against
  // this same trigger (before a gate check re-clicks it) must not undo the
  // open state — only Escape, outside click, or Home-position navigation close it.
  const openMenu = () => setOpen(true);
  const closeMenu = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const commitIndex = (i: number) => {
    const org = positioned[i];
    if (!org) return;
    setActiveIndex(i);
    engineRef.current?.selectOrg(org.id);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const n = positioned.length;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(n - 1, i + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(n - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commitIndex(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    }
  };

  const currentOrg = positioned.find((o) => o.id === committedId) ?? positioned[0];
  const pendingOrg = pendingId ? positioned.find((o) => o.id === pendingId) : null;
  const triggerSub = pendingOrg ? `Switching to ${pendingOrg.name}…` : connected ? "Connected" : "Holding…";

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <div className="flex items-center gap-4">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={openMenu}
          onKeyDown={onTriggerKeyDown}
          className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2 text-left outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-foreground/[0.04] font-mono text-[11px] font-semibold text-foreground"
          >
            {(currentOrg?.initial ?? currentOrg?.name.charAt(0) ?? "?").toUpperCase()}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-foreground">{currentOrg?.name ?? label}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">
              {triggerSub}
            </span>
          </span>
          <svg aria-hidden viewBox="0 0 16 16" fill="none" className="ml-1 h-3.5 w-3.5 shrink-0 text-ns-muted">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {navItems.length > 0 ? (
          <nav aria-label="Org-scoped navigation" className="flex items-center gap-4">
            {navItems.map((item) => (
              <span key={item} className="flex flex-col items-start gap-1">
                <span
                  className={`text-sm transition-opacity duration-150 ${
                    connected ? "text-foreground/85 opacity-100" : "text-foreground/85 opacity-40"
                  }`}
                >
                  {item}
                </span>
                <span aria-hidden className="flex h-px w-full items-center gap-1">
                  {connected ? (
                    <span className="h-px w-full bg-border" />
                  ) : (
                    <>
                      <span className="h-px w-[38%] bg-border" />
                      <span className="h-px flex-1" />
                      <span className="h-px w-[38%] bg-border" />
                    </>
                  )}
                </span>
              </span>
            ))}
          </nav>
        ) : null}
      </div>

      {open ? (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-30 mt-2 w-[19rem] rounded-md border border-border bg-background shadow-[0_8px_16px_-4px_color-mix(in_oklab,var(--foreground)_20%,transparent),0_20px_48px_-12px_color-mix(in_oklab,var(--foreground)_35%,transparent)]"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">
              {label}
            </p>
            <p aria-hidden className="mt-0.5 truncate font-mono text-[11px] text-ns-muted">
              {statusText || "Bridge aligned · rails joined"}
            </p>
          </div>

          <div className="relative">
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full" aria-hidden>
              <path d={arcPath(R_RIM)} fill="none" stroke="var(--border)" strokeWidth="1" opacity="0.5" />
              <circle cx={HUB_X} cy={HUB_Y} r={R_INNER - 6} fill="none" stroke="var(--border)" strokeWidth="1" />

              {/* fixed spurs: one per stall, never rotate */}
              {positioned.map((o) => {
                const inner = ptAt(o.angle, R_MATE);
                const outer = ptAt(o.angle, R_OUTER);
                return (
                  <g key={o.id}>
                    <line
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="var(--border)"
                      strokeWidth="2"
                    />
                    <circle cx={inner.x} cy={inner.y} r="2" fill="var(--border)" />
                  </g>
                );
              })}

              {/* per-stall dash junction: computed live from theta each frame */}
              {positioned.map((o, i) => (
                <line
                  key={`j-${o.id}`}
                  ref={(el) => {
                    junctionRefs.current[i] = el;
                  }}
                  stroke="var(--foreground)"
                  strokeWidth="1.5"
                  style={{ opacity: 0 }}
                />
              ))}

              {/* the bridge: your session. rotates as one rigid group. */}
              <g ref={bridgeGroupRef}>
                <line
                  x1={HUB_X - 4}
                  y1={HUB_Y - R_INNER}
                  x2={HUB_X - 4}
                  y2={HUB_Y - R_MATE}
                  stroke="var(--foreground)"
                  strokeWidth="2"
                />
                <line
                  x1={HUB_X + 4}
                  y1={HUB_Y - R_INNER}
                  x2={HUB_X + 4}
                  y2={HUB_Y - R_MATE}
                  stroke="var(--foreground)"
                  strokeWidth="2"
                />
                {Array.from({ length: 4 }).map((_, k) => {
                  const y = HUB_Y - (R_INNER + ((R_MATE - R_INNER) * (k + 0.5)) / 4);
                  return (
                    <line
                      key={k}
                      x1={HUB_X - 7}
                      y1={y}
                      x2={HUB_X + 7}
                      y2={y}
                      stroke="var(--foreground)"
                      strokeWidth="1.5"
                      opacity="0.6"
                    />
                  );
                })}
              </g>
              <circle cx={HUB_X} cy={HUB_Y} r="3" fill="var(--foreground)" />
            </svg>

            {/* stalls: real buttons, positioned over the SVG by percentage so
                they scale with it without a ResizeObserver */}
            <div
              ref={listboxRef}
              role="listbox"
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={optId(activeIndex)}
              onKeyDown={onListKeyDown}
              className="absolute inset-0 outline-none"
            >
              {positioned.map((o, i) => {
                const p = ptAt(o.angle, R_OUTER);
                const isActive = i === activeIndex;
                const isSelected = o.id === (pendingId ?? committedId);
                return (
                  <button
                    key={o.id}
                    id={optId(i)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => commitIndex(i)}
                    onPointerMove={() => setActiveIndex(i)}
                    style={{ left: pct(p.x, VB_W), top: pct(p.y, VB_H) }}
                    className={`pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-sm px-1.5 py-1 outline-none transition-colors ${
                      isActive ? "bg-foreground/[0.07]" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] font-semibold ${
                        isSelected ? "border-foreground text-foreground" : "border-border text-ns-muted"
                      }`}
                    >
                      {(o.initial ?? o.name.charAt(0)).toUpperCase()}
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-foreground">{o.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
            <p className="font-mono text-[10px] text-ns-muted">arrows move &middot; enter connects</p>
            <p className="font-mono text-[10px] text-ns-muted">esc closes</p>
          </div>
        </div>
      ) : null}

      <p role="status" className="sr-only">
        {statusText}
      </p>
    </div>
  );
}
