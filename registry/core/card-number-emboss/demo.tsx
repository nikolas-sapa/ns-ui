"use client";

import { useEffect, useRef } from "react";
import { EmbossPlate } from "./component";

// Self-driving: types a valid test card number digit-by-digit (letting the
// stamp caret and emboss reveal catch mid-type), fills expiry/CVC, blurs to
// confirm it's valid, clears, then types an intentionally Luhn-invalid
// number and blurs to show the last group flatten with the error hairline —
// no pointer/keyboard input from a viewer is ever required.
function setNativeValue(el: HTMLInputElement, value: string) {
  const proto = Object.getPrototypeOf(el) as { constructor: { prototype: HTMLInputElement } };
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
}

function typeValue(el: HTMLInputElement, value: string) {
  setNativeValue(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function typeDigits(el: HTMLInputElement, full: string, stepMs: number, cancelled: () => boolean) {
  for (let i = 1; i <= full.length; i++) {
    if (cancelled()) return;
    await wait(stepMs);
    typeValue(el, full.slice(0, i));
  }
}

const VALID_NUMBER = "4111111111111111"; // known Luhn-valid VISA test number
const INVALID_NUMBER = "4111111111111112"; // last digit flipped — Luhn-invalid

export default function EmbossPlateDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    async function loop() {
      const root = containerRef.current;
      if (!root) return;
      const numberInput = root.querySelector<HTMLInputElement>('input[autocomplete="cc-number"]');
      const expiryInput = root.querySelector<HTMLInputElement>('input[autocomplete="cc-exp"]');
      const cvcInput = root.querySelector<HTMLInputElement>('input[autocomplete="cc-csc"]');
      if (!numberInput || !expiryInput || !cvcInput) return;

      await wait(500);
      while (!isCancelled()) {
        await typeDigits(numberInput, VALID_NUMBER, 70, isCancelled);
        await wait(500);
        await typeDigits(expiryInput, "1228", 90, isCancelled);
        await wait(350);
        await typeDigits(cvcInput, "123", 90, isCancelled);
        await wait(2600);
        if (isCancelled()) return;
        numberInput.blur(); // valid Luhn — no flatten
        await wait(1800);

        typeValue(numberInput, "");
        typeValue(expiryInput, "");
        typeValue(cvcInput, "");
        await wait(600);
        if (isCancelled()) return;

        await typeDigits(numberInput, INVALID_NUMBER, 70, isCancelled);
        if (isCancelled()) return;
        numberInput.blur(); // invalid Luhn — last group flattens + error line
        await wait(3200);

        typeValue(numberInput, "");
        typeValue(expiryInput, "");
        typeValue(cvcInput, "");
        await wait(900);
      }
    }

    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / card-number-emboss</p>

      <div ref={containerRef} className="w-full max-w-sm">
        <EmbossPlate />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Digits raise as embossed metal while you type; blurring an invalid
        card number flattens the last group and underlines it in error red.
      </p>
    </div>
  );
}
