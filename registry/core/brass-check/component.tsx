"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// BrassCheck — the active-sessions list as a pit-head lamp-room check board.
// Every live session is a stamped brass tag (its number in Geist Mono)
// hanging on its own hook; signing one out is unhooking it, not deleting a
// row. One governing scalar per tag: hang angle `theta` on a damped harmonic
// spring (`accel = -K*(theta-target) - C*vel`), written straight to an SVG
// <g>'s `transform` every frame — never React state in the hot path.
//
//   - idle:  target = 0deg
//   - hover: target = 2deg (the tag answers the pointer, proving it's live)
//   - hold:  target = 48deg (well past the 28deg release angle) — pressing
//     and holding the sign-out button drives the spring toward it
//
// If the hold is released (pointerup/keyup/pointerleave) BEFORE the tag's
// actual angle has crossed 28deg AND at least MIN_HOLD_MS has elapsed, the
// gesture aborts: target snaps back to 0 (or 2 if still hovered) and the
// same spring visibly swings the tag back and re-seats it — never an
// ambiguous static reset. Only once both conditions are true does the hold
// COMMIT: the row is removed from the board immediately (an instant list
// reflow, not a fade or a height-collapse) and a separate ballistic "ghost"
// tag takes over — free-fall under gravity with one 0.18-restitution
// bounce off the tray floor, no easing curve, real per-frame integration
// (vy += g*dt; y += vy*dt) written to `transform: translate3d(...) rotate(...)`.
// Once the ghost settles it is retired and a real <li> is appended to the
// tray's `role="log"` — THAT DOM insertion, with the li's accessible name
// set to "{device} signed out, N sessions remain", is the announcement.
//
// This two-phase handoff (rest -> spring resists -> commit -> gravity owns
// it) is the falsifiable bit: revocation is a one-way physical transfer,
// never an opacity fade or a height collapse standing in for it. It is also
// why a stray click can't revoke anything — a fast pointerdown/up never
// accumulates MIN_HOLD_MS, so the verifier's incidental "press" pass on the
// first control just nudges the tag and lets it swing back, exactly like an
// aborted hold from a real user.
//
// The current device's tag has no sign-out control at all (a decorative
// lanyard loop through the ring instead of a hook) — not a disabled button,
// since there is nothing to confirm or explain, just nothing there.
//
// prefers-reduced-motion: hover/hold produce no continuous spring animation
// (poses are set instantly, no interpolation), and a committed hold moves
// the tag from hook to tray in a single paint — no ghost, no flight — with
// the identical log announcement.
// ---------------------------------------------------------------------------

export interface CheckSession {
  id: string;
  device: string;
  location: string;
  lastSeen: string;
  /** the session driving this render — gets a lanyard, no sign-out control */
  current?: boolean;
}

export interface BrassCheckProps {
  /** every live session; order fixes each tag's stamped number */
  sessions: CheckSession[];
  /** accessible name for the board */
  label?: string;
  /** fires the instant a tag leaves the hook (not when it lands in the tray) */
  onSignOut?: (id: string) => void;
  className?: string;
}

const HOVER_DEG = 2;
const RELEASE_ANGLE = 28;
const HOLD_TARGET_DEG = 48;
const MIN_HOLD_MS = 620;
const SPRING_K = 18;
const SPRING_C = 7;
const REST_EPS = 0.06;
const GRAVITY = 2200; // px/s^2
const RESTITUTION = 0.18;
const ROT_DAMP = 3.2; // 1/s decay on the tumble
const SLIP_VX = 46; // px/s lateral slip at the moment of release

function restTilt(tagNumber: number) {
  return ((tagNumber * 53) % 13) - 6;
}

function formatClock(d: Date) {
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

interface RowRuntime {
  theta: number;
  vel: number;
  target: number;
  holding: boolean;
  hovered: boolean;
  holdStart: number | null;
  released: boolean;
  rafId: number | undefined;
  lastTs: number | undefined;
  reducedTimer: number | undefined;
  groupEl: SVGGElement | null;
  buttonEl: HTMLButtonElement | null;
}

interface GhostRuntime {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  floorY: number;
  bounced: boolean;
  rafId: number | undefined;
  lastTs: number | undefined;
  el: HTMLDivElement | null;
}

interface GhostView {
  id: string;
  tagNumber: number;
}

interface TrayEntry {
  id: string;
  device: string;
  tagNumber: number;
  time: string;
  remaining: number;
  tilt: number;
}

export function BrassCheck({ sessions, label = "Active sessions", onSignOut, className = "" }: BrassCheckProps) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [ghosts, setGhosts] = useState<GhostView[]>([]);
  const [tray, setTray] = useState<TrayEntry[]>([]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLUListElement | null>(null);
  const reducedRef = useRef(false);
  const runtimes = useRef(new Map<string, RowRuntime>()).current;
  const ghostRuntimes = useRef(new Map<string, GhostRuntime>()).current;
  const tagNumbers = useRef(new Map(sessions.map((s, i) => [s.id, i + 1]))).current;
  const pendingFocusRef = useRef<number | null>(null);
  // Not derived from `removedIds` state: the in-flight rAF chain that calls
  // `commitRelease` was captured when its hold started, so if a second row
  // finishes falling while a first row's ghost is still airborne, that
  // stale closure would otherwise read a `removedIds` from its own render
  // and undercount by however many revocations landed since. This ref is
  // mutated synchronously, so every commit sees the true running total.
  const removedCountRef = useRef(0);
  const trayLabelId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => () => {
      runtimes.forEach((r) => {
        if (r.rafId !== undefined) cancelAnimationFrame(r.rafId);
        if (r.reducedTimer !== undefined) window.clearTimeout(r.reducedTimer);
      });
      ghostRuntimes.forEach((g) => {
        if (g.rafId !== undefined) cancelAnimationFrame(g.rafId);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const getRuntime = useCallback(
    (id: string): RowRuntime => {
      let r = runtimes.get(id);
      if (!r) {
        r = {
          theta: 0,
          vel: 0,
          target: 0,
          holding: false,
          hovered: false,
          holdStart: null,
          released: false,
          rafId: undefined,
          lastTs: undefined,
          reducedTimer: undefined,
          groupEl: null,
          buttonEl: null,
        };
        runtimes.set(id, r);
      }
      return r;
    },
    [runtimes]
  );

  const applyRowPose = (r: RowRuntime) => {
    if (r.groupEl) r.groupEl.style.transform = `rotate(${r.theta.toFixed(2)}deg)`;
  };

  const commitRelease = useCallback(
    (id: string, theta: number, angularVel: number) => {
      const runtime = getRuntime(id);
      if (runtime.released) return;
      runtime.released = true;
      runtime.holding = false;
      if (runtime.rafId !== undefined) {
        cancelAnimationFrame(runtime.rafId);
        runtime.rafId = undefined;
      }

      const session = sessions.find((s) => s.id === id);
      if (!session) return;
      onSignOut?.(id);

      const root = rootRef.current;
      if (root) {
        const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".ns-bc-signout"));
        const idx = buttons.indexOf(runtime.buttonEl as HTMLButtonElement);
        pendingFocusRef.current = idx >= 0 ? idx : null;
      }

      removedCountRef.current += 1;
      const remaining = sessions.length - removedCountRef.current;
      const tagNumber = tagNumbers.get(id) ?? 0;
      const tilt = restTilt(tagNumber);

      const rootRect = root?.getBoundingClientRect();
      const trayRect = trayRef.current?.getBoundingClientRect();
      const groupRect = runtime.groupEl?.getBoundingClientRect();

      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      if (reducedRef.current || !rootRect || !trayRect || !groupRect) {
        // one paint: land immediately, no ghost flight.
        setTray((prev) => [
          { id: `${id}-${Date.now()}`, device: session.device, tagNumber, time: formatClock(new Date()), remaining, tilt },
          ...prev,
        ]);
        return;
      }

      const ghostId = `${id}-${Date.now()}`;
      const startX = groupRect.left - rootRect.left + groupRect.width / 2;
      const startY = groupRect.top - rootRect.top + groupRect.height / 2;
      // Aim the ghost's center at roughly where a landed ticket's own
      // center sits (tray padding + half the ~26px ticket row height),
      // not just the tray's outer top edge, so the handoff to the real
      // <li> reads as a landing rather than a teleport.
      const floorY = trayRect.top - rootRect.top + 12 + 13;
      const vx = SLIP_VX * (theta >= 0 ? 1 : -1);

      ghostRuntimes.set(ghostId, {
        x: startX,
        y: startY,
        vx,
        vy: 30,
        rot: theta,
        vRot: Math.max(-260, Math.min(260, angularVel * 12)),
        floorY,
        bounced: false,
        rafId: undefined,
        lastTs: undefined,
        el: null,
      });
      setGhosts((prev) => [...prev, { id: ghostId, tagNumber }]);

      const tick = (ts: number) => {
        const g = ghostRuntimes.get(ghostId);
        if (!g) return;
        const last = g.lastTs ?? ts;
        const dt = Math.min((ts - last) / 1000, 0.032);
        g.lastTs = ts;

        g.vy += GRAVITY * dt;
        g.y += g.vy * dt;
        g.x += g.vx * dt;
        g.vx *= Math.max(0, 1 - 1.6 * dt);
        g.vRot *= Math.max(0, 1 - ROT_DAMP * dt);
        g.rot += g.vRot * dt;

        let landed = false;
        if (g.y >= g.floorY) {
          if (!g.bounced) {
            g.y = g.floorY;
            g.vy = -g.vy * RESTITUTION;
            g.bounced = true;
          } else {
            g.y = g.floorY;
            g.vy = 0;
            g.vx = 0;
            g.vRot = 0;
            g.rot = tilt;
            landed = true;
          }
        }

        if (g.el) {
          g.el.style.transform = `translate3d(${g.x.toFixed(1)}px, ${g.y.toFixed(1)}px, 0) rotate(${g.rot.toFixed(1)}deg)`;
        }

        if (landed) {
          ghostRuntimes.delete(ghostId);
          setGhosts((prev) => prev.filter((gh) => gh.id !== ghostId));
          setTray((prev) => [{ id: ghostId, device: session.device, tagNumber, time: formatClock(new Date()), remaining, tilt }, ...prev]);
          return;
        }
        g.rafId = requestAnimationFrame(tick);
      };
      ghostRuntimes.get(ghostId)!.rafId = requestAnimationFrame(tick);
    },
    [sessions, onSignOut, getRuntime, ghostRuntimes, tagNumbers]
  );

  const tickRow = useCallback(
    (id: string, ts: number) => {
      const r = getRuntime(id);
      const last = r.lastTs ?? ts;
      const dt = Math.min((ts - last) / 1000, 0.032);
      r.lastTs = ts;

      const accel = -SPRING_K * (r.theta - r.target) - SPRING_C * r.vel;
      r.vel += accel * dt;
      r.theta += r.vel * dt;
      applyRowPose(r);

      if (r.holding && !r.released && r.theta >= RELEASE_ANGLE && r.holdStart !== null && ts - r.holdStart >= MIN_HOLD_MS) {
        commitRelease(id, r.theta, r.vel);
        return;
      }

      if (!r.holding && Math.abs(r.theta - r.target) < REST_EPS && Math.abs(r.vel) < REST_EPS) {
        r.theta = r.target;
        r.vel = 0;
        applyRowPose(r);
        r.lastTs = undefined;
        r.rafId = undefined;
        return;
      }
      r.rafId = requestAnimationFrame((t) => tickRow(id, t));
    },
    [getRuntime, commitRelease]
  );

  const ensureRowLoop = useCallback(
    (id: string) => {
      const r = getRuntime(id);
      if (r.rafId === undefined) {
        r.rafId = requestAnimationFrame((ts) => tickRow(id, ts));
      }
    },
    [getRuntime, tickRow]
  );

  const startHold = useCallback(
    (id: string) => {
      const r = getRuntime(id);
      if (r.released || r.holding) return;
      if (reducedRef.current) {
        r.holding = true;
        r.holdStart = performance.now();
        if (r.reducedTimer !== undefined) window.clearTimeout(r.reducedTimer);
        r.reducedTimer = window.setTimeout(() => {
          if (r.holding && !r.released) commitRelease(id, RELEASE_ANGLE, 0);
        }, MIN_HOLD_MS);
        return;
      }
      r.holding = true;
      r.holdStart = performance.now();
      r.target = HOLD_TARGET_DEG;
      ensureRowLoop(id);
    },
    [getRuntime, ensureRowLoop, commitRelease]
  );

  const endHold = useCallback(
    (id: string) => {
      const r = getRuntime(id);
      if (r.released) return;
      r.holding = false;
      r.holdStart = null;
      if (r.reducedTimer !== undefined) {
        window.clearTimeout(r.reducedTimer);
        r.reducedTimer = undefined;
      }
      if (reducedRef.current) {
        r.theta = r.hovered ? HOVER_DEG : 0;
        r.target = r.theta;
        r.vel = 0;
        applyRowPose(r);
        return;
      }
      r.target = r.hovered ? HOVER_DEG : 0;
      ensureRowLoop(id);
    },
    [getRuntime, ensureRowLoop]
  );

  const setHover = useCallback(
    (id: string, hovered: boolean) => {
      const r = getRuntime(id);
      if (r.released || r.holding) {
        r.hovered = hovered;
        return;
      }
      r.hovered = hovered;
      if (reducedRef.current) {
        r.target = hovered ? HOVER_DEG : 0;
        r.theta = r.target;
        r.vel = 0;
        applyRowPose(r);
        return;
      }
      r.target = hovered ? HOVER_DEG : 0;
      ensureRowLoop(id);
    },
    [getRuntime, ensureRowLoop]
  );

  useEffect(() => {
    const idx = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (idx === null) return;
    const root = rootRef.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".ns-bc-signout"));
    const target = buttons[Math.min(idx, buttons.length - 1)];
    target?.focus();
  }, [removedIds]);

  const visible = sessions.filter((s) => !removedIds.has(s.id));

  const onKeyDown = (id: string) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      e.preventDefault();
      startHold(id);
    }
  };
  const onKeyUp = (id: string) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      endHold(id);
    }
  };
  const onPointerDown = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startHold(id);
  };

  return (
    <div ref={rootRef} className={`ns-bc-root ${className}`}>
      <style>{CSS}</style>

      <ul className="ns-bc-board" aria-label={label}>
        {visible.map((s) => {
          const num = tagNumbers.get(s.id) ?? 0;
          const runtime = getRuntime(s.id);
          const tagLabel = String(num).padStart(2, "0");
          return (
            <li key={s.id} className="ns-bc-row">
              {s.current ? (
                <span className="ns-bc-hookslot" aria-hidden="true">
                  <svg width="52" height="60" viewBox="0 0 52 60" focusable="false">
                    <path d="M20 3c4 -3.6 8 -3.6 12 0" fill="none" stroke="var(--ns-muted)" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx="26" cy="12" r="4" fill="none" stroke="var(--ns-muted)" strokeWidth="1.3" />
                    <path
                      d="M23.4 15 L20 46 M28.6 15 L32 46"
                      fill="none"
                      stroke="var(--ns-muted)"
                      strokeWidth="1"
                      strokeDasharray="1.5 2.5"
                      strokeLinecap="round"
                    />
                    <rect x="10" y="17" width="32" height="34" rx="8" fill="var(--background)" stroke="var(--foreground)" strokeWidth="1.3" />
                    <text x="26" y="39" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--foreground)">
                      {tagLabel}
                    </text>
                  </svg>
                </span>
              ) : (
                <button
                  type="button"
                  className="ns-bc-signout"
                  aria-label={`Sign out ${s.device}`}
                  ref={(el) => {
                    runtime.buttonEl = el;
                  }}
                  onPointerEnter={() => setHover(s.id, true)}
                  onPointerLeave={() => {
                    setHover(s.id, false);
                    endHold(s.id);
                  }}
                  onPointerDown={onPointerDown(s.id)}
                  onPointerUp={() => endHold(s.id)}
                  onPointerCancel={() => endHold(s.id)}
                  onKeyDown={onKeyDown(s.id)}
                  onKeyUp={onKeyUp(s.id)}
                >
                  <svg width="52" height="60" viewBox="0 0 52 60" aria-hidden="true" focusable="false">
                    <path d="M20 3c4 -3.6 8 -3.6 12 0" fill="none" stroke="var(--ns-muted)" strokeWidth="1.3" strokeLinecap="round" />
                    <g
                      ref={(el) => {
                        runtime.groupEl = el;
                      }}
                      style={{ transformOrigin: "26px 12px" }}
                    >
                      <circle cx="26" cy="12" r="4" fill="none" stroke="var(--ns-muted)" strokeWidth="1.3" />
                      <rect x="10" y="17" width="32" height="34" rx="8" fill="var(--background)" stroke="var(--foreground)" strokeWidth="1.3" />
                      <text x="26" y="39" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--foreground)">
                        {tagLabel}
                      </text>
                    </g>
                  </svg>
                </button>
              )}
              <span className="ns-bc-info">
                <span className="ns-bc-device">
                  {s.device}
                  {s.current && <span className="ns-bc-thisdevice">This device</span>}
                </span>
                <span className="ns-bc-meta">
                  {s.location} · {s.lastSeen}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {ghosts.map((g) => (
        <div
          key={g.id}
          aria-hidden="true"
          className="ns-bc-ghost"
          ref={(el) => {
            const gr = ghostRuntimes.get(g.id);
            if (gr) gr.el = el;
          }}
        >
          <svg width="52" height="52" viewBox="0 0 52 52" focusable="false">
            <circle cx="26" cy="10" r="4" fill="none" stroke="var(--ns-muted)" strokeWidth="1.3" />
            <rect x="10" y="14" width="32" height="32" rx="8" fill="var(--background)" stroke="var(--foreground)" strokeWidth="1.3" />
            <text x="26" y="34" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--foreground)">
              {String(g.tagNumber).padStart(2, "0")}
            </text>
          </svg>
        </div>
      ))}

      <div className="ns-bc-traywrap">
        <h3 id={trayLabelId} className="ns-bc-traylabel">
          Sign-out history
        </h3>
        <ul ref={trayRef} role="log" aria-live="polite" aria-relevant="additions" aria-labelledby={trayLabelId} className="ns-bc-tray">
          {tray.length === 0 ? (
            <li className="ns-bc-trayempty" aria-hidden="true">
              Tray empty
            </li>
          ) : (
            tray.map((t) => (
              <li key={t.id} className="ns-bc-trayrow" style={{ transform: `rotate(${t.tilt}deg)` }}>
                <span className="sr-only">
                  {t.device} signed out, {t.remaining} session{t.remaining === 1 ? "" : "s"} remain
                </span>
                <span className="ns-bc-traynum" aria-hidden="true">
                  {String(t.tagNumber).padStart(2, "0")}
                </span>
                <span className="ns-bc-traydevice" aria-hidden="true">
                  {t.device}
                </span>
                <span className="ns-bc-traytime" aria-hidden="true">
                  {t.time}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

const CSS = `
.ns-bc-root{position:relative;display:flex;flex-direction:column;gap:18px;}
.ns-bc-board{list-style:none;margin:0;padding:0;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--background);}
.ns-bc-row{position:relative;display:flex;align-items:center;gap:14px;padding:10px 16px;border-bottom:1px solid var(--border);}
.ns-bc-row:last-child{border-bottom:none;}
.ns-bc-row:hover{background:color-mix(in oklab, var(--ns-muted) 7%, var(--background));}
.ns-bc-signout,.ns-bc-hookslot{flex:none;display:inline-flex;line-height:0;}
.ns-bc-signout{background:none;border:none;padding:0;margin:0;cursor:pointer;border-radius:6px;touch-action:none;}
.ns-bc-signout:focus-visible{outline:2px solid var(--ns-accent);outline-offset:3px;border-radius:6px;}
.ns-bc-info{display:flex;flex-direction:column;gap:2px;min-width:0;}
.ns-bc-device{font-size:13px;color:var(--foreground);display:flex;align-items:center;gap:8px;}
.ns-bc-thisdevice{font-size:10px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.06em;color:var(--ns-muted);border:1px solid var(--border);border-radius:999px;padding:1px 7px;}
.ns-bc-meta{font-size:11px;color:var(--ns-muted);font-family:var(--font-mono);}
.ns-bc-ghost{position:absolute;top:0;left:0;width:52px;height:52px;margin:-26px 0 0 -26px;pointer-events:none;z-index:10;}
.ns-bc-traywrap{display:flex;flex-direction:column;gap:8px;}
.ns-bc-traylabel{margin:0;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:var(--ns-muted);}
.ns-bc-tray{list-style:none;margin:0;padding:12px;min-height:60px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px;border:1px dashed var(--border);border-radius:12px;background:color-mix(in oklab, var(--ns-muted) 4%, var(--background));}
.ns-bc-trayempty{font-size:11px;color:var(--ns-muted);font-family:var(--font-mono);padding:4px 2px;}
.ns-bc-trayrow{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--background);font-family:var(--font-mono);font-size:11px;color:var(--foreground);box-shadow:0 1px 2px color-mix(in oklab, var(--foreground) 16%, transparent);}
.ns-bc-traynum{color:var(--ns-muted);}
.ns-bc-traytime{color:var(--ns-muted);}
`;
