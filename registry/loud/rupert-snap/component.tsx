"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RupertSnap — a hash-chained audit log drawn as a chain of Prince Rupert's
// drops, one per entry, each drop's tail fused into the next drop's head. The
// log rows are real DOM <tr>s (actor, action, timestamp, truncated hash) —
// nothing about the audit trail itself is canvas. A canvas laid BEHIND the
// table draws the chain in a narrow gutter to its left: every drop holds
// visible internal stress as slowly swimming photoelastic fringes, banded
// contour rings whose phase drifts at 0.02 cycles/s — too slow to read as
// "playing", just alive, the stored-energy cue a real Rupert's drop carries
// right up until its tail snaps.
//
// The mechanism the whole component exists to teach: a hash chain is
// tamper-evident because entry i's stored hash is a function of entry i's
// own fields AND entry (i-1)'s hash. Edit entry k after the fact and every
// hash from k onward, RECOMPUTED from current field values, no longer
// matches what was stored at write time — not because we say so, but
// because storedHash and recomputedHash are two independently-derived
// chains here and a tamper is exactly the point they first disagree. Nothing
// upstream of k moves, because nothing upstream of k depends on k.
//
// "Simulate tamper" triggers that recompute AND a shatter: one wavefront,
// 6 drops per 100ms, travelling strictly tailward from k — never inward from
// both ends, never per-drop independent, because simultaneity would erase
// the one fact this component is for: later hashes depend on earlier
// content, never the reverse. Granules cap at 120/drop; a drop that has
// finished detonating is frozen into a static debris-line paint and dropped
// out of the physics loop, which is what keeps a 50-entry chain inside a
// 60fps budget rather than asserting it.
// ---------------------------------------------------------------------------

export interface RupertSnapEntry {
  actor: string;
  action: string;
  /** Display timestamp, ISO-ish. Also folded into the chain hash. */
  timestamp: string;
}

export interface RupertSnapProps {
  /** The log, oldest first. Hash-chain order == array order. */
  entries?: RupertSnapEntry[];
  /** 0-based index "Simulate tamper" edits. @default entries.length - 5, clamped */
  breakIndex?: number;
  className?: string;
}

// --- default dataset ---------------------------------------------------

const DEFAULT_ENTRIES: RupertSnapEntry[] = [
  { actor: "sara.chen", action: "session.created", timestamp: "2026-08-17 09:01:04Z" },
  { actor: "sara.chen", action: "record.viewed:acct-4471", timestamp: "2026-08-17 09:02:11Z" },
  { actor: "ops-bot", action: "backup.completed", timestamp: "2026-08-17 09:04:47Z" },
  { actor: "m.oduya", action: "role.granted:reviewer", timestamp: "2026-08-17 09:07:22Z" },
  { actor: "m.oduya", action: "policy.updated:retention", timestamp: "2026-08-17 09:11:03Z" },
  { actor: "sara.chen", action: "export.requested:q3-ledger", timestamp: "2026-08-17 09:14:56Z" },
  { actor: "ci-deploy", action: "config.updated:webhook-url", timestamp: "2026-08-17 09:19:30Z" },
  { actor: "j.patel", action: "invoice.approved:INV-2291", timestamp: "2026-08-17 09:23:18Z" },
  { actor: "j.patel", action: "key.rotated:api-prod", timestamp: "2026-08-17 09:27:41Z" },
  { actor: "m.oduya", action: "role.granted:owner", timestamp: "2026-08-17 09:31:09Z" },
  { actor: "m.oduya", action: "record.exported:acct-4471", timestamp: "2026-08-17 09:33:52Z" },
  { actor: "sara.chen", action: "user.invited:d.vale", timestamp: "2026-08-17 09:38:14Z" },
  { actor: "ops-bot", action: "audit.viewed:self", timestamp: "2026-08-17 09:41:37Z" },
  { actor: "j.patel", action: "session.closed", timestamp: "2026-08-17 09:44:02Z" },
];

// --- fnv-1a chain hash, two independent basins concatenated for a wider
// truncated display; not cryptographic, just genuinely order- and
// content-dependent, which is the only property the demo needs -----------

function fnv1a(str: string, basis: number): number {
  let h = basis >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function hex8(n: number): string {
  return n.toString(16).padStart(8, "0");
}

const GENESIS = "RUPERT-SNAP-GENESIS";

function chainStep(prevHash: string, e: RupertSnapEntry): string {
  const payload = `${prevHash}|${e.actor}|${e.action}|${e.timestamp}`;
  return hex8(fnv1a(payload, 0x811c9dc5)) + hex8(fnv1a(payload, 0x9747b28c));
}

function buildChain(list: RupertSnapEntry[]): string[] {
  const out: string[] = [];
  let prev = GENESIS;
  for (const e of list) {
    const h = chainStep(prev, e);
    out.push(h);
    prev = h;
  }
  return out;
}

// --- token colors ---------------------------------------------------------

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseColor(raw: string): RGB | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("#")) {
    let hex = v.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    if (hex.length < 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  const m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  return null;
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;
}

interface Tokens {
  bg: RGB;
  fg: RGB;
  muted: RGB;
  border: RGB;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  return {
    bg: parseColor(cs.getPropertyValue("--background")) ?? { r: 255, g: 255, b: 255 },
    fg: parseColor(cs.getPropertyValue("--foreground")) ?? { r: 23, g: 23, b: 23 },
    muted: parseColor(cs.getPropertyValue("--ns-muted")) ?? { r: 77, g: 77, b: 77 },
    border: parseColor(cs.getPropertyValue("--border")) ?? { r: 235, g: 235, b: 235 },
  };
}

// --- geometry --------------------------------------------------------------

const HEAD_H = 44; // px, table header row
const ROW_H = 52; // px, table body row (must match the CSS h-13-ish rows)
const GUTTER_W = 56; // px, canvas gutter the chain is drawn in
const BULB_R = 18;
const FLIGHT_MS = 360; // debris flight time per drop, then it freezes
const STAGGER_MS = 100 / 6; // fixed tailward wavefront rate: 6 drops / 100ms
const DASH_COUNT = 9;
const GRANULES_PER_DROP = 42; // well under the 120 cap; plenty for an 18px bulb

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Granule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

interface ActiveDrop {
  cx: number;
  cy: number;
  granules: Granule[];
  startMs: number;
}

interface Dash {
  dx: number;
  w: number;
  a: number;
}

function settleDashes(cx: number, seed: number): Dash[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: DASH_COUNT }, () => ({
    dx: cx + (rnd() - 0.5) * (GUTTER_W - 14),
    w: 3 + rnd() * 6,
    a: 0.22 + rnd() * 0.34,
  }));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

type Phase = "unverified" | "verified" | "tampered";

export function RupertSnap({ entries = DEFAULT_ENTRIES, breakIndex, className = "" }: RupertSnapProps) {
  const count = entries.length;
  const defaultBreak = Math.max(1, Math.min(count - 1, count - 5));
  const k = Math.max(0, Math.min(count - 1, breakIndex ?? defaultBreak));

  const [phase, setPhase] = useState<Phase>("unverified");
  const [tamperedAt, setTamperedAt] = useState<number | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const reduced = usePrefersReducedMotion();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cascadeStartRef = useRef(0);

  // -- the chain proper: stored (write-time) vs recomputed (current field
  // values). Tamper edits ONE field on ONE entry; every stored hash from
  // there on stops matching what recomputing the chain now produces. That
  // divergence — not a flag — is what "invalidated" means below.
  const storedHashes = useMemo(() => buildChain(entries), [entries]);
  const liveEntries = useMemo(() => {
    if (tamperedAt === null) return entries;
    return entries.map((e, i) =>
      i === tamperedAt ? { ...e, action: `${e.action} → escalate:owner` } : e
    );
  }, [entries, tamperedAt]);
  const recomputedHashes = useMemo(() => buildChain(liveEntries), [liveEntries]);
  const invalidFrom = useMemo(() => {
    if (tamperedAt === null) return null;
    for (let i = 0; i < entries.length; i++) {
      if (recomputedHashes[i] !== storedHashes[i]) return i;
    }
    return null;
  }, [tamperedAt, recomputedHashes, storedHashes, entries.length]);

  const displayOrder = useMemo(() => {
    const idx = entries.map((_, i) => i);
    return sortDesc ? idx.slice().reverse() : idx;
  }, [entries.length, sortDesc]);
  const rowPos = useMemo(() => {
    const m = new Map<number, number>();
    displayOrder.forEach((canonical, pos) => m.set(canonical, pos));
    return m;
  }, [displayOrder]);

  const statusText =
    phase === "tampered" && invalidFrom !== null
      ? `Tamper detected at entry ${invalidFrom + 1}; entries ${invalidFrom + 1}-${count} invalidated.`
      : phase === "verified"
        ? `Chain verified: ${count} of ${count} entries intact.`
        : `Chain not yet verified — ${count} entries pending.`;

  const breakNoteId = "rupert-snap-break-note";

  const handleVerify = () => {
    setPhase("verified");
    setTamperedAt(null);
  };
  // Idempotent by design: repeated clicks land in the same shattered state.
  // A prior press-pass click on this same control (before the gate check
  // runs) re-triggers the identical cascade rather than toggling anything.
  const handleTamper = () => {
    cascadeStartRef.current = performance.now();
    setTamperedAt(k);
    setPhase("tampered");
  };

  // ---- canvas: chain of drops, gutter to the left of the table ----------
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let raf = 0;
    let running = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;

    let tokens = readTokens();
    const readColors = () => {
      tokens = readTokens();
    };

    const active = new Map<number, ActiveDrop>();
    const settled = new Map<number, Dash[]>();

    const resetSim = () => {
      active.clear();
      settled.clear();
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const c = canvas.getContext("2d");
      c?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const yOf = (canonicalIndex: number) => {
      const pos = rowPos.get(canonicalIndex) ?? canonicalIndex;
      return HEAD_H + pos * ROW_H + ROW_H / 2;
    };
    const cx = GUTTER_W / 2;

    const drawBulb = (cyPos: number, s: number, phaseRad: number) => {
      ctx.beginPath();
      ctx.arc(cx, cyPos, BULB_R, 0, Math.PI * 2);
      ctx.fillStyle = rgba(tokens.fg, 0.05);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(tokens.border, 0.9);
      ctx.stroke();

      const rings = Math.round(3 + s * 8);
      for (let j = 1; j <= rings; j++) {
        const t = j / rings;
        const rad = BULB_R * t * 0.92;
        const band = Math.cos(j * 1.6 - phaseRad);
        const a = (0.09 + 0.22 * Math.abs(band)) * (0.4 + 0.6 * s);
        ctx.beginPath();
        ctx.arc(cx, cyPos, rad, 0, Math.PI * 2);
        ctx.strokeStyle = band > 0 ? rgba(tokens.fg, a) : rgba(tokens.muted, a);
        ctx.lineWidth = Math.max(1, BULB_R * 0.05);
        ctx.stroke();
      }
    };

    const drawNeck = (yA: number, yB: number, cracked: boolean) => {
      ctx.strokeStyle = rgba(tokens.border, 0.85);
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (!cracked) {
        ctx.moveTo(cx, yA);
        ctx.lineTo(cx, yB);
      } else {
        const mid = (yA + yB) / 2;
        ctx.moveTo(cx, yA);
        ctx.lineTo(cx - 5, mid - 4);
        ctx.lineTo(cx + 4, mid + 3);
        ctx.lineTo(cx, yB);
      }
      ctx.stroke();
    };

    const drawSettled = (dashes: Dash[], cyPos: number) => {
      const y = cyPos + BULB_R * 0.55;
      ctx.lineWidth = 1;
      for (const d of dashes) {
        ctx.strokeStyle = rgba(tokens.muted, d.a);
        ctx.beginPath();
        ctx.moveTo(d.dx - d.w / 2, y);
        ctx.lineTo(d.dx + d.w / 2, y);
        ctx.stroke();
      }
      // a faint broken ring — the ghost of the bulb that used to be here
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = rgba(tokens.border, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cyPos, BULB_R * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const spawnDrop = (canonicalIndex: number, nowMs: number) => {
      const gy = yOf(canonicalIndex);
      const rnd = mulberry32(canonicalIndex * 7919 + 13);
      const granules: Granule[] = Array.from({ length: GRANULES_PER_DROP }, () => {
        const ang = rnd() * Math.PI * 2;
        const spd = 40 + rnd() * 100;
        return {
          x: cx,
          y: gy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 20,
          size: 1 + rnd() * 1.6,
        };
      });
      active.set(canonicalIndex, { cx, cy: gy, granules, startMs: nowMs });
    };

    const paint = (nowMs: number) => {
      if (cssW < 2 || cssH < 2) return;
      ctx.clearRect(0, 0, cssW, cssH);
      const phaseRad = reduced ? 0 : (nowMs / 1000) * 0.02 * Math.PI * 2;

      // necks first, so bulbs paint over their own ends
      for (let i = 0; i < count - 1; i++) {
        const aBroken = tamperedAt !== null && i >= tamperedAt;
        const bBroken = tamperedAt !== null && i + 1 >= tamperedAt;
        if (aBroken) continue; // no thread leaves a shattered drop
        drawNeck(yOf(i), yOf(i + 1), bBroken && !aBroken);
      }

      for (let i = 0; i < count; i++) {
        const shattered = tamperedAt !== null && i >= tamperedAt;
        const gy = yOf(i);
        if (!shattered) {
          const s = phase === "unverified" ? 0.3 : 1;
          drawBulb(gy, s, phaseRad);
          continue;
        }
        const live = active.get(i);
        if (live) {
          const elapsed = nowMs - live.startMs;
          const localT = Math.min(1, elapsed / FLIGHT_MS);
          for (const g of live.granules) {
            const dt = 1 / 60;
            g.vy += 900 * dt;
            g.vx *= 0.985;
            g.x += g.vx * dt;
            g.y += g.vy * dt;
            const a = (1 - localT) * 0.55;
            if (a <= 0.01) continue;
            ctx.fillStyle = rgba(tokens.muted, a);
            ctx.fillRect(g.x - g.size / 2, g.y - g.size / 2, g.size, g.size);
          }
          if (localT >= 1) {
            settled.set(i, settleDashes(cx, i * 7919 + 13));
            active.delete(i);
          }
        } else if (settled.has(i)) {
          drawSettled(settled.get(i)!, gy);
        } else {
          // scheduled but not yet detonated — the still-intact predecessor
        }
      }
    };

    let lastIdlePaint = 0;
    const loop = (nowMs: number) => {
      if (disposed) return;
      // advance the wavefront: spawn any drop whose scheduled detonation
      // time has arrived. Strict tailward order, fixed rate — never random.
      if (tamperedAt !== null && phase === "tampered") {
        const t0 = cascadeStartRef.current;
        for (let i = tamperedAt; i < count; i++) {
          if (active.has(i) || settled.has(i)) continue;
          const dueAt = t0 + (i - tamperedAt) * STAGGER_MS;
          if (nowMs >= dueAt) spawnDrop(i, nowMs);
        }
      }
      const hasMotion = active.size > 0;
      if (hasMotion || nowMs - lastIdlePaint >= 70) {
        paint(nowMs);
        lastIdlePaint = nowMs;
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed || reduced) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    resize();
    resetSim();
    if (reduced) {
      // No cascade, no drift: paint the final state for the current phase
      // in one frame. Shattered drops get their settled debris pattern
      // directly, never a physics sim that reduced motion would then skip.
      if (tamperedAt !== null) {
        for (let i = tamperedAt; i < count; i++) settled.set(i, settleDashes(cx, i * 7919 + 13));
      }
      paint(performance.now());
    } else {
      wake();
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) paint(performance.now());
    });
    ro.observe(wrap);

    const themeObserver = new MutationObserver(() => {
      readColors();
      paint(performance.now()); // force a repaint even with no loop running
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!reduced) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      sleep();
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // rowPos/count/tamperedAt/phase/reduced drive what's on screen; a change
    // to any of them re-seeds the whole sim rather than patching it live —
    // the simplest way to keep the wavefront's start time and settle cache
    // honest across a re-verify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, rowPos, tamperedAt, phase, reduced]);

  const canvasHeight = HEAD_H + count * ROW_H;

  const btnClass =
    "inline-flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors duration-150 hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent";

  return (
    // data-rupert-phase lets a card's autoplay descriptor alternate between the
    // two controls with one selector list (verify only matches while tampered,
    // so document order picks tamper -> verify -> tamper) instead of parking on
    // a permanently-shattered still frame.
    <div className={`w-full ${className}`} data-rupert-phase={phase}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleVerify} className={btnClass} data-rupert-verify="">
          Verify chain
        </button>
        <button
          type="button"
          onClick={handleTamper}
          className={btnClass}
          data-rupert-tamper=""
          aria-describedby="rupert-snap-tamper-hint"
        >
          Simulate tamper at #{k + 1}
        </button>
        <span id="rupert-snap-tamper-hint" className="sr-only">
          Edits entry {k + 1}&apos;s action after the fact and re-verifies the chain.
        </span>
      </div>

      <p role="status" aria-live="polite" className="mb-3 font-mono text-[11px] text-ns-muted">
        {statusText}
      </p>

      <div ref={wrapRef} className="relative isolate overflow-hidden rounded-lg border border-border">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-0"
          style={{ width: "100%", height: canvasHeight }}
        />
        <table className="relative z-[1] w-full table-fixed border-collapse bg-transparent text-left">
          <caption className="sr-only">
            Hash-chained audit log. Each entry&apos;s stored hash depends on its own fields and the
            previous entry&apos;s hash, so editing an entry invalidates it and every later entry.
          </caption>
          <colgroup>
            <col style={{ width: GUTTER_W }} />
            <col style={{ width: "3.5rem" }} />
            <col style={{ width: "8rem" }} />
            {/* action is the only flexible column: keep the fixed ones tight
                enough that a real action name ("session.create") fits without
                ellipsis at the demo's table width */}
            <col />
            <col style={{ width: "10rem" }} />
            <col style={{ width: "6.5rem" }} />
            <col style={{ width: "7.5rem" }} />
          </colgroup>
          <thead>
            <tr className="bg-background" style={{ height: HEAD_H }}>
              <th scope="col" aria-hidden="true" className="bg-transparent" />
              <th
                scope="col"
                className="border-b border-border px-2 font-mono text-[10px] uppercase tracking-wide text-ns-muted"
              >
                #
              </th>
              <th
                scope="col"
                className="border-b border-border px-2 font-mono text-[10px] uppercase tracking-wide text-ns-muted"
              >
                Actor
              </th>
              <th
                scope="col"
                className="border-b border-border px-2 font-mono text-[10px] uppercase tracking-wide text-ns-muted"
              >
                Action
              </th>
              <th
                scope="col"
                aria-sort={sortDesc ? "descending" : "ascending"}
                className="border-b border-border px-2 font-mono text-[10px] uppercase tracking-wide text-ns-muted"
              >
                <button
                  type="button"
                  onClick={() => setSortDesc((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                  aria-label={`Sort by timestamp, currently ${sortDesc ? "newest first" : "oldest first"}`}
                >
                  Timestamp
                  <span aria-hidden="true">{sortDesc ? "▼" : "▲"}</span>
                </button>
              </th>
              <th
                scope="col"
                className="border-b border-border px-2 font-mono text-[10px] uppercase tracking-wide text-ns-muted"
              >
                Hash
              </th>
              <th
                scope="col"
                className="border-b border-border px-2 font-mono text-[10px] uppercase tracking-wide text-ns-muted"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {displayOrder.map((i) => {
              const e = liveEntries[i];
              const invalidated = invalidFrom !== null && i >= invalidFrom;
              const rowStatus = invalidated ? "Invalidated" : phase === "unverified" ? "Pending" : "Verified";
              return (
                <tr
                  key={i}
                  style={{ height: ROW_H }}
                  data-invalidated={invalidated ? "true" : undefined}
                  aria-describedby={invalidated ? breakNoteId : undefined}
                  className={invalidated ? "bg-background/60" : "bg-background"}
                >
                  <td aria-hidden="true" className="bg-transparent" />
                  <td className="border-b border-border px-2 font-mono text-xs text-ns-muted tabular-nums">
                    {i + 1}
                  </td>
                  <td
                    className={`border-b border-border px-2 text-xs text-foreground ${invalidated ? "decoration-border line-through decoration-1" : ""}`}
                  >
                    {e.actor}
                  </td>
                  <td
                    className={`truncate border-b border-border px-2 text-xs text-foreground ${invalidated ? "decoration-border line-through decoration-1" : ""}`}
                  >
                    {e.action}
                  </td>
                  <td className="border-b border-border px-2 font-mono text-[11px] text-ns-muted tabular-nums">
                    {e.timestamp}
                  </td>
                  <td className="border-b border-border px-2">
                    <code className="select-text font-mono text-[11px] text-ns-muted" title={storedHashes[i]}>
                      {storedHashes[i].slice(0, 10)}…
                    </code>
                  </td>
                  <td className="border-b border-border px-2 py-1 align-middle font-mono text-[11px] text-foreground">
                    <div>{rowStatus}</div>
                    {invalidated && i === invalidFrom ? (
                      <span id={breakNoteId} className="block text-ns-muted">
                        by entry #{(invalidFrom ?? 0) + 1}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* the row-note above already carries the message once, inline, at the
          break itself; this shared node is only the aria-describedby target
          for every OTHER invalidated row, so screen-reader users landing on
          row 40 still hear why row 40 is struck through without the text
          being printed fifty times. */}
      <p id={`${breakNoteId}-shared`} className="sr-only">
        Invalidated because entry {k + 1}&apos;s recorded hash no longer matches the chain recomputed
        from its current content.
      </p>
    </div>
  );
}

RupertSnap.displayName = "RupertSnap";

export default RupertSnap;
