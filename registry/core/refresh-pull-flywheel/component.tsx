"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// FlywheelPull — pull-to-refresh as a crank and flywheel. Dragging the wheel
// zone down winds a spoked SVG wheel through a visible rack-and-pinion
// drivetrain, pull distance mapping 1:1 to wind-up angle. Releasing hands the
// wheel an angular velocity of pullDistance * a gain constant, integrated per
// rAF frame under low friction while the (real or simulated) refresh request
// is in flight — the loading state IS the gesture's energy bleeding off, not
// a canned spinner swap. When the response lands, friction jumps and the
// wheel decays to rest over ~400ms; new rows FLIP into the list at the same
// moment the wheel settles. A visible Refresh button is always the primary
// path; the drag is enhancement, and clicking it replays the same physics
// via a synthetic pull so the two paths feel like one mechanism. DOM+SVG+CSS
// only, no canvas, colors are CSS custom properties only.
// ---------------------------------------------------------------------------

const WIND_DEG_PER_PX = 1.05; // wind-up angle per px pulled
const MAX_PULL = 130; // px — beyond this, rubber-band resistance
const RUBBER = 0.32; // beyond-MAX_PULL displacement scale
const RELEASE_GAIN = 1.65; // deg/s of release velocity per px pulled
const FRICTION_FREE = 0.55; // s^-1 — low friction while request is in flight
const FRICTION_BRAKE = 10; // s^-1 — applied once the response arrives
const SLEEP_OMEGA = 3; // deg/s — below this, and braking, the wheel is at rest
const PULL_RETURN = 16; // s^-1 — rack/pinion spring back to 0 after release
const FORCE_SETTLE_MS = 6000; // safety deadline so physics never spins forever
const BUTTON_WIND_PX = 96; // synthetic pull distance for a click-only refresh
const MIN_LATENCY_MS = 900;
const MAX_LATENCY_MS = 1500;
const MAX_ITEMS = 14;
const ENTER_STAGGER_MS = 70;
const ENTER_DURATION_MS = 380;

const CX_WHEEL = 176;
const CY_WHEEL = 80;
const R_WHEEL = 54;
const CX_PINION = 86;
const CY_PINION = 80;
const R_PINION = 15;
const SPOKES = 8;
const RACK_X = 40;
const RACK_Y = 6;
const RACK_W = 30;
const RACK_H = 148;
const TOOTH_PITCH = 16;

export interface FlywheelPullItem {
  id: string;
  title: string;
  meta?: string;
}

export interface FlywheelPullProps {
  /** Initial feed rows, newest first. */
  defaultItems?: FlywheelPullItem[];
  /**
   * Called on release/refresh; resolve with the new rows to prepend. Omit to
   * use a built-in simulated request (900-1500ms) that manufactures rows —
   * fine for a demo, but a real feed should supply this.
   */
  onRefresh?: () => Promise<FlywheelPullItem[]>;
  /** Accessible label for the row list. */
  label?: string;
  className?: string;
}

const SAMPLE_TITLES = [
  "New comment on “Q3 roadmap”",
  "3 people starred your repo",
  "Deploy finished: prod-web-42",
  "Weekly digest is ready",
  "Mentioned you in #general",
  "New follower: @octavia",
  "Build failed on staging",
  "Invoice #4021 was paid",
  "2 reviewers approved your PR",
  "New device signed in",
];

let idCounter = 0;
function generateItems(n: number): FlywheelPullItem[] {
  const out: FlywheelPullItem[] = [];
  for (let i = 0; i < n; i++) {
    idCounter += 1;
    const title =
      SAMPLE_TITLES[Math.floor(Math.random() * SAMPLE_TITLES.length)] ??
      "Update";
    out.push({ id: `fw-${idCounter}`, title, meta: "just now" });
  }
  return out;
}

function simulateRefresh(): Promise<FlywheelPullItem[]> {
  const latency =
    MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  const count = 2 + Math.floor(Math.random() * 5); // 2..6
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(generateItems(count)), latency);
  });
}

type Phase = "idle" | "busy" | "done" | "error";

export function FlywheelPull({
  defaultItems,
  onRefresh,
  label = "Activity feed",
  className = "",
}: FlywheelPullProps) {
  const [items, setItems] = useState<FlywheelPullItem[]>(
    () => defaultItems ?? generateItems(5)
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveText, setLiveText] = useState("");
  const [enteringOrder, setEnteringOrder] = useState<string[]>([]);

  const zoneRef = useRef<HTMLDivElement>(null);
  const wheelGroupRef = useRef<SVGGElement>(null);
  const pinionGroupRef = useRef<SVGGElement>(null);
  const rackTeethRef = useRef<SVGGElement>(null);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  const reducedRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const captureRects = useCallback(() => {
    const map = new Map<string, DOMRect>();
    rowRefs.current.forEach((el, id) => {
      map.set(id, el.getBoundingClientRect());
    });
    prevRectsRef.current = map;
  }, []);

  // single place that turns a settled request into visible feed state —
  // called from the physics loop (in flight), the reduced-motion pointer
  // path, and the reduced-motion button path alike.
  const applyResult = useCallback(
    (result: FlywheelPullItem[] | null, failed: boolean) => {
      if (failed || !result) {
        setPhase("error");
        setLiveText("Refresh failed, wheel at rest.");
        window.setTimeout(() => setPhase("idle"), 1600);
        return;
      }
      captureRects();
      setItems((prev) => [...result, ...prev].slice(0, MAX_ITEMS));
      const ids = result.map((r) => r.id);
      setEnteringOrder(ids);
      setPhase("done");
      setLiveText(
        `Updated, ${result.length} new item${result.length === 1 ? "" : "s"}`
      );
      window.setTimeout(
        () => {
          setEnteringOrder((cur) => cur.filter((id) => !ids.includes(id)));
        },
        ENTER_DURATION_MS + ids.length * ENTER_STAGGER_MS + 60
      );
    },
    [captureRects]
  );
  const applyResultRef = useRef(applyResult);
  applyResultRef.current = applyResult;
  // every refresh (drag release or button) bumps this; a resolving request
  // only commits if it's still the most recent one — clicking Refresh again
  // mid-flight restarts the wheel instead of queuing a second, stale commit.
  const genRef = useRef(0);

  useLayoutEffect(() => {
    if (reducedRef.current) return;
    const prev = prevRectsRef.current;
    rowRefs.current.forEach((el, id) => {
      const before = prev.get(id);
      if (!before) return;
      const after = el.getBoundingClientRect();
      const dy = before.top - after.top;
      if (Math.abs(dy) < 0.5) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 420ms cubic-bezier(.22,1,.36,1)";
        el.style.transform = "";
      });
    });
  }, [items]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    reducedRef.current = reduced;

    // hot-path physics state — plain locals, no React state per frame
    let angle = 0;
    let pull = 0;
    let v = 0; // deg/s
    let braking = false;
    let raf = 0;
    let last = 0;
    let deadline = 0;
    let dragging = false;
    let pointerId = -1;
    let startY = 0;
    let baseAngle = 0;
    let pendingResolve: (() => void) | null = null;

    const writeTransforms = (a: number, p: number) => {
      wheelGroupRef.current?.setAttribute(
        "transform",
        `rotate(${a.toFixed(2)} ${CX_WHEEL} ${CY_WHEEL})`
      );
      pinionGroupRef.current?.setAttribute(
        "transform",
        `rotate(${a.toFixed(2)} ${CX_PINION} ${CY_PINION})`
      );
      rackTeethRef.current?.setAttribute(
        "transform",
        `translate(0 ${p.toFixed(2)})`
      );
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;

      const friction = braking ? FRICTION_BRAKE : FRICTION_FREE;
      v *= Math.exp(-friction * dt);
      angle += v * dt;
      pull = pull > 0.02 ? pull * Math.exp(-PULL_RETURN * dt) : 0;
      writeTransforms(angle, pull);

      const settleReady = braking && Math.abs(v) < SLEEP_OMEGA;
      const forceSettle = now > deadline;
      if (settleReady || forceSettle) {
        v = 0;
        pull = 0;
        writeTransforms(angle, 0);
        const resolve = pendingResolve;
        pendingResolve = null;
        resolve?.();
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const startFlight = (releaseVelocity: number) => {
      v = releaseVelocity;
      braking = false;
      pendingResolve = null;
      deadline = performance.now() + FORCE_SETTLE_MS;
      setPhase("busy");
      setLiveText("Refreshing…");
      last = 0;
      raf = requestAnimationFrame(loop);

      const myGen = ++genRef.current;
      const req = onRefreshRef.current
        ? onRefreshRef.current()
        : simulateRefresh();

      const finish = (result: FlywheelPullItem[] | null, failed: boolean) => {
        if (myGen !== genRef.current) return; // superseded by a later refresh
        // response arrived — raise friction, wait for the loop to actually
        // settle, then commit rows exactly as the wheel comes to rest.
        braking = true;
        pendingResolve = () => applyResultRef.current(result, failed);
      };
      req.then(
        (result) => finish(result, false),
        () => finish(null, true)
      );
    };

    const springBackIdle = () => {
      last = 0;
      const idleLoop = (now: number) => {
        raf = 0;
        const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
        last = now;
        pull *= Math.exp(-PULL_RETURN * dt);
        writeTransforms(angle, pull);
        if (pull > 0.05) raf = requestAnimationFrame(idleLoop);
        else {
          pull = 0;
          writeTransforms(angle, 0);
        }
      };
      raf = requestAnimationFrame(idleLoop);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // grabs the wheel even mid-freewheel/mid-brake — catching it and
      // winding again always wins over whatever was already in flight; a
      // stale response is dropped by the genRef check in `finish`.
      dragging = true;
      pointerId = e.pointerId;
      startY = e.clientY;
      baseAngle = angle;
      pull = 0;
      v = 0;
      braking = false;
      pendingResolve = null;
      // a grab always supersedes whatever request was in flight — otherwise a
      // late response with no loop left to resolve it (e.g. grab then release
      // under the 4px threshold, no re-flight started) would strand `phase`
      // on "busy" forever. Reset unconditionally (React bails out a same-value
      // set) rather than reading `phase`, which is stale in this mount-once
      // closure.
      genRef.current++;
      setPhase("idle");
      zone.style.cursor = "grabbing";
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic or already-gone pointer */
      }
      cancelAnimationFrame(raf);
      raf = 0;
      if (!reduced) writeTransforms(angle, 0);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const rawDy = e.clientY - startY;
      const dy = rawDy < 0 ? 0 : rawDy;
      pull = dy <= MAX_PULL ? dy : MAX_PULL + (dy - MAX_PULL) * RUBBER;
      if (reduced) return;
      angle = baseAngle + pull * WIND_DEG_PER_PX;
      writeTransforms(angle, pull);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      zone.style.cursor = "";
      if (!dragging) return;
      dragging = false;
      pointerId = -1;
      const finalPull = pull;

      if (reduced) {
        if (finalPull >= 4) {
          setPhase("busy");
          setLiveText("Refreshing…");
          const myGen = ++genRef.current;
          const req = onRefreshRef.current
            ? onRefreshRef.current()
            : simulateRefresh();
          req.then(
            (result) => {
              if (myGen === genRef.current) applyResultRef.current(result, false);
            },
            () => {
              if (myGen === genRef.current) applyResultRef.current(null, true);
            }
          );
        }
        pull = 0;
        return;
      }

      if (finalPull < 4) {
        springBackIdle();
        return;
      }
      startFlight(finalPull * RELEASE_GAIN);
    };

    const onPointerCancel = (e: PointerEvent) => onPointerUp(e);

    zone.addEventListener("pointerdown", onPointerDown);
    zone.addEventListener("pointermove", onPointerMove);
    zone.addEventListener("pointerup", onPointerUp);
    zone.addEventListener("pointercancel", onPointerCancel);

    return () => {
      cancelAnimationFrame(raf);
      zone.removeEventListener("pointerdown", onPointerDown);
      zone.removeEventListener("pointermove", onPointerMove);
      zone.removeEventListener("pointerup", onPointerUp);
      zone.removeEventListener("pointercancel", onPointerCancel);
    };
  }, []);

  const handleButtonRefresh = useCallback(() => {
    // always restarts the cycle, even mid-flight — a second press is a
    // fresh yank on the crank, not a no-op; see genRef in the physics effect.
    if (reducedRef.current) {
      setPhase("busy");
      setLiveText("Refreshing…");
      const myGen = ++genRef.current;
      const req = onRefreshRef.current
        ? onRefreshRef.current()
        : simulateRefresh();
      req.then(
        (result) => {
          if (myGen === genRef.current) applyResultRef.current(result, false);
        },
        () => {
          if (myGen === genRef.current) applyResultRef.current(null, true);
        }
      );
      return;
    }

    // dispatch a synthetic pull onto the drag zone so a plain click runs the
    // exact same wind -> release -> freewheel -> brake physics as a real drag.
    const zone = zoneRef.current;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const top = rect.top + 8;
    const pid = -999;
    const opts = { pointerId: pid, clientX: cx, button: 0, bubbles: true };
    zone.dispatchEvent(new PointerEvent("pointerdown", { ...opts, clientY: top }));
    zone.dispatchEvent(
      new PointerEvent("pointermove", { ...opts, clientY: top + BUTTON_WIND_PX })
    );
    zone.dispatchEvent(
      new PointerEvent("pointerup", { ...opts, clientY: top + BUTTON_WIND_PX })
    );
  }, []);

  const busy = phase === "busy";
  const statusText =
    phase === "idle" ? "Pull the wheel down, or press Refresh." : liveText;

  return (
    <div
      className={`w-full max-w-md rounded-md border border-border bg-background ${className}`}
    >
      <div
        ref={zoneRef}
        role="presentation"
        aria-hidden="true"
        className="flex touch-none select-none items-center justify-center py-3"
        style={{ cursor: "grab" }}
      >
        <svg
          viewBox="0 0 240 160"
          width="180"
          height="120"
          className="max-w-full"
        >
          <defs>
            <clipPath id="fw-rack-clip">
              <rect x={RACK_X} y={RACK_Y} width={RACK_W} height={RACK_H} />
            </clipPath>
          </defs>

          {/* rack — vertical bar; teeth slide behind the window as you pull */}
          <rect
            x={RACK_X}
            y={RACK_Y}
            width={RACK_W}
            height={RACK_H}
            rx={3}
            fill="none"
            stroke="var(--border)"
            strokeWidth={2}
          />
          <g clipPath="url(#fw-rack-clip)">
            <g ref={rackTeethRef}>
              {Array.from({ length: 14 }, (_, i) => (
                <rect
                  key={i}
                  x={RACK_X + 2}
                  y={RACK_Y - TOOTH_PITCH * 3 + i * TOOTH_PITCH}
                  width={RACK_W - 8}
                  height={5}
                  fill="var(--border)"
                />
              ))}
            </g>
          </g>

          {/* pinion — small gear meshed with the rack, shares the drive angle */}
          <g ref={pinionGroupRef}>
            <circle
              cx={CX_PINION}
              cy={CY_PINION}
              r={R_PINION}
              fill="var(--background)"
              stroke="var(--border)"
              strokeWidth={2}
            />
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * 360) / 8;
              const rad = (a * Math.PI) / 180;
              const x1 = CX_PINION + Math.cos(rad) * (R_PINION - 1);
              const y1 = CY_PINION + Math.sin(rad) * (R_PINION - 1);
              const x2 = CX_PINION + Math.cos(rad) * (R_PINION + 4);
              const y2 = CY_PINION + Math.sin(rad) * (R_PINION + 4);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="var(--border)"
                  strokeWidth={2}
                />
              );
            })}
          </g>

          {/* shaft — couples pinion and wheel onto one drive axle */}
          <line
            x1={CX_PINION + R_PINION + 4}
            y1={CY_PINION}
            x2={CX_WHEEL - R_WHEEL + 6}
            y2={CY_WHEEL}
            stroke="var(--border)"
            strokeWidth={2}
            strokeDasharray="2 5"
          />

          {/* flywheel — spokes in --border, one index spoke in --foreground */}
          <g ref={wheelGroupRef}>
            <circle
              cx={CX_WHEEL}
              cy={CY_WHEEL}
              r={R_WHEEL}
              fill="none"
              stroke="var(--border)"
              strokeWidth={3}
            />
            {Array.from({ length: SPOKES }, (_, i) => {
              const a = (i * 360) / SPOKES;
              const rad = (a * Math.PI) / 180;
              const inner = 10;
              const outer = R_WHEEL - 5;
              const x1 = CX_WHEEL + Math.cos(rad) * inner;
              const y1 = CY_WHEEL + Math.sin(rad) * inner;
              const x2 = CX_WHEEL + Math.cos(rad) * outer;
              const y2 = CY_WHEEL + Math.sin(rad) * outer;
              const isIndex = i === 0;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isIndex ? "var(--foreground)" : "var(--border)"}
                  strokeWidth={isIndex ? 4 : 2.5}
                  strokeLinecap="round"
                />
              );
            })}
            <circle
              cx={CX_WHEEL}
              cy={CY_WHEEL - (R_WHEEL - 5)}
              r={3}
              fill="var(--foreground)"
            />
            <circle
              cx={CX_WHEEL}
              cy={CY_WHEEL}
              r={9}
              fill="var(--background)"
              stroke="var(--border)"
              strokeWidth={2}
            />
          </g>
        </svg>
      </div>

      <div className="flex items-center gap-3 border-t border-b border-border px-4 py-3">
        <button
          type="button"
          data-flywheel-refresh
          onClick={handleButtonRefresh}
          className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            className={busy ? "motion-safe:animate-spin" : ""}
            style={{ animationDuration: "900ms" }}
          >
            <path
              d="M13.5 8a5.5 5.5 0 1 1-1.65-3.93M13.5 2v3.5H10"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {busy ? "Refreshing…" : "Refresh"}
        </button>
        <p
          data-flywheel-status={phase}
          className="min-w-0 flex-1 truncate font-mono text-xs text-ns-muted"
        >
          {statusText}
        </p>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {liveText}
      </div>

      <ul
        aria-label={label}
        aria-busy={busy}
        className="max-h-72 divide-y divide-border overflow-y-auto"
      >
        {items.map((item) => {
          const entering = !reducedRef.current && enteringOrder.includes(item.id);
          return (
            <li
              key={item.id}
              ref={(el) => {
                if (el) rowRefs.current.set(item.id, el);
                else rowRefs.current.delete(item.id);
              }}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                entering ? "ns-fw-enter" : ""
              }`}
              style={
                entering
                  ? { animationDelay: `${enteringOrder.indexOf(item.id) * ENTER_STAGGER_MS}ms` }
                  : undefined
              }
            >
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {item.title}
              </span>
              {item.meta && (
                <span className="shrink-0 font-mono text-xs text-ns-muted">
                  {item.meta}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <style>{`
        @keyframes ns-fw-enter {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ns-fw-enter {
          animation: ns-fw-enter ${ENTER_DURATION_MS}ms cubic-bezier(.22,1,.36,1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-fw-enter { animation: none; }
        }
      `}</style>
    </div>
  );
}
