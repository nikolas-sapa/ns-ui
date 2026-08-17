"use client";

import { useEffect, useId, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// TallyCleave — an org invite list where every invite IS a split wooden
// tally: two halves of one object, matched later. Creating an invite cleaves
// a stock/foil pair along a jagged seam derived from the invite's token; the
// org keeps the stock (always solid), the row shows the foil as a GHOST
// outline (nothing there yet — the invitee hasn't produced their half).
// Accepting slides the ghost in on a spring, lets it go solid, and the
// shared grain lines — drawn to terminate exactly on the seam's own
// coordinates — become numerically continuous the instant the gap closes.
// That continuity is the proof, not decoration.
//
// SEAM GEOMETRY IS A PURE FUNCTION OF THE TOKEN (`invite.id`): fnv1a-hash
// six interior sample rows, offset each left/right by the hash, memoized
// once per id. That single offsets array is used TWICE — once (added to a
// fixed baseline) as the stock's right edge, once (as-is) as the foil's
// left edge — "drawn once, mirrored" rather than hashed independently per
// piece, which is what makes the eventual alignment a real geometric fact
// instead of a coincidence. A decorative stock zigzag (same wiggle on every
// invite) is the explicitly forbidden alternative: it would fake the
// matching claim this component exists to make.
//
// EXPIRY has no separate code path. `t`, the TTL fraction elapsed, is the
// one governing scalar: erosionScale = 1 - t shrinks the same offsets
// toward a flat line, and presence opacity fades with it. At t=1 the seam
// is a flat, faint line — indistinguishable from any other expired invite's
// flat faint line — which is itself the argument for why a fresh invite,
// not a renewed one, is required. Accepted rows fix t at 0 forever: once
// matched, the record is sealed and does not keep eroding.
//
// State lives in text ("Pending, expires in 6 days" / "Accepted by sam@ on
// March 4"); the SVG is aria-hidden redundant encoding. Accept is a real
// button. Completion announces once, politely. Creation is silent, mirroring
// this repo's existing add/remove asymmetry (bitting-cut).
// ---------------------------------------------------------------------------

export interface Invite {
  /** stable token — the ONLY input the seam geometry is derived from */
  id: string;
  email: string;
  role: string;
  createdAt: number;
  /** milliseconds this invite stays valid from createdAt */
  ttlMs: number;
  status: "pending" | "accepted";
  /** set once accepted — who claimed it */
  acceptedBy?: string;
  acceptedAt?: number;
}

export interface TallyCleaveProps {
  /** starting invites, rendered with no entrance animation */
  initialInvites?: Invite[];
  /** roles offered in the create form. default ["Viewer","Editor","Admin"] */
  roles?: string[];
  /** TTL applied to invites created through the form. default 7 days */
  defaultTtlMs?: number;
  /** stop offering "Send invite" once the list reaches this size. default 8 */
  maxInvites?: number;
  /** accessible name for the list. default "Org invites" */
  ariaLabel?: string;
  onCreate?: (invite: Invite) => void;
  onAccept?: (invite: Invite) => void;
  className?: string;
}

// ---- deterministic seam ----------------------------------------------------

const SEAM_ROWS = 7; // indices 0..6, endpoints flush (offset 0)
const GRAIN_ROWS = [2, 4];
const MAX_AMP = 7;
const STOCK_W = 54;
const FOIL_W = 54;
const GAP_PX = 11;
const H = 30;
const TOTAL_W = STOCK_W + GAP_PX + FOIL_W;

const YS = Array.from({ length: SEAM_ROWS }, (_, i) => (i * H) / (SEAM_ROWS - 1));

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** pure function of `token` — identical every call, every mount, forever. */
function seamOffsets(token: string): number[] {
  const offsets: number[] = [0];
  for (let i = 1; i < SEAM_ROWS - 1; i++) {
    const frac = (fnv1a(`${token}#${i}`) % 1000) / 1000; // 0..1
    offsets.push(round2((frac - 0.5) * 2 * MAX_AMP));
  }
  offsets.push(0);
  return offsets;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function stockPath(offsets: number[], scale: number): string {
  const pts = offsets.map((o, i) => [round2(STOCK_W + o * scale), YS[i]] as const);
  const rest = pts
    .slice(1)
    .map(([x, y]) => ` L${x},${y}`)
    .join("");
  return `M0,0 L${pts[0][0]},${pts[0][1]}${rest} L0,${H} Z`;
}

function foilPath(offsets: number[], scale: number): string {
  const pts = offsets.map((o, i) => [round2(o * scale), YS[i]] as const);
  const rest = pts
    .slice(1)
    .map(([x, y]) => ` L${x},${y}`)
    .join("");
  return `M${pts[0][0]},${pts[0][1]}${rest} L${FOIL_W},${H} L${FOIL_W},0 Z`;
}

function stockSeamPts(offsets: number[], scale: number): string {
  return offsets.map((o, i) => `${round2(STOCK_W + o * scale)},${YS[i]}`).join(" ");
}

function foilSeamPts(offsets: number[], scale: number): string {
  return offsets.map((o, i) => `${round2(o * scale)},${YS[i]}`).join(" ");
}

// ---- time / status ----------------------------------------------------

const MIN_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;

function formatRemain(ms: number): string {
  if (ms >= DAY_MS) {
    const d = Math.round(ms / DAY_MS);
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  if (ms >= HOUR_MS) {
    const h = Math.round(ms / HOUR_MS);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const m = Math.max(1, Math.round(ms / MIN_MS));
  return `${m} minute${m === 1 ? "" : "s"}`;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date(ts));
}

function localHandle(email: string): string {
  const at = email.indexOf("@");
  return at === -1 ? email : `${email.slice(0, at)}@`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function ttlFraction(invite: Invite, now: number | null): number {
  if (now == null) return 0;
  const elapsed = now - invite.createdAt;
  return Math.min(1, Math.max(0, elapsed / invite.ttlMs));
}

function statusText(invite: Invite, now: number | null): string {
  if (invite.status === "accepted") {
    return `Accepted by ${localHandle(invite.acceptedBy ?? invite.email)} on ${formatDate(invite.acceptedAt ?? invite.createdAt)}`;
  }
  if (now == null) return "Pending";
  const remain = invite.createdAt + invite.ttlMs - now;
  if (remain <= 0) return "Expired — send a fresh invite to reconnect";
  return `Pending, expires in ${formatRemain(remain)}`;
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

// ---- tally art ---------------------------------------------------------

function TallyArt({ invite, now }: { invite: Invite; now: number | null }) {
  const offsets = useMemo(() => seamOffsets(invite.id), [invite.id]);
  const accepted = invite.status === "accepted";
  const t = accepted ? 0 : ttlFraction(invite, now);
  const expired = !accepted && now != null && t >= 1;
  const scale = 1 - t;

  const seamOpacity = accepted ? 0.22 : round2(0.9 - t * 0.65);
  const grainOpacity = accepted ? 0.75 : round2(0.6 - t * 0.4);
  const ghostOpacity = round2(0.55 - t * 0.35);
  const gap = accepted ? 0 : GAP_PX;

  const stockD = stockPath(offsets, scale);
  const foilD = foilPath(offsets, scale);
  const stockSeam = stockSeamPts(offsets, scale);
  const foilSeam = foilSeamPts(offsets, scale);

  return (
    <svg
      aria-hidden="true"
      viewBox={`-1 0 ${TOTAL_W + 2} ${H}`}
      width={132}
      height={34}
      className="shrink-0"
      style={{ ["--tc-gap" as string]: `${gap}px` }}
    >
      <g>
        <path d={stockD} className="ns-tc-piece" stroke="var(--border)" strokeWidth={0.75} />
        <polyline
          className="ns-tc-seam"
          points={stockSeam}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1.1}
          style={{ ["--tc-seam-op" as string]: seamOpacity }}
        />
        {GRAIN_ROWS.map((r) => (
          <line
            key={r}
            className="ns-tc-grain"
            x1={6}
            y1={YS[r]}
            x2={round2(STOCK_W + offsets[r] * scale)}
            y2={YS[r]}
            stroke="var(--ns-muted)"
            strokeWidth={0.9}
            style={{ ["--tc-grain-op" as string]: grainOpacity }}
          />
        ))}
      </g>
      <g className="ns-tc-foil" data-status={accepted ? "accepted" : expired ? "expired" : "pending"}>
        <path
          d={foilD}
          fill={accepted ? "var(--foreground)" : "none"}
          stroke={accepted ? "var(--border)" : "var(--foreground)"}
          strokeWidth={0.75}
          strokeDasharray={accepted ? undefined : "3 2"}
          style={accepted ? undefined : { opacity: ghostOpacity }}
        />
        <polyline
          className="ns-tc-seam"
          points={foilSeam}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1.1}
          style={{ ["--tc-seam-op" as string]: seamOpacity }}
        />
        {accepted &&
          GRAIN_ROWS.map((r) => (
            <line
              key={r}
              className="ns-tc-grain"
              x1={round2(offsets[r] * scale)}
              y1={YS[r]}
              x2={FOIL_W - 6}
              y2={YS[r]}
              stroke="var(--ns-muted)"
              strokeWidth={0.9}
              style={{ ["--tc-grain-op" as string]: grainOpacity }}
            />
          ))}
      </g>
    </svg>
  );
}

// ---- row ---------------------------------------------------------------

function InviteRow({
  invite,
  now,
  matched,
  onAccept,
}: {
  invite: Invite;
  now: number | null;
  matched: boolean;
  onAccept: (id: string) => void;
}) {
  const accepted = invite.status === "accepted";
  const expired = !accepted && now != null && ttlFraction(invite, now) >= 1;
  const derivedStatus = accepted ? "accepted" : expired ? "expired" : "pending";

  return (
    <li data-status={derivedStatus} data-matched={matched ? "true" : "false"} className="ns-tc-row">
      <div className="flex items-center gap-3 px-4 py-3">
        <TallyArt invite={invite} now={now} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {invite.email} <span className="text-ns-muted">— {invite.role}</span>
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-ns-muted">{statusText(invite, now)}</p>
        </div>
        {!accepted && !expired && (
          <button
            type="button"
            data-action="accept"
            className="ns-tc-btn shrink-0"
            aria-label={`Accept invite for ${invite.email}`}
            onClick={() => onAccept(invite.id)}
          >
            Accept
          </button>
        )}
      </div>
    </li>
  );
}

// ---- root ---------------------------------------------------------------

const DEFAULT_ROLES = ["Viewer", "Editor", "Admin"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `inv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TallyCleave({
  initialInvites,
  roles = DEFAULT_ROLES,
  defaultTtlMs = 7 * DAY_MS,
  maxInvites = 8,
  ariaLabel = "Org invites",
  onCreate,
  onAccept,
  className = "",
}: TallyCleaveProps) {
  const uid = useId();
  const reducedMotion = useReducedMotion();
  const [invites, setInvites] = useState<Invite[]>(initialInvites ?? []);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(() => new Set());
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[Math.min(1, roles.length - 1)] ?? roles[0]);
  const [announce, setAnnounce] = useState("");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const atMax = invites.length >= maxInvites;
  const emailValid = EMAIL_RE.test(email.trim());

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (atMax || !emailValid) return;
    const invite: Invite = {
      id: newId(),
      email: email.trim(),
      role,
      createdAt: Date.now(),
      ttlMs: defaultTtlMs,
      status: "pending",
    };
    setInvites((rows) => [...rows, invite]);
    onCreate?.(invite);
    setEmail("");
  }

  function handleAccept(id: string) {
    const target = invites.find((r) => r.id === id);
    if (!target || target.status === "accepted") return;
    const acceptedAt = Date.now();
    const accepted: Invite = { ...target, status: "accepted", acceptedBy: target.email, acceptedAt };
    setInvites((rows) => rows.map((r) => (r.id === id ? accepted : r)));
    setMatchedIds((s) => new Set(s).add(id));
    setAnnounce(`Invite matched, ${capitalize(target.email.split("@")[0])} added as ${target.role}.`);
    onAccept?.(accepted);
  }

  return (
    <div className={["ns-tc", reducedMotion ? "ns-tc-reduced" : "", className].join(" ").trim()}>
      <style>{CSS}</style>

      <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2 pb-3">
        <label htmlFor={`${uid}-email`} className="sr-only">
          Invite email address
        </label>
        <input
          id={`${uid}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          disabled={atMax}
          className="ns-tc-input min-w-0 flex-1"
        />
        <label htmlFor={`${uid}-role`} className="sr-only">
          Invite role
        </label>
        <select
          id={`${uid}-role`}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={atMax}
          className="ns-tc-input"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="ns-tc-btn ns-tc-add shrink-0"
          disabled={atMax || !emailValid}
          aria-label="Send invite"
        >
          Send invite
        </button>
        {atMax && <span className="font-mono text-[10px] text-ns-muted">Maximum reached</span>}
      </form>

      <ul
        role="list"
        aria-label={ariaLabel}
        className="ns-tc-list rounded-[12px] border border-border bg-background"
      >
        {invites.length === 0 ? (
          <li className="px-4 py-6 text-center font-mono text-xs text-ns-muted">No invites yet.</li>
        ) : (
          invites.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              now={now}
              matched={matchedIds.has(invite.id)}
              onAccept={handleAccept}
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
.ns-tc-list{overflow:hidden}
.ns-tc-row + .ns-tc-row{border-top:1px solid var(--border)}
.ns-tc-row:hover{background:color-mix(in srgb, var(--foreground) 4%, transparent)}
.ns-tc-foil{transform:translateX(calc(${STOCK_W}px + var(--tc-gap,0px)));transition:transform 480ms cubic-bezier(.22,1.7,.36,1)}
.ns-tc-seam{opacity:var(--tc-seam-op,0.85);transition:opacity 260ms ease-out}
.ns-tc-grain{opacity:var(--tc-grain-op,0.6);transition:opacity 260ms ease-out}
li[data-status="accepted"] .ns-tc-seam,li[data-status="accepted"] .ns-tc-grain{transition-delay:460ms}
.ns-tc-input{height:30px;border-radius:6px;border:1px solid var(--border);background:var(--background);color:var(--foreground);padding:0 10px;font-family:var(--font-geist-sans,ui-sans-serif,sans-serif);font-size:13px}
.ns-tc-input:focus-visible{outline:2px solid var(--ns-accent);outline-offset:2px}
.ns-tc-input:disabled{opacity:0.5}
.ns-tc-btn{display:inline-flex;height:30px;align-items:center;justify-content:center;border-radius:6px;padding:0 12px;border:1px solid var(--border);background:var(--background);color:var(--ns-muted);font-family:var(--font-geist-mono,ui-monospace,monospace);font-size:11px;transition:background-color 150ms ease-out,color 150ms ease-out,border-color 150ms ease-out}
.ns-tc-btn:hover:not(:disabled){color:var(--foreground);border-color:var(--foreground)}
.ns-tc-btn:disabled{opacity:0.45}
.ns-tc-btn:focus-visible{outline:2px solid var(--ns-accent);outline-offset:2px}
.ns-tc-add{color:var(--foreground)}
@media (prefers-reduced-motion: reduce){
  .ns-tc-foil,.ns-tc-seam,.ns-tc-grain{transition:none!important}
}
.ns-tc-reduced .ns-tc-foil,.ns-tc-reduced .ns-tc-seam,.ns-tc-reduced .ns-tc-grain{transition:none!important}
`;

export default TallyCleave;
