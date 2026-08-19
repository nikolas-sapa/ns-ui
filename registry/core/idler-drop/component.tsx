"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// IdlerDrop — delegated admin drawn as a gear train. Your authority is a
// 24-tooth drive gear that turns continuously (one shared phase, 0.15 rev/s,
// applied identically to every row so meshes can never drift). Each delegate
// is a driven gear coupled through a swinging idler; its tooth count is fixed
// by role (admin 12, editor 8, viewer 3 — a discrete authority ratio, not a
// continuous radius) so the mesh, not a stored value, is what grants them
// anything. Revoke swings the idler carrier out over 250ms — the driven gear
// leaves the shared phase and freewheels down its own exponential (tau
// ~1.2s) while the drive gear keeps turning. That coast IS the disclosure:
// the delegate's existing session outlives the grant until it expires.
// Rotation is refs-only, imperative `setAttribute("transform", …)` on a
// single rAF loop; React state only touches the rare, discrete stuff (role,
// revoked, the coasting readout, the live region).
// ---------------------------------------------------------------------------

export type DelegateRole = "admin" | "editor" | "viewer";

export type Delegation = {
  id: string;
  name: string;
  role: DelegateRole;
  /** epoch ms the grant was made */
  grantedAt: number;
  /** epoch ms the delegate's underlying session token actually expires —
   *  real data the post-revoke "coasting" readout is computed from, not a
   *  scripted countdown. */
  sessionExpiresAt: number;
};

type Row = Delegation & {
  revoked: boolean;
  coastingMinutes: number | null;
};

type Freewheel = { t0: number; angle0: number; v0: number };

const ROLE_TEETH: Record<DelegateRole, number> = {
  admin: 12,
  editor: 8,
  viewer: 3,
};
const ROLE_LABEL: Record<DelegateRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};
const ROLE_ORDER: DelegateRole[] = ["admin", "editor", "viewer"];

const DRIVE_TEETH = 24;
const IDLER_TEETH = 6; // cancels out of the final ratio — only sets direction + spacing
const DEG_PER_SEC = 0.15 * 360; // one shared train phase, 0.15 rev/s
const TAU_S = 1.2; // freewheel time constant
const SWING_MS = 250; // idler carrier disengage duration
const SWING_DEG = 40;

const MODULE = 2.6; // shared tooth pitch — what lets every gear actually mesh
const PAD = 18;
const ROW_H = 176;

const pitchR = (teeth: number) => teeth * MODULE;
const rootR = (rOuter: number) => rOuter * 0.62;
const boreR = (rInner: number) => rInner * 0.55;

const DRIVE_R = pitchR(DRIVE_TEETH);
const DRIVE_R_IN = rootR(DRIVE_R);
const DRIVE_CX = PAD + DRIVE_R;
const DRIVE_CY = ROW_H / 2;

const IDLER_R = pitchR(IDLER_TEETH);
const IDLER_R_IN = rootR(IDLER_R);
const ARM = DRIVE_R + IDLER_R; // idler's fixed distance from the drive centre
const IDLER_CX = DRIVE_CX + ARM;
const IDLER_CY = DRIVE_CY;

function drivenCx(role: DelegateRole) {
  return IDLER_CX + IDLER_R + pitchR(ROLE_TEETH[role]);
}

const ROW_W = drivenCx("admin") + pitchR(ROLE_TEETH.admin) + PAD;

function gearPathAt(
  cx: number,
  cy: number,
  teeth: number,
  rOuter: number,
  rInner: number
): string {
  const step = 360 / teeth;
  const half = step * 0.5;
  const tipHalf = half * 0.5;
  const toXY = (r: number, deg: number): [number, number] => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const parts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    const [x0, y0] = toXY(rInner, c - half);
    const [x1, y1] = toXY(rOuter, c - tipHalf);
    const [x2, y2] = toXY(rOuter, c + tipHalf);
    const [x3, y3] = toXY(rInner, c + half);
    parts.push(`${i === 0 ? "M" : "L"}${x0.toFixed(2)},${y0.toFixed(2)}`);
    parts.push(`L${x1.toFixed(2)},${y1.toFixed(2)}`);
    parts.push(`L${x2.toFixed(2)},${y2.toFixed(2)}`);
    parts.push(`L${x3.toFixed(2)},${y3.toFixed(2)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

// timing mark: a short radial tick from root to tip at angle 0, so a gear
// with perfectly regular teeth still reads as rotating rather than static.
function tickAt(cx: number, cy: number, rInner: number, rOuter: number) {
  return { x1: cx, y1: cy - rInner, x2: cx, y2: cy - rOuter };
}

const DRIVE_PATH = gearPathAt(DRIVE_CX, DRIVE_CY, DRIVE_TEETH, DRIVE_R, DRIVE_R_IN);
const DRIVE_TICK = tickAt(DRIVE_CX, DRIVE_CY, DRIVE_R_IN, DRIVE_R);
const DRIVE_BORE = boreR(DRIVE_R_IN);

const IDLER_PATH = gearPathAt(IDLER_CX, IDLER_CY, IDLER_TEETH, IDLER_R, IDLER_R_IN);
const IDLER_TICK = tickAt(IDLER_CX, IDLER_CY, IDLER_R_IN, IDLER_R);
const IDLER_BORE = boreR(IDLER_R_IN);

const DRIVEN_GEOM = Object.fromEntries(
  ROLE_ORDER.map((role) => {
    const cx = drivenCx(role);
    const r = pitchR(ROLE_TEETH[role]);
    const rIn = rootR(r);
    return [
      role,
      {
        cx,
        cy: DRIVE_CY,
        r,
        path: gearPathAt(cx, DRIVE_CY, ROLE_TEETH[role], r, rIn),
        tick: tickAt(cx, DRIVE_CY, rIn, r),
        bore: boreR(rIn),
      },
    ];
  })
) as Record<
  DelegateRole,
  { cx: number; cy: number; r: number; path: string; tick: ReturnType<typeof tickAt>; bore: number }
>;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function easeOutCubic(t: number): number {
  const k = 1 - t;
  return 1 - k * k * k;
}

export function IdlerDrop({
  delegations,
  title = "Delegated admin",
  className = "",
}: {
  delegations: Delegation[];
  title?: string;
  className?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    delegations.map((d) => ({ ...d, revoked: false, coastingMinutes: null }))
  );
  const [liveMessage, setLiveMessage] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const gRefs = useRef<
    Record<string, { drive: SVGGElement | null; idler: SVGGElement | null; driven: SVGGElement | null }>
  >({});
  const phaseRef = useRef(0);
  const freewheelRef = useRef<Record<string, Freewheel>>({});
  const wakeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedRef = { current: mq.matches };
    const onMqChange = () => {
      reducedRef.current = mq.matches;
      wakeRef.current?.();
    };
    mq.addEventListener("change", onMqChange);

    let visible = true;
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wakeRef.current?.();
    });
    io.observe(root);

    let raf = 0;
    let last = 0;

    const applyRow = (id: string, driveDeg: number, idlerAttr: string, drivenDeg: number) => {
      const g = gRefs.current[id];
      if (!g) return;
      g.drive?.setAttribute("transform", `rotate(${driveDeg} ${DRIVE_CX} ${DRIVE_CY})`);
      g.idler?.setAttribute("transform", idlerAttr);
      const row = rowsRef.current.find((r) => r.id === id);
      const cx = row ? DRIVEN_GEOM[row.role].cx : 0;
      g.driven?.setAttribute("transform", `rotate(${drivenDeg} ${cx} ${DRIVE_CY})`);
    };

    const restFrame = () => {
      for (const row of rowsRef.current) {
        const swing = row.revoked ? SWING_DEG : 0;
        const idlerAttr = `rotate(${swing} ${DRIVE_CX} ${DRIVE_CY}) rotate(0 ${IDLER_CX} ${IDLER_CY})`;
        applyRow(row.id, 0, idlerAttr, 0);
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (reducedRef.current) {
        restFrame();
        last = 0;
        return; // sleeps until the media-query listener wakes it
      }
      if (!visible || document.hidden) {
        last = 0;
        return; // IntersectionObserver / visibilitychange wakes it
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      phaseRef.current += DEG_PER_SEC * dt;
      const phase = phaseRef.current;
      const idlerSpin = -phase * (DRIVE_TEETH / IDLER_TEETH);

      for (const row of rowsRef.current) {
        const fw = freewheelRef.current[row.id];
        const swing = fw
          ? SWING_DEG * easeOutCubic(Math.min(1, ((now - fw.t0) / SWING_MS)))
          : 0;
        const idlerAttr = `rotate(${swing} ${DRIVE_CX} ${DRIVE_CY}) rotate(${idlerSpin} ${IDLER_CX} ${IDLER_CY})`;

        let drivenDeg: number;
        if (fw) {
          const t = (now - fw.t0) / 1000;
          drivenDeg = fw.angle0 + fw.v0 * TAU_S * (1 - Math.exp(-t / TAU_S));
        } else {
          drivenDeg = phase * (DRIVE_TEETH / ROLE_TEETH[row.role]);
        }
        applyRow(row.id, phase, idlerAttr, drivenDeg);
      }

      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    wakeRef.current = wake;
    wake();

    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      mq.removeEventListener("change", onMqChange);
      document.removeEventListener("visibilitychange", onVis);
      wakeRef.current = null;
    };
  }, []);

  function handleRevoke(id: string) {
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row || row.revoked) return;
    const teeth = ROLE_TEETH[row.role];
    freewheelRef.current[id] = {
      t0: performance.now(),
      angle0: phaseRef.current * (DRIVE_TEETH / teeth),
      v0: DEG_PER_SEC * (DRIVE_TEETH / teeth),
    };
    const mins = Math.max(0, Math.round((row.sessionExpiresAt - Date.now()) / 60000));
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, revoked: true, coastingMinutes: mins } : r))
    );
    setLiveMessage(
      `${ROLE_LABEL[row.role]} access revoked for ${row.name}; existing session expires in ${mins} minute${mins === 1 ? "" : "s"}.`
    );
    wakeRef.current?.();
  }

  function handleRoleChange(id: string, role: DelegateRole) {
    setRows((prev) => prev.map((r) => (r.id === id && !r.revoked ? { ...r, role } : r)));
  }

  return (
    <div ref={rootRef} className={`rounded-md border border-border bg-background ${className}`}>
      <style>{`
.ns-idr-btn,.ns-idr-select{transition:opacity 150ms ease-out,border-color 150ms ease-out}
@media (prefers-reduced-motion: reduce){
  .ns-idr-btn,.ns-idr-select{transition:none}
}
      `}</style>

      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-ns-muted">
          drive 24T · admin 12T · editor 8T · viewer 3T
        </p>
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {liveMessage}
      </div>

      <ul role="list" className="divide-y divide-border">
        {rows.map((row, i) => {
          const geom = DRIVEN_GEOM[row.role];
          const drivenLeft = (geom.cx / ROW_W) * 100;
          const drivenTop = (geom.cy / ROW_H) * 100;

          return (
            <li
              key={row.id}
              data-row-index={i}
              className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center"
            >
              <div
                className="relative w-full shrink-0 sm:w-[220px]"
                style={{ aspectRatio: `${ROW_W} / ${ROW_H}` }}
              >
                <svg
                  viewBox={`0 0 ${ROW_W} ${ROW_H}`}
                  className="absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  <g
                    ref={(el) => {
                      gRefs.current[row.id] ??= { drive: null, idler: null, driven: null };
                      gRefs.current[row.id].drive = el;
                    }}
                    transform={`rotate(0 ${DRIVE_CX} ${DRIVE_CY})`}
                  >
                    <path d={DRIVE_PATH} fill="none" stroke="var(--foreground)" strokeWidth={1.25} />
                    <circle cx={DRIVE_CX} cy={DRIVE_CY} r={DRIVE_BORE} fill="var(--background)" stroke="var(--border)" />
                    <line {...DRIVE_TICK} stroke="var(--foreground)" strokeWidth={1.25} />
                  </g>

                  <g
                    ref={(el) => {
                      gRefs.current[row.id] ??= { drive: null, idler: null, driven: null };
                      gRefs.current[row.id].idler = el;
                    }}
                    transform={`rotate(${row.revoked ? SWING_DEG : 0} ${DRIVE_CX} ${DRIVE_CY}) rotate(0 ${IDLER_CX} ${IDLER_CY})`}
                  >
                    <path d={IDLER_PATH} fill="none" stroke="var(--ns-muted)" strokeWidth={1} />
                    <circle cx={IDLER_CX} cy={IDLER_CY} r={IDLER_BORE} fill="var(--background)" stroke="var(--border)" />
                    <line {...IDLER_TICK} stroke="var(--ns-muted)" strokeWidth={1} />
                  </g>

                  <g
                    ref={(el) => {
                      gRefs.current[row.id] ??= { drive: null, idler: null, driven: null };
                      gRefs.current[row.id].driven = el;
                    }}
                    transform={`rotate(0 ${geom.cx} ${geom.cy})`}
                  >
                    <path d={geom.path} fill="none" stroke="var(--foreground)" strokeWidth={1.25} />
                    <circle cx={geom.cx} cy={geom.cy} r={geom.bore} fill="var(--background)" stroke="var(--border)" />
                    <line {...geom.tick} stroke="var(--foreground)" strokeWidth={1.25} />
                  </g>
                </svg>

                {/* Real DOM text, anchored at the driven gear's bore — never
                    part of the rotating group, so it stays upright and
                    legible while the ring around it turns or freewheels. */}
                <div
                  className="pointer-events-none absolute select-none text-center leading-tight"
                  style={{
                    left: `${drivenLeft}%`,
                    top: `${drivenTop}%`,
                    transform: "translate(-50%, -50%)",
                    width: 64,
                  }}
                >
                  <div className="truncate text-[9px] font-semibold text-foreground">{row.name}</div>
                  <div className="truncate font-mono text-[7.5px] text-ns-muted">
                    {ROLE_LABEL[row.role]} · {shortDate(row.grantedAt)}
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {row.name}
                </span>

                <label className="flex items-center gap-1.5">
                  <span className="sr-only">Role for {row.name}</span>
                  <select
                    value={row.role}
                    disabled={row.revoked}
                    onChange={(e) => handleRoleChange(row.id, e.target.value as DelegateRole)}
                    aria-label={`Role for ${row.name}`}
                    className="ns-idr-select rounded-sm border border-border bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:opacity-45"
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  data-revoke-btn
                  disabled={row.revoked}
                  onClick={() => handleRevoke(row.id)}
                  aria-label={row.revoked ? `Access revoked for ${row.name}` : `Revoke access for ${row.name}`}
                  className="ns-idr-btn rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:opacity-45 disabled:hover:border-border"
                >
                  {row.revoked ? "Revoked" : "Revoke"}
                </button>

                {row.revoked ? (
                  <span data-coasting className="font-mono text-[11px] text-ns-muted">
                    coasting: {row.coastingMinutes} min
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
