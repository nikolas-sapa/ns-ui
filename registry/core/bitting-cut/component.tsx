"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// BittingCut — a passkey's credential ID rendered as a physical key blade, so
// "the MacBook passkey" and "the phone passkey" are visually distinct objects
// a person recognizes across sessions, not two identical shield icons.
//
// The bitting profile (6 notch depths, quantized to 5 levels — real key-cut
// vocabulary) is a PURE function of the credential id: same id -> same cuts,
// every mount, forever. That is the whole point — recognition requires
// determinism, so there is no randomness anywhere in the depth derivation.
// Only a freshly-enrolled key (added at runtime, given a fresh random
// credential id) gets a NEW, still-deterministic-for-that-id profile.
//
// Enrollment plays a one-shot 700ms cutter pass: a cutting wheel sweeps the
// blade once and each notch STEPS to its final depth exactly as the wheel
// crosses it (a cutting wheel does not tween — it commits), with a brief
// --foreground burr flash at the instant of each cut. Removal runs the exact
// same traversal in "file" mode — every notch steps back to blank as the
// wheel passes — before the row collapses out of the list. Reduced motion
// skips both passes and lands directly on the finished (cut or blank) shape.
//
// Real list, real buttons, real text: name / created / last-used are plain
// DOM text beside the art, the SVG key is aria-hidden, and removal goes
// through an arm-then-confirm button (mirrors the repo's existing evict
// pattern) with a polite live-region announcement once it lands.
// ---------------------------------------------------------------------------

export interface Passkey {
  /** stable credential id — the ONLY input the bitting profile is derived from */
  id: string;
  /** device or credential label, e.g. "iPhone 16" */
  name: string;
  /** device glyph shown in the key's bow; inferred from `name` when omitted */
  device?: "phone" | "laptop" | "tablet" | "desktop" | "key" | "generic";
  /** epoch ms (or Date) this credential was enrolled */
  createdAt: number | Date;
  /** epoch ms (or Date) of last use; null/undefined = never used since enrollment */
  lastUsedAt?: number | Date | null;
}

export interface BittingCutProps {
  /** the starting set of enrolled passkeys, rendered already-cut (no entrance animation) */
  initialPasskeys?: Passkey[];
  /** stop offering "Add passkey" once the list reaches this size. default 6 */
  maxPasskeys?: number;
  /** accessible name for the list. default "Passkeys" */
  ariaLabel?: string;
  /** fired once a newly-generated passkey has been appended */
  onAdd?: (passkey: Passkey) => void;
  /** fired once a passkey has finished its removal (file + collapse) pass */
  onRemove?: (id: string) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// ---- deterministic bitting -------------------------------------------------

const N_NOTCHES = 6;
const N_LEVELS = 5; // depths 0..4
const CUT_MS = 700;
const ZERO_DEPTHS = new Array(N_NOTCHES).fill(0) as number[];
const CENTER_FRACTIONS = Array.from({ length: N_NOTCHES }, (_, i) => (i + 0.5) / N_NOTCHES);

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** pure function of `credentialId` — identical every call, every mount. */
function bittingDepths(credentialId: string): number[] {
  const depths: number[] = [];
  for (let i = 0; i < N_NOTCHES; i++) {
    depths.push(fnv1a(`${credentialId}#${i}`) % N_LEVELS);
  }
  return depths;
}

// ---- key geometry (single blade path, ring bow) ----------------------------

const BOW_CX = 16;
const BOW_CY = 20;
const BOW_R = 11;
const X0 = 27; // blade shoulder, meets the bow ring
const X1 = 100; // blade tip
const TOP = 15;
const BASE = 28;
const DEPTH_STEP = 2.6;
const VIEW_W = 112;
const VIEW_H = 40;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** the blade silhouette as ONE closed path — stepped cuts, never a smooth curve. */
function bladePath(depths: number[]): string {
  const n = depths.length;
  const cellW = (X1 - X0) / n;
  const xs = Array.from({ length: n + 1 }, (_, i) => X0 + i * cellW);
  const ys = depths.map((d) => BASE - d * DEPTH_STEP);
  let d = `M${round2(xs[0])},${TOP} L${round2(xs[n])},${TOP} L${round2(xs[n])},${round2(ys[n - 1])}`;
  for (let i = n - 1; i >= 0; i--) {
    d += ` L${round2(xs[i])},${round2(ys[i])}`;
    if (i > 0) d += ` L${round2(xs[i])},${round2(ys[i - 1])}`;
  }
  d += ` L${round2(xs[0])},${BASE} Z`;
  return d;
}

function notchCenters(): number[] {
  const cellW = (X1 - X0) / N_NOTCHES;
  return CENTER_FRACTIONS.map((_, i) => X0 + cellW * (i + 0.5));
}

// ---- device glyph (lives inside the bow ring) ------------------------------

type DeviceKind = NonNullable<Passkey["device"]>;

function inferDevice(name: string): DeviceKind {
  const n = name.toLowerCase();
  if (/ipad|tablet/.test(n)) return "tablet";
  if (/iphone|pixel|galaxy|android|phone/.test(n)) return "phone";
  if (/macbook|laptop|notebook|thinkpad|chromebook/.test(n)) return "laptop";
  if (/imac|mac mini|mac studio|desktop|\bpc\b|windows/.test(n)) return "desktop";
  if (/yubikey|titan|security key|\bkey\b/.test(n)) return "key";
  return "generic";
}

function DeviceGlyph({ kind }: { kind: DeviceKind }) {
  const stroke = { stroke: "var(--foreground)", strokeWidth: 1.1, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  switch (kind) {
    case "phone":
      return <rect x={-2.8} y={-5} width={5.6} height={10} rx={1.3} {...stroke} />;
    case "tablet":
      return <rect x={-4.2} y={-3.2} width={8.4} height={6.4} rx={1} {...stroke} />;
    case "laptop":
      return (
        <>
          <rect x={-3.4} y={-4.2} width={6.8} height={4.6} rx={0.6} {...stroke} />
          <line x1={-4.6} y1={1.6} x2={4.6} y2={1.6} {...stroke} />
        </>
      );
    case "desktop":
      return (
        <>
          <rect x={-3.6} y={-4.2} width={7.2} height={5} rx={0.6} {...stroke} />
          <line x1={0} y1={0.8} x2={0} y2={2.6} {...stroke} />
          <line x1={-2.2} y1={2.6} x2={2.2} y2={2.6} {...stroke} />
        </>
      );
    case "key":
      return (
        <>
          <rect x={-2.2} y={-4.2} width={4.4} height={6} rx={0.8} {...stroke} />
          <line x1={-1.4} y1={1.8} x2={-1.4} y2={3.6} {...stroke} />
          <line x1={1.4} y1={1.8} x2={1.4} y2={3.6} {...stroke} />
        </>
      );
    default:
      return <rect x={-2.3} y={-2.3} width={4.6} height={4.6} transform="rotate(45)" {...stroke} />;
  }
}

// ---- time formatting (SSR-safe: "now" arrives after mount) ----------------

const DAY_MS = 86400000;

function formatCreated(ts: number | Date): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(d);
}

function formatLastUsed(lastUsedAt: number | Date | null | undefined, now: number | null): string {
  if (lastUsedAt == null) return "Never used";
  if (now == null) return "…";
  const ts = lastUsedAt instanceof Date ? lastUsedAt.getTime() : lastUsedAt;
  const diff = Math.max(0, now - ts);
  if (diff < DAY_MS) return "Last used today";
  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return "Last used yesterday";
  if (days < 7) return `Last used ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Last used ${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return `Last used ${formatCreated(ts)}`;
}

function remainWord(n: number): string {
  return n === 1 ? "1 remains" : `${n} remain`;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// ---- row ---------------------------------------------------------------

type CutPhase = "entering" | "settled" | "filing" | "exiting";

interface RowState extends Passkey {
  cutPhase: CutPhase;
}

const NOTCH_X = notchCenters();

// KeyArt composes the bow ring, the device glyph, and the blade in one
// document (single viewBox, single stacking order) and owns the row's cutter
// animation: a smooth 700ms sweep of the cutter graphic, with each notch's
// depth stepping (never tweening) to its target the instant the sweep
// crosses it.
function KeyArt({
  credentialId,
  device,
  cutPhase,
  reducedMotion,
  onCutSettled,
  onFileSettled,
}: {
  credentialId: string;
  device: DeviceKind;
  cutPhase: CutPhase;
  reducedMotion: boolean;
  onCutSettled: () => void;
  onFileSettled: () => void;
}) {
  const target = useRef(bittingDepths(credentialId)).current;
  const [depths, setDepths] = useState<number[]>(() => (cutPhase === "settled" ? target : ZERO_DEPTHS));
  const [cutterRun, setCutterRun] = useState(false);
  const flashRefs = useRef<(SVGRectElement | null)[]>([]);

  function flashNotch(i: number) {
    const el = flashRefs.current[i];
    if (!el) return;
    el.style.transition = "none";
    el.style.opacity = "1";
    requestAnimationFrame(() => {
      el.style.transition = "opacity 160ms ease-out";
      el.style.opacity = "0";
    });
  }

  useEffect(() => {
    if (cutPhase !== "entering" && cutPhase !== "filing") return;
    const goal = cutPhase === "entering" ? target : ZERO_DEPTHS;
    const settle = cutPhase === "entering" ? onCutSettled : onFileSettled;

    if (reducedMotion) {
      setDepths(goal);
      settle();
      return;
    }

    setCutterRun(false);
    const raf = requestAnimationFrame(() => setCutterRun(true));
    const timers: ReturnType<typeof setTimeout>[] = [];
    CENTER_FRACTIONS.forEach((frac, i) => {
      timers.push(
        setTimeout(() => {
          setDepths((d) => {
            const next = d.slice();
            next[i] = goal[i];
            return next;
          });
          flashNotch(i);
        }, Math.round(frac * CUT_MS))
      );
    });
    timers.push(
      setTimeout(() => {
        setCutterRun(false);
        settle();
      }, CUT_MS + 30)
    );

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutPhase]);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="60" height="22" className="shrink-0">
      <circle cx={BOW_CX} cy={BOW_CY} r={BOW_R} fill="none" stroke="var(--foreground)" strokeWidth={3} />
      <g transform={`translate(${BOW_CX} ${BOW_CY})`}>
        <DeviceGlyph kind={device} />
      </g>
      <path d={bladePath(depths)} fill="var(--foreground)" />
      {NOTCH_X.map((x, i) => (
        <rect
          key={i}
          ref={(el) => {
            flashRefs.current[i] = el;
          }}
          x={x - 0.6}
          y={TOP - 4}
          width={1.2}
          height={BASE - TOP + 8}
          fill="var(--foreground)"
          opacity={0}
        />
      ))}
      <g className="ns-bc-cutter" data-run={cutterRun ? "go" : "idle"}>
        <line x1={X0} x2={X0} y1={TOP - 5} y2={BASE + 5} stroke="var(--foreground)" strokeWidth={1.4} />
        <circle cx={X0} cy={TOP - 7} r={2.2} fill="var(--foreground)" />
      </g>
    </svg>
  );
}

function PasskeyRow({
  row,
  armed,
  now,
  reducedMotion,
  onCutSettled,
  onFileSettled,
  onRequestRemove,
  onCancelArm,
}: {
  row: RowState;
  armed: boolean;
  now: number | null;
  reducedMotion: boolean;
  onCutSettled: (id: string) => void;
  onFileSettled: (id: string) => void;
  onRequestRemove: (id: string) => void;
  onCancelArm: (id: string) => void;
}) {
  const device = row.device ?? inferDevice(row.name);
  const busy = row.cutPhase !== "settled";
  const label = armed ? `Confirm remove ${row.name}` : `Remove ${row.name}`;

  return (
    <li
      data-collapsing={row.cutPhase === "exiting"}
      className="ns-bc-row"
    >
      <div className="ns-bc-row-clip">
        <div className="flex items-center gap-3 px-4 py-3">
          <KeyArt
            credentialId={row.id}
            device={device}
            cutPhase={row.cutPhase}
            reducedMotion={reducedMotion}
            onCutSettled={() => onCutSettled(row.id)}
            onFileSettled={() => onFileSettled(row.id)}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-ns-muted">
              Created {formatCreated(row.createdAt)} · {formatLastUsed(row.lastUsedAt, now)}
            </p>
          </div>
          <button
            type="button"
            className="ns-bc-btn shrink-0"
            data-armed={armed}
            disabled={busy}
            aria-label={label}
            onClick={() => onRequestRemove(row.id)}
            onBlur={() => onCancelArm(row.id)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && armed) onCancelArm(row.id);
            }}
          >
            {armed ? "Confirm" : "Remove"}
          </button>
        </div>
      </div>
    </li>
  );
}

// ---- root ---------------------------------------------------------------

const DEVICE_POOL: Array<{ name: string; device: DeviceKind }> = [
  { name: "iPhone 16", device: "phone" },
  { name: "MacBook Pro", device: "laptop" },
  { name: "iPad Air", device: "tablet" },
  { name: "YubiKey 5C", device: "key" },
  { name: "Pixel 9", device: "phone" },
  { name: "Mac Studio", device: "desktop" },
];

function newPasskey(existingCount: number): Passkey {
  const pick = DEVICE_POOL[existingCount % DEVICE_POOL.length];
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, name: pick.name, device: pick.device, createdAt: Date.now(), lastUsedAt: null };
}

export function BittingCut({
  initialPasskeys,
  maxPasskeys = 6,
  ariaLabel = "Passkeys",
  onAdd,
  onRemove,
  className = "",
}: BittingCutProps) {
  const uid = useId();
  const reducedMotion = useReducedMotion();
  const [rows, setRows] = useState<RowState[]>(() =>
    (initialPasskeys ?? []).map((p) => ({ ...p, cutPhase: "settled" as CutPhase }))
  );
  const [armedId, setArmedId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const atMax = rows.length >= maxPasskeys;

  function handleAdd() {
    if (atMax) return;
    const pk = newPasskey(rows.length);
    setRows((rs) => [...rs, { ...pk, cutPhase: "entering" }]);
    onAdd?.(pk);
  }

  function handleCutSettled(id: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, cutPhase: "settled" } : r)));
  }

  function handleRequestRemove(id: string) {
    if (armedId === id) {
      setArmedId(null);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, cutPhase: "filing" } : r)));
    } else {
      setArmedId(id);
    }
  }

  function handleCancelArm(id: string) {
    setArmedId((cur) => (cur === id ? null : cur));
  }

  function handleFileSettled(id: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, cutPhase: "exiting" } : r)));
    const delay = reducedMotion ? 0 : 260;
    setTimeout(() => {
      setRows((rs) => {
        const target = rs.find((r) => r.id === id);
        const next = rs.filter((r) => r.id !== id);
        if (target) {
          onRemove?.(id);
          setAnnounce(`Passkey ${target.name} removed, ${remainWord(next.length)}.`);
        }
        return next;
      });
    }, delay);
  }

  return (
    <div className={["ns-bc", className].join(" ")}>
      <style>{CSS}</style>

      <div className="flex items-center justify-between gap-3 pb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ns-muted">Sign-in methods</p>
        <div className="flex items-center gap-2">
          {atMax && <span className="font-mono text-[10px] text-ns-muted">Maximum reached</span>}
          <button
            type="button"
            className="ns-bc-btn ns-bc-add"
            disabled={atMax}
            aria-label="Add passkey"
            onClick={handleAdd}
          >
            Add passkey
          </button>
        </div>
      </div>

      <ul role="list" aria-label={ariaLabel} id={`${uid}-list`} className="ns-bc-list rounded-[12px] border border-border bg-background">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center font-mono text-xs text-ns-muted">No passkeys enrolled.</li>
        ) : (
          rows.map((row) => (
            <PasskeyRow
              key={row.id}
              row={row}
              armed={armedId === row.id}
              now={now}
              reducedMotion={reducedMotion}
              onCutSettled={handleCutSettled}
              onFileSettled={handleFileSettled}
              onRequestRemove={handleRequestRemove}
              onCancelArm={handleCancelArm}
            />
          ))
        )}
      </ul>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>
    </div>
  );
}

const CSS = `
.ns-bc-list{overflow:hidden}
.ns-bc-row{display:grid;grid-template-rows:1fr;opacity:1;transition:grid-template-rows 260ms cubic-bezier(.22,1,.36,1),opacity 260ms ease-out}
.ns-bc-row[data-collapsing="true"]{grid-template-rows:0fr;opacity:0}
.ns-bc-row-clip{overflow:hidden;min-height:0;transition:background-color 150ms ease-out}
.ns-bc-row-clip:hover{background:color-mix(in srgb, var(--foreground) 4%, transparent)}
.ns-bc-row + .ns-bc-row > .ns-bc-row-clip{border-top:1px solid var(--border)}
.ns-bc-cutter{opacity:0;transform:translateX(0)}
.ns-bc-cutter[data-run="go"]{opacity:1;transform:translateX(${X1 - X0}px);transition:transform ${CUT_MS}ms cubic-bezier(.4,0,.2,1),opacity 120ms ease-out}
.ns-bc-btn{display:inline-flex;height:26px;align-items:center;justify-content:center;border-radius:6px;padding:0 10px;border:1px solid var(--border);background:var(--background);color:var(--ns-muted);font-family:var(--font-geist-mono,ui-monospace,monospace);font-size:11px;transition:background-color 150ms ease-out,color 150ms ease-out,border-color 150ms ease-out,box-shadow 150ms ease-out}
.ns-bc-btn:hover:not(:disabled){color:var(--foreground);border-color:var(--foreground)}
.ns-bc-btn:disabled{opacity:0.45}
.ns-bc-btn:focus-visible{outline:2px solid var(--ns-accent);outline-offset:2px}
.ns-bc-btn[data-armed="true"]{color:var(--ns-accent);border-color:var(--ns-accent)}
.ns-bc-add{color:var(--foreground)}
@media (prefers-reduced-motion: reduce){
  .ns-bc-row,.ns-bc-cutter,.ns-bc-btn,.ns-bc-row-clip{transition:none!important}
}
`;

export default BittingCut;
