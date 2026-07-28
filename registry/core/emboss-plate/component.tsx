"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";

// ---------------------------------------------------------------------------
// EmbossPlate — a card-number input rendered as an embossing machine, not a
// flat text field. Typed digits RAISE as embossed metal (a dual text-shadow
// bevel, light top-left / dark bottom-right), grouped 4-4-4-4, with a small
// stamping-head caret that dips on every keystroke. A brand watermark
// (detected from the IIN prefix, or a generic wordmark) fades in once 4+
// digits exist. Expiry and CVC share the same emboss treatment.
//
// Real input semantics: one native <input> per field, transparent and
// overlaid exactly on top of its decorative display (never sr-only-tiny —
// the visible plate area IS the click/tap target), so typing, autofill,
// paste, and screen-reader behavior all come from genuine form controls.
// The formatted display underneath is aria-hidden and purely presentational.
// Because the real inputs are transparent, focus is shown on the DISPLAY
// sibling via a CSS focus-visible + adjacent-sibling rule, not on the
// (invisible) input itself.
// ---------------------------------------------------------------------------

export interface EmbossPlateProps {
  className?: string;
}

const GROUP_SIZES = [4, 4, 4, 4] as const;

function luhnValid(digits: string): boolean {
  if (digits.length === 0) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectBrand(digits: string): string {
  if (digits.startsWith("4")) return "VISA";
  if (/^5[1-5]/.test(digits)) return "MASTERCARD";
  if (/^3[47]/.test(digits)) return "AMEX";
  return "BANK";
}

function formatGroups(digits: string): string[] {
  const groups: string[] = [];
  let i = 0;
  for (const size of GROUP_SIZES) {
    groups.push(digits.slice(i, i + size));
    i += size;
  }
  return groups;
}

// Monochrome film-grain overlay via feTurbulence — never a CSS gradient
// function, so it can't read as a decorative color wash.
const NOISE_BG = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0"/></filter><rect width="100%" height="100%" fill="black" filter="url(#n)"/></svg>'
)}")`;

export function EmbossPlate({ className = "" }: EmbossPlateProps) {
  const autoId = useId().replace(/:/g, "");
  const stampRef = useRef<HTMLSpanElement | null>(null);
  const reducedRef = useRef(false);
  const dipTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => clearTimeout(dipTimerRef.current), []);

  const dipStamp = useCallback(() => {
    const el = stampRef.current;
    if (!el || reducedRef.current) return;
    clearTimeout(dipTimerRef.current);
    el.style.transition = "transform 90ms ease-out";
    el.style.transform = "translateY(2px) scaleY(0.85)";
    dipTimerRef.current = setTimeout(() => {
      el.style.transition = "transform 140ms ease-out";
      el.style.transform = "translateY(0) scaleY(1)";
    }, 90);
  }, []);

  const handleNumberChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
      setNumber(digits);
      setInvalid(false);
      dipStamp();
    },
    [dipStamp]
  );

  const handleNumberBlur = useCallback(() => {
    if (number.length === 0) return;
    const ok = luhnValid(number);
    setInvalid(!ok);
    setAnnounce(ok ? "Card number valid." : "Card number invalid — check the last group.");
  }, [number]);

  const handleExpiryChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setExpiry(e.target.value.replace(/\D/g, "").slice(0, 4));
      dipStamp();
    },
    [dipStamp]
  );

  const handleCvcChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setCvc(e.target.value.replace(/\D/g, "").slice(0, 4));
      dipStamp();
    },
    [dipStamp]
  );

  const groups = useMemo(() => formatGroups(number), [number]);
  const brand = useMemo(() => detectBrand(number), [number]);
  const showBrand = number.length >= 4;
  const lastGroupIndex = Math.max(0, Math.min(3, Math.ceil(number.length / 4) - 1));
  const expiryDisplay = expiry.length <= 2 ? expiry : `${expiry.slice(0, 2)}/${expiry.slice(2)}`;

  return (
    <div
      className={`ns-ep-plate relative overflow-hidden rounded-[16px] border border-border bg-surface p-6 ${className}`}
      style={{ backgroundImage: NOISE_BG }}
    >
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Card number</p>

      <div className="relative mt-2 h-9">
        <label htmlFor={`ep-number-${autoId}`} className="sr-only">
          Card number
        </label>
        <input
          id={`ep-number-${autoId}`}
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          value={number}
          onChange={handleNumberChange}
          onBlur={handleNumberBlur}
          maxLength={19}
          className="ns-ep-input absolute inset-0 z-10 h-full w-full"
        />
        <div
          aria-hidden="true"
          data-ep-display
          className="pointer-events-none flex h-full items-center gap-4 font-mono text-xl"
        >
          {groups.map((g, gi) => (
            <span
              key={gi}
              className={`ns-ep-group relative flex gap-1 tracking-widest ${
                invalid && gi === lastGroupIndex ? "ns-ep-flat" : ""
              }`}
            >
              {Array.from({ length: 4 }).map((_, di) => (
                <span key={di} className="ns-ep-digit inline-block w-[1ch] text-center">
                  {g[di] ?? "·"}
                </span>
              ))}
              {invalid && gi === lastGroupIndex && <span aria-hidden="true" className="ns-ep-error-line" />}
            </span>
          ))}
          <span ref={stampRef} className="ns-ep-stamp ml-1 inline-block h-5 w-[2px] rounded-full bg-foreground/60" />
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-6">
        <div>
          <label
            htmlFor={`ep-expiry-${autoId}`}
            className="block font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
          >
            Exp
          </label>
          <div className="relative mt-1 h-6 w-16">
            <input
              id={`ep-expiry-${autoId}`}
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              value={expiry}
              onChange={handleExpiryChange}
              maxLength={5}
              className="ns-ep-input absolute inset-0 z-10 h-full w-full"
            />
            <div aria-hidden="true" data-ep-display className="ns-ep-digit pointer-events-none font-mono text-base tracking-wider">
              {expiryDisplay || "MM/YY"}
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor={`ep-cvc-${autoId}`}
            className="block font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
          >
            CVC
          </label>
          <div className="relative mt-1 h-6 w-12">
            <input
              id={`ep-cvc-${autoId}`}
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={cvc}
              onChange={handleCvcChange}
              maxLength={4}
              className="ns-ep-input absolute inset-0 z-10 h-full w-full"
            />
            <div aria-hidden="true" data-ep-display className="ns-ep-digit pointer-events-none font-mono text-base tracking-wider">
              {cvc ? "•".repeat(cvc.length) : "•••"}
            </div>
          </div>
        </div>

        <p
          aria-hidden="true"
          className={`ns-ep-brand font-mono text-xs uppercase tracking-[0.25em] text-muted transition-opacity duration-300 ${
            showBrand ? "opacity-70" : "opacity-0"
          }`}
        >
          {brand}
        </p>
      </div>

      <span aria-hidden="true" className="ns-ep-sheen pointer-events-none absolute inset-0 opacity-0" />
    </div>
  );
}

const CSS = `
.ns-ep-input{ background: transparent; color: transparent; caret-color: transparent; border: none; outline: none; font: inherit; letter-spacing: inherit; padding: 0; }
.ns-ep-input:focus-visible ~ [data-ep-display]{ outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
.ns-ep-digit{ color: var(--foreground); text-shadow: -1px -1px 0 rgba(255,255,255,0.35), 1px 1px 1px rgba(0,0,0,0.5); }
.dark .ns-ep-digit{ text-shadow: -1px -1px 0 rgba(255,255,255,0.22), 1px 1px 1px rgba(0,0,0,0.6); }
.ns-ep-flat .ns-ep-digit{ text-shadow: none; color: var(--muted); transition: text-shadow 160ms ease-out, color 160ms ease-out; }
.ns-ep-error-line{ position: absolute; left: 0; right: 0; bottom: -6px; height: 1px; background: var(--error); }
.ns-ep-plate:hover .ns-ep-sheen{ opacity: 1; }
.ns-ep-sheen{ background: rgba(255,255,255,0.03); transition: opacity 200ms ease-out; }
@media (prefers-reduced-motion: reduce){
  .ns-ep-stamp{ transition: none !important; }
  .ns-ep-sheen{ transition: none; }
}
`;

export default EmbossPlate;
