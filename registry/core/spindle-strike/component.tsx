"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SpindleStrike — payment history as a diner-receipt spindle. Every settled
// transaction is a small card impaled on a shared 1px vertical spine
// (--border), newest closest to the top. The whole thing hangs off ONE
// governing scalar per card, `rawY` (px along the spine, computed once in
// JS from that card's recency index * an 8px CARD_GAP), and everything else
// — translateY, z-index, and how far its ink has drifted from --foreground
// toward --ns-muted — is derived from that same number, never chosen
// independently. A brand-new settlement starts CARD_ENTER_DROP above its
// landing spot and opacity 0; clearing that offset one frame later lets the
// existing transform/opacity transition (one shared rule, one
// cubic-bezier(.34,1.56,.64,1) overshoot, 500ms, on every card alike — no
// per-card delay or stagger) carry it down and past its rest position once,
// which reads as "struck the spike and the pile gave". Because every other
// card's rawY is also just index*CARD_GAP, the same single transition rule
// is what makes the rest of the pile appear to shove down in sync — there
// is no separate "shove" animation to keep in step with the drop.
//
// A refund does NOT remove or restyle a row. The existing <li> is the one
// DOM node that keeps moving: its rawY gets a fixed REFUND_LIFT subtracted,
// pulling it a short distance back up the spine from wherever it already
// sat (usually clear of the whole pile, since refunds mostly land on
// something still near the top) — same node, same puncture, now elongated
// from a 3px dot into a slot, because the paper visibly slid along the pin
// rather than coming off it. Depth-darkening reads off the *unshifted* rawY,
// so a lifted refund reads brighter (less "handled"), and z-index is
// `constant - rawY`, so whichever card ends up highest on the spine wins
// the stack order for free, refunded or not — EXCEPT that REFUND_LIFT is
// deliberately an exact multiple of CARD_GAP (see below), so a refunded
// card's rawY can exactly equal a settled card's rawY, and once it does it
// STAYS equal every press after (both age by the same CARD_GAP per settle,
// nothing resolves the tie on its own). Two cards genuinely sharing a
// z-index falls back to paint order, i.e. whichever <li> is later in the
// DOM — arbitrary from the model's point of view, and it is what let a
// refunded card sit permanently hidden behind a same-z settled card for
// several presses in a row, reading as "the refund did nothing" even
// though rawY says it should be frontmost. zIndex below breaks that tie
// explicitly, in the refund's favor, instead of leaving it to paint order.
//
// Fully controlled: `transactions` is the only data in, in caller-supplied
// chronological order (oldest first) — that is also the <li> DOM order,
// independent of the visual stacking, so a screen reader always gets the
// story in time order even though sighted users see newest-on-top. Rotation
// is a djb2-style hash of the id, not Math.random(), so SSR and client
// renders agree and re-renders don't jitter; it's capped at +-3deg because
// beyond that the amount stops being legible at rest. Colors are
// var(--background/--foreground/--ns-muted/--border) only, composed with
// color-mix() for the depth ramp — no hex, no --ns-accent except the
// keyboard focus ring, which is the one interaction highlight. Cards are
// individually focusable; focus lifts one 2px clear of the pile via
// translateY + z-index only (JS-tracked, not CSS transform on top of the
// base transform, so it composes with rotation cleanly) — no scale, no
// opacity change, so the receipt's text never shifts size under focus.
// prefers-reduced-motion shortens the entrance drop and every
// transform/opacity/color transition to a brief, linear pass instead of
// dropping them — positions still update, but as a short visible move
// rather than an instant snap; rotation, being static already, is
// unaffected either way. Refunds fire one
// aria-live announcement naming the amount returned; each row also carries
// a real <dl> (date/amount/status) so "refunded" is legible as text, not
// only as position.
// ---------------------------------------------------------------------------

export interface SpindleTransaction {
  /** stable identifier — also the seed for this card's fixed rotation */
  id: string;
  /** display date, e.g. "Aug 14" */
  date: string;
  /** original settled amount, in dollars */
  amount: number;
  /** "refunded" pulls the existing card up the spine instead of removing it */
  status: "settled" | "refunded";
  /** amount returned; defaults to `amount` when refunded and omitted */
  refundedAmount?: number;
}

export interface SpindleStrikeProps {
  /** the receipts, in chronological order (oldest first) — also the DOM order */
  transactions: SpindleTransaction[];
  /** accessible name for the <ol>. default "Payment history" */
  ariaLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const CARD_GAP = 8; // px the stack shoves per settled receipt — the one shared scalar step
const REFUND_LIFT = 6 * CARD_GAP; // px an existing card is pulled back up the spine on refund —
// kept as an exact multiple of CARD_GAP (not a literal) so a refund six settles back reaches the
// same rawY as the settled card born 6 presses later, rather than staying permanently deeper (and
// permanently z-behind) than every new arrival, which is what made refund reads look inert on the
// first pass. Because it's an exact multiple, that rawY match is an exact tie, and because both
// cards age by the same CARD_GAP every subsequent settle, the tie does not resolve itself — it
// holds for as long as both cards share the pile. Z_TIE_BREAK below (not paint order) decides it.
const MAX_DARK_DEPTH = 14 * CARD_GAP; // px of rawY at which the darken ramp maxes out — scales
// with CARD_GAP so the same ~14-receipt pile depth still spans the full ramp instead of pegging
// every card past the fourth or fifth at max darkness.
const MAX_DARK_PCT = 62; // darkest a receipt gets — never fully --ns-muted, still legible
const ENTER_DROP = 90; // px a newly-struck card starts above its landing spot at rest (full
// travel, no-preference motion) — big enough that the strike reads as landing, not fading in.
const ENTER_DROP_REDUCED = 14; // px equivalent under prefers-reduced-motion: reduce — a short,
// small-amplitude offset (not zero) so a press still visibly moves rather than snapping silently.
const CARD_WIDTH = 216;
const CARD_HEIGHT = 88; // reserved layout height per card, top-of-stack
const Z_SCALE = 100; // multiplies every real (3000 - rawY) gap before the tie-break is added, so
// Z_TIE_BREAK can never leak into ordering two cards whose rawY actually differs (the smallest
// real gap is one CARD_GAP, i.e. >=800 once scaled — comfortably clear of a +/-1 nudge).
const Z_TIE_BREAK = 1; // an exact rawY tie (REFUND_LIFT lands a refunded card on a settled card's
// slot) is resolved in the refund's favor, explicitly, instead of falling through to paint/DOM
// order — which is what let a refunded card sit invisibly behind a same-depth settled card.
const Z_LIFTED = 10_000_000; // focus-lift always wins regardless of the scaled range above

function hashRotation(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  const norm = (((h % 2000) + 2000) % 2000) / 2000; // 0..1, deterministic
  return Math.round((norm * 2 - 1) * 3 * 100) / 100; // -3..3 deg, stable across SSR/re-renders
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function SpindleStrike({
  transactions,
  ariaLabel = "Payment history",
  className = "",
}: SpindleStrikeProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [enteringIds, setEnteringIds] = useState<Set<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState("");
  const prevStatusRef = useRef<Map<string, SpindleTransaction["status"]>>(new Map());
  const mountedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Diff against the previous render to find newly-struck ids and any
  // settled -> refunded transitions — never derived from `turn`-less state,
  // so callers can add or refund in any order without extra bookkeeping.
  // useLayoutEffect, not useEffect: this must set the entering offset
  // BEFORE the browser paints. A brand-new card's very first render
  // otherwise commits at rest (entering hasn't been set yet, since a
  // regular effect runs post-paint) and the browser paints that resting
  // frame — so the offset that follows a moment later is read as an
  // actual FROM-rest transition, which the retarget-to-rest then
  // interrupts almost immediately. Measured: with useEffect, the drop
  // collapsed to a ~1px blip regardless of ENTER_DROP's value, worst on
  // the reduced-motion path where the short transition leaves no room to
  // recover. With useLayoutEffect, entering is already true by the first
  // paint, so the offset is the genuine starting point, no false start.
  useLayoutEffect(() => {
    const prev = prevStatusRef.current;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    if (mountedRef.current) {
      const added: string[] = [];
      let refundedNow: SpindleTransaction | null = null;
      for (const t of transactions) {
        const before = prev.get(t.id);
        if (before === undefined) added.push(t.id);
        else if (before === "settled" && t.status === "refunded") refundedNow = t;
      }
      if (added.length > 0) {
        // Reduced motion still gets an entering pass — just a short one
        // (ENTER_DROP_REDUCED, a fast linear CSS transition below) instead
        // of skipping straight to rest. A silent snap reads identically to
        // "nothing happened" to anyone who can't see the drop; a brief,
        // small-amplitude move reads as the strike landing without the
        // spring overshoot.
        setEnteringIds(new Set(added));
        // A fixed, frame-independent hold before retargeting to rest — long
        // enough that the offset has definitely painted (this effect firing
        // pre-paint already guarantees that) and definitely started
        // transitioning before it reverses.
        clearTimer = setTimeout(() => setEnteringIds(new Set()), 32);
      }
      if (refundedNow) {
        const back = refundedNow.refundedAmount ?? refundedNow.amount;
        setLiveMsg(`Refunded: ${refundedNow.date}, $${refundedNow.amount.toFixed(2)} — $${back.toFixed(2)} returned`);
      }
    }
    prevStatusRef.current = new Map(transactions.map((t) => [t.id, t.status]));
    mountedRef.current = true;
    return () => {
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [transactions, reducedMotion]);

  // Recency index among ALL receipts (refunded ones included), newest = 0.
  // Refunded cards keep the index their position implies, so the pile below
  // them keeps its own spacing rather than closing the gap — the missing
  // step reads as the slot the receipt was pulled out of.
  const baseIndexById = useMemo(() => {
    const map = new Map<string, number>();
    const desc = [...transactions].reverse();
    desc.forEach((t, i) => map.set(t.id, i));
    return map;
  }, [transactions]);

  const layout = useMemo(() => {
    const raw = transactions.map((t) => {
      const baseIndex = baseIndexById.get(t.id) ?? 0;
      const rawY = baseIndex * CARD_GAP - (t.status === "refunded" ? REFUND_LIFT : 0);
      return { id: t.id, rawY };
    });
    const minY = Math.min(0, ...raw.map((r) => r.rawY));
    const maxY = Math.max(0, ...raw.map((r) => r.rawY));
    const topPad = -minY;
    const height = CARD_HEIGHT + (maxY - minY);
    const byId = new Map(raw.map((r) => [r.id, { rawY: r.rawY, shiftedY: r.rawY + topPad }]));
    return { byId, height, topPad };
  }, [transactions, baseIndexById]);

  return (
    <div className={["ns-spindle relative mx-auto", className].join(" ")} style={{ width: CARD_WIDTH + 40, height: layout.height }}>
      <style>{`
.ns-spindle-spine{position:absolute;top:0;bottom:0;left:50%;width:1px;background:var(--border);transform:translateX(-0.5px);pointer-events:none}
.ns-spindle-list{position:relative;margin:0;padding:0;height:100%;list-style:none}
.ns-spindle-card{
  position:absolute;
  left:50%;
  top:0;
  width:${CARD_WIDTH}px;
  padding:20px 14px 12px;
  border-radius:12px;
  box-shadow:0 1px 3px color-mix(in srgb, var(--foreground) 14%, transparent);
  transition:transform 560ms cubic-bezier(.34,1.56,.64,1), opacity 460ms ease-out, color 560ms ease-out;
  cursor:default;
}
.ns-spindle-card:focus-visible{outline:2px solid var(--ns-accent);outline-offset:2px}
.ns-spindle-puncture{
  position:absolute;
  left:50%;
  top:16px;
  width:3px;
  height:3px;
  border-radius:9999px;
  background:color-mix(in srgb, var(--foreground) 45%, var(--ns-muted));
  transform:translate(-50%,-50%) scale(1);
  opacity:1;
  transition:width 320ms cubic-bezier(.22,1,.36,1), height 320ms cubic-bezier(.22,1,.36,1),
    opacity 160ms ease-out 380ms, transform 160ms cubic-bezier(.34,1.56,.64,1) 380ms;
}
.ns-spindle-card[data-status="refunded"] .ns-spindle-puncture{width:3px;height:13px;border-radius:9999px}
.ns-spindle-card[data-entering="true"] .ns-spindle-puncture{opacity:0;transform:translate(-50%,-50%) scale(.25)}
.ns-spindle-dl{margin:6px 0 0}
.ns-spindle-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;line-height:1.35}
.ns-spindle-date{font-family:var(--font-mono);font-size:11px;letter-spacing:.04em;color:var(--ns-muted)}
.ns-spindle-amount{font-family:var(--font-mono);font-size:16px;font-weight:600;color:inherit}
.ns-spindle-status{font-family:var(--font-mono);font-size:11px;color:var(--ns-muted)}
.ns-spindle-card[data-status="refunded"] .ns-spindle-status{color:inherit}
@media (prefers-reduced-motion: reduce){
  /* Not a snap: the strike still needs to read as a card landing, just
     short and linear instead of the 560ms spring overshoot — small-scale
     UI motion on transform/opacity/color, not the ambient or parallax
     motion prefers-reduced-motion exists to suppress. */
  .ns-spindle-card{transition:transform 160ms linear, opacity 140ms linear, color 160ms linear!important}
  .ns-spindle-puncture{transition:width 140ms linear, height 140ms linear, opacity 100ms linear 60ms, transform 100ms linear 60ms!important}
}
`}</style>

      <div aria-hidden="true" className="ns-spindle-spine" />

      <ol aria-label={ariaLabel} className="ns-spindle-list">
        {transactions.map((t) => {
          const pos = layout.byId.get(t.id);
          const rawY = pos?.rawY ?? 0;
          const restY = pos?.shiftedY ?? 0;
          const refunded = t.status === "refunded";
          const entering = enteringIds.has(t.id);
          const lifted = focusedId === t.id;
          const enterOffset = reducedMotion ? ENTER_DROP_REDUCED : ENTER_DROP;
          const y = (entering ? restY - enterOffset : restY) - (lifted ? 2 : 0);
          const rot = hashRotation(t.id);
          const darkPct = (clamp(rawY, 0, MAX_DARK_DEPTH) / MAX_DARK_DEPTH) * MAX_DARK_PCT;
          const zIndex = lifted
            ? Z_LIFTED
            : Math.round(3000 - rawY) * Z_SCALE + (refunded ? Z_TIE_BREAK : 0);
          const returned = t.refundedAmount ?? t.amount;
          const statusText = refunded ? `Refunded, $${returned.toFixed(2)} returned` : "Settled";
          const label = `${t.date}, $${t.amount.toFixed(2)}, ${statusText}`;

          return (
            <li
              key={t.id}
              tabIndex={0}
              aria-label={label}
              data-id={t.id}
              data-status={t.status}
              data-entering={entering}
              onFocus={() => setFocusedId(t.id)}
              onBlur={() => setFocusedId((cur) => (cur === t.id ? null : cur))}
              className="ns-spindle-card border border-border bg-background"
              style={{
                transform: `translate(-50%, ${y}px) rotate(${rot}deg)`,
                transformOrigin: "50% 16px",
                zIndex,
                opacity: entering ? 0 : 1,
                color: `color-mix(in srgb, var(--foreground) ${100 - darkPct}%, var(--ns-muted))`,
              }}
            >
              <span aria-hidden="true" className="ns-spindle-puncture" />
              <dl className="ns-spindle-dl">
                <div className="ns-spindle-row">
                  <dt className="sr-only">Date</dt>
                  <dd className="ns-spindle-date">{t.date}</dd>
                </div>
                <div className="ns-spindle-row">
                  <dt className="sr-only">Amount</dt>
                  <dd className="ns-spindle-amount">${t.amount.toFixed(2)}</dd>
                </div>
                <div className="ns-spindle-row">
                  <dt className="sr-only">Status</dt>
                  <dd className="ns-spindle-status">{statusText}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>

      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>
    </div>
  );
}
