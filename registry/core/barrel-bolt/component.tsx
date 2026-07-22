"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// BarrelBolt — tool-permission consent as a sliding barrel bolt. Scope is
// encoded as TRAVEL, not as three same-looking buttons: Once sits at a short
// drag, Always sits at a proportionally longer one, and pointer drag runs
// through a friction field that gets heavier past the halfway catch (the
// widening gap plus the added resistance mean reaching Always takes roughly
// 3x the deliberate pointer travel of reaching Once — a longer, harder act
// for a bigger grant). Snapping to a catch is a short underdamped spring
// (~1px overshoot); Always additionally seats 3px further into a drawn
// keeper outline. A grant commits automatically 150ms after the handle
// settles from a real drag-release, or immediately on Enter — arrow keys
// only move the focused value, they never grant on their own. Deny lives
// outside the track as a plain button: refusal is never a slider position
// you could overshoot into. Direct-DOM rAF on the hot path (drag + spring),
// React state only for the three discrete positions and the terminal
// decision. All ink is token-relative CSS — no canvas.
// ---------------------------------------------------------------------------

const HANDLE_D = 24; // px, the drag handle's diameter
const PAD = 12; // px inset so catches clear the rail's rounded corners
const FRACTIONS = [0, 0.4, 1] as const; // catch positions across the travel range — the widening gap IS the "proportionally more travel" curve
const FRICTION_LOW = 1; // once -> session: baseline resistance
const FRICTION_HIGH = 0.7; // session -> always: heavier — needs more raw pointer travel per logical px
const FRICTION_RUBBER = 0.3; // beyond either end
const MAX_OVER = 14; // px, rubber-band travel cap past the first/last catch
const SEAT = 3; // px the handle seats past the Always catch, into the keeper
const RELEASE_K = 340; // release-to-catch spring, s^-2
const RELEASE_ZETA = 0.82; // tuned so a step response overshoots ~1px regardless of distance
const GLIDE_K = 260; // keyboard glide spring — no overshoot, friction never applies to keys
const GLIDE_ZETA = 1;
const EPS_X = 0.25; // px
const EPS_V = 6; // px/s
const FORCE_SETTLE_MS = 700; // physics never jitters forever
const GRANT_GRACE_MS = 150; // commit fires this long after a drag-release settles

export type BarrelBoltScope = "once" | "session" | "always";

const SCOPES: BarrelBoltScope[] = ["once", "session", "always"];

const SCOPE_LABEL: Record<BarrelBoltScope, string> = {
  once: "Once",
  session: "This session",
  always: "Always",
};

const VALUE_TEXT: Record<BarrelBoltScope, string> = {
  once: "Allow once",
  session: "Allow this session",
  always: "Always allow",
};

const SUBLABEL: Record<BarrelBoltScope, string> = {
  once: "Will ask again next time.",
  session: "Remembered for this session.",
  always: "Always allowed — won't ask again.",
};

export interface BarrelBoltDecision {
  outcome: "granted" | "denied";
  scope?: BarrelBoltScope;
}

export function BarrelBolt({
  capability = "run this command",
  context,
  defaultValue = "once",
  onDecide,
  className = "",
}: {
  /** plain-language capability being requested, e.g. "run shell command" */
  capability?: string;
  /** optional secondary line, e.g. "requested by build-agent" */
  context?: string;
  defaultValue?: BarrelBoltScope;
  /** fires exactly once — a real grant/deny, never on plain arrow-key navigation */
  onDecide?: (decision: BarrelBoltDecision) => void;
  className?: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const keeperRef = useRef<HTMLSpanElement>(null);
  const notchRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const engineRef = useRef<{
    glideTo: (index: number) => void;
    commitNow: (index: number) => void;
  } | null>(null);

  const defaultIndex = Math.max(0, SCOPES.indexOf(defaultValue));
  const [liveIndex, setLiveIndex] = useState(defaultIndex);
  const [decision, setDecision] = useState<null | "granted" | "denied">(null);
  const [grantedScope, setGrantedScope] = useState<BarrelBoltScope | null>(
    null
  );

  const decisionRef = useRef(decision);
  decisionRef.current = decision;
  const liveIndexRef = useRef(liveIndex);
  liveIndexRef.current = liveIndex;
  const onDecideRef = useRef(onDecide);
  onDecideRef.current = onDecide;

  // latest-closure commit, callable from the imperative engine below without
  // the effect needing decision/onDecide in its dependency array
  const grantRef = useRef((_index: number) => {});
  grantRef.current = (index: number) => {
    if (decisionRef.current) return;
    const scope = SCOPES[index];
    setDecision("granted");
    setGrantedScope(scope);
    onDecideRef.current?.({ outcome: "granted", scope });
  };

  const handleDeny = () => {
    // idempotent on purpose: a repeat click (e.g. a prior automated press)
    // must stay a harmless no-op rather than error or double-fire
    if (decisionRef.current) return;
    setDecision("denied");
    onDecideRef.current?.({ outcome: "denied" });
  };

  useEffect(() => {
    const rail = railRef.current;
    const handle = handleRef.current;
    if (!rail || !handle) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let catchX: number[] = [0, 0, 0];
    let sized = false;
    let x = 0;
    let v = 0;
    let target = 0;
    let mode: "idle" | "drag" | "settle" | "glide" = "idle";
    let pendingCommit = false;
    let pendingIndex = liveIndexRef.current;
    let deadline = 0;
    let raf = 0;
    let last = 0;
    let visible = true;
    let pointerId = -1;
    let lastClientX = 0;
    let grantTimer = 0;

    const render = () => {
      handle.style.transform = `translateX(${x.toFixed(2)}px)`;
    };

    const setLive = (i: number) => {
      if (i !== liveIndexRef.current) {
        liveIndexRef.current = i;
        setLiveIndex(i);
      }
    };

    const nearest = (px: number) => {
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < catchX.length; i++) {
        const d = Math.abs(px - (catchX[i] ?? 0));
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    };

    // position-dependent friction field — same factor whichever direction
    // you cross it, exactly like real mechanical resistance
    const frictionAt = (px: number) => {
      const x0 = catchX[0] ?? 0;
      const x1 = catchX[1] ?? 0;
      const x2 = catchX[2] ?? 0;
      if (px < x0) return FRICTION_RUBBER;
      if (px < x1) return FRICTION_LOW;
      if (px < x2) return FRICTION_HIGH;
      return FRICTION_RUBBER;
    };

    const measure = () => {
      const rect = rail.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 8) {
        sized = false;
        return;
      }
      const range = Math.max(0, rect.width - PAD * 2 - HANDLE_D);
      catchX = FRACTIONS.map((f) => PAD + f * range);
      sized = true;
      notchRefs.current.forEach((n, i) => {
        if (n) n.style.left = `${(catchX[i] ?? 0) + HANDLE_D / 2}px`;
      });
      labelRefs.current.forEach((l, i) => {
        if (l) l.style.left = `${(catchX[i] ?? 0) + HANDLE_D / 2}px`;
      });
      if (keeperRef.current) {
        keeperRef.current.style.left = `${(catchX[2] ?? 0) + HANDLE_D - 6}px`;
      }
      if (mode === "idle") {
        x =
          (catchX[pendingIndex] ?? 0) + (pendingIndex === 2 ? SEAT : 0);
        render();
      }
    };

    const loop = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;
      if (mode !== "settle" && mode !== "glide") return;
      const k = mode === "settle" ? RELEASE_K : GLIDE_K;
      const z = mode === "settle" ? RELEASE_ZETA : GLIDE_ZETA;
      const c = 2 * z * Math.sqrt(k);
      const a = -k * (x - target) - c * v;
      v += a * dt;
      x += v * dt;
      render();
      const done = Math.abs(x - target) < EPS_X && Math.abs(v) < EPS_V;
      if (done || now > deadline) {
        x = target;
        v = 0;
        render();
        const wasCommit = mode === "settle" && pendingCommit;
        mode = "idle";
        pendingCommit = false;
        if (wasCommit) armGrant(pendingIndex);
        return;
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (
        !raf &&
        (mode === "settle" || mode === "glide") &&
        visible &&
        !document.hidden
      ) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const armGrant = (index: number) => {
      window.clearTimeout(grantTimer);
      grantTimer = window.setTimeout(() => {
        grantTimer = 0;
        grantRef.current(index);
      }, GRANT_GRACE_MS);
    };

    const beginSettle = (index: number, commit: boolean) => {
      pendingIndex = index;
      pendingCommit = commit;
      target = (catchX[index] ?? 0) + (index === 2 ? SEAT : 0);
      setLive(index);
      if (reduced) {
        x = target;
        v = 0;
        render();
        mode = "idle";
        if (commit) armGrant(index);
        return;
      }
      mode = "settle";
      deadline = performance.now() + FORCE_SETTLE_MS;
      wake();
    };

    const onDown = (e: PointerEvent) => {
      if (decisionRef.current || !sized || e.button !== 0) return;
      window.clearTimeout(grantTimer);
      grantTimer = 0;
      pendingCommit = false;
      cancelAnimationFrame(raf);
      raf = 0;
      mode = "drag";
      lastClientX = e.clientX;
      pointerId = e.pointerId;
      rail.style.cursor = "grabbing";
      try {
        rail.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    };

    const onMove = (e: PointerEvent) => {
      if (mode !== "drag" || e.pointerId !== pointerId) return;
      const dx = e.clientX - lastClientX;
      lastClientX = e.clientX;
      const f = frictionAt(x);
      const x0 = catchX[0] ?? 0;
      const x2 = catchX[2] ?? 0;
      x = Math.min(x2 + MAX_OVER, Math.max(x0 - MAX_OVER, x + dx * f));
      render();
      setLive(nearest(x));
    };

    const finishDrag = (commit: boolean) => {
      if (mode !== "drag") return;
      mode = "idle";
      rail.style.cursor = "";
      pointerId = -1;
      beginSettle(nearest(x), commit);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      finishDrag(true);
    };

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      finishDrag(false);
    };

    const glideTo = (index: number) => {
      if (decisionRef.current || mode === "drag") return;
      window.clearTimeout(grantTimer);
      grantTimer = 0;
      pendingCommit = false;
      setLive(index);
      pendingIndex = index;
      target = (catchX[index] ?? 0) + (index === 2 ? SEAT : 0);
      if (reduced) {
        x = target;
        v = 0;
        render();
        mode = "idle";
        return;
      }
      mode = "glide";
      deadline = performance.now() + FORCE_SETTLE_MS;
      wake();
    };

    const commitNow = (index: number) => {
      if (decisionRef.current || mode === "drag") return;
      window.clearTimeout(grantTimer);
      grantTimer = 0;
      pendingIndex = index;
      x = (catchX[index] ?? 0) + (index === 2 ? SEAT : 0);
      target = x;
      v = 0;
      mode = "idle";
      render();
      grantRef.current(index);
    };

    measure();
    engineRef.current = { glideTo, commitNow };

    const ro = new ResizeObserver(measure);
    ro.observe(rail);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(rail);
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);
    rail.addEventListener("pointerdown", onDown);
    rail.addEventListener("pointermove", onMove);
    rail.addEventListener("pointerup", onUp);
    rail.addEventListener("pointercancel", onCancel);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(grantTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      rail.removeEventListener("pointerdown", onDown);
      rail.removeEventListener("pointermove", onMove);
      rail.removeEventListener("pointerup", onUp);
      rail.removeEventListener("pointercancel", onCancel);
      rail.style.cursor = "";
      engineRef.current = null;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        engineRef.current?.glideTo(Math.min(2, liveIndex + 1));
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        engineRef.current?.glideTo(Math.max(0, liveIndex - 1));
        break;
      case "Home":
        e.preventDefault();
        engineRef.current?.glideTo(0);
        break;
      case "End":
        e.preventDefault();
        engineRef.current?.glideTo(2);
        break;
      case "Enter":
        e.preventDefault();
        engineRef.current?.commitNow(liveIndex);
        break;
      default:
        return;
    }
  };

  const scope = SCOPES[liveIndex] ?? "once";

  return (
    <div className={`w-full max-w-md ${className}`}>
      {capability ? (
        <div className="mb-3 min-w-0">
          <p className="truncate text-sm text-foreground">
            <span className="text-muted">Requesting: </span>
            {capability}
          </p>
          {context ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
              {context}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <button
          type="button"
          data-barrel-deny
          onClick={handleDeny}
          aria-label={`Deny — do not allow ${capability}`}
          className="mt-[3px] shrink-0 rounded-[6px] border border-border px-3 py-2 text-sm font-medium text-muted outline-none transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Deny
        </button>

        <div className="min-w-0 flex-1">
          <div
            ref={railRef}
            data-barrel-track
            className={`relative h-10 touch-none rounded-[6px] border border-border bg-background transition-opacity ${
              decision ? "opacity-60" : ""
            }`}
          >
            {/* three catch notches — 2px gaps painted into the top border */}
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                ref={(el) => {
                  notchRefs.current[i] = el;
                }}
                aria-hidden
                className="absolute top-[-1px] h-[2px] w-[3px] -translate-x-1/2 bg-background"
              />
            ))}

            {/* keeper — the socket the handle seats an extra 3px into at Always */}
            <span
              ref={keeperRef}
              aria-hidden
              className="absolute top-1/2 h-7 w-3.5 -translate-y-1/2 rounded-[4px] border border-border"
            />

            <div
              ref={handleRef}
              role="slider"
              tabIndex={decision ? -1 : 0}
              aria-disabled={decision ? true : undefined}
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={2}
              aria-valuenow={liveIndex}
              aria-valuetext={VALUE_TEXT[scope]}
              aria-label={`Permission scope for ${capability}`}
              onKeyDown={decision ? undefined : onKeyDown}
              className="absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 cursor-grab touch-none rounded-full border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.16)] outline-none transition-colors will-change-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing"
            />
          </div>

          <div className="relative mt-2 h-4">
            {SCOPES.map((s, i) => (
              <span
                key={s}
                ref={(el) => {
                  labelRefs.current[i] = el;
                }}
                className={`absolute -translate-x-1/2 whitespace-nowrap font-mono text-[11px] transition-[font-weight,color] ${
                  i === 2 && liveIndex === 2
                    ? "font-semibold text-foreground"
                    : "text-muted"
                }`}
              >
                {SCOPE_LABEL[s]}
              </span>
            ))}
          </div>

          {!decision ? (
            <p data-barrel-sublabel className="mt-1 text-xs text-muted">
              {SUBLABEL[scope]}
            </p>
          ) : (
            <p
              data-barrel-receipt
              role="status"
              className="mt-1 text-xs text-foreground"
            >
              {decision === "denied"
                ? "Denied — will ask again next time."
                : grantedScope === "once"
                  ? "Granted — Once: will ask again next time."
                  : grantedScope === "session"
                    ? "Granted — This session: won't ask again until you restart."
                    : "Granted — Always: won't ask again."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
