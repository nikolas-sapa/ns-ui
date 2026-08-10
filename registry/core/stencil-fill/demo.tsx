"use client";

import { useState } from "react";
import { StencilFill } from "./component";

// License-key shaped mask (4 groups of 4) with the classic ambiguous-glyph
// exclusion: 'O' is rejected so the signature reject beat (print at 40%
// muted, spring-shake, fall away) has something to demonstrate on its own —
// no pointer/keyboard input from a viewer required, autoplay's "type" mode
// drives real key events at the hidden input.
function validateLicenseChar(char: string): boolean {
  if (!/^[A-Za-z0-9]$/.test(char)) return false;
  return char.toUpperCase() !== "O";
}

export default function StencilFillDemo() {
  const [value, setValue] = useState("");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / stencil-fill</p>

      <StencilFill
        mask="XXXX-XXXX-XXXX-XXXX"
        label="License key"
        validate={validateLicenseChar}
        autoComplete="off"
        onValueChange={setValue}
      />

      <p className="max-w-md text-center text-xs text-ns-muted">
        Type to ink each cell from the stencil; a disallowed character (try
        &ldquo;O&rdquo;) prints faint, shakes, and falls away instead of
        silently vanishing.
      </p>

      <p aria-hidden="true" className="font-mono text-[10px] text-ns-muted">
        value: {value || "—"}
      </p>
    </div>
  );
}
