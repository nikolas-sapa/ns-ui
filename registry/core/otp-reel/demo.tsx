"use client";

import { useEffect, useRef, useState } from "react";
import { CipherReelOtp } from "./component";

const DEMO_CODE = "481632";
const RESEND_S = 24;

export default function CipherReelOtpDemo() {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [verified, setVerified] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(RESEND_S);
  const codeRef = useRef("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const verify = (candidate: string) => {
    if (verified || candidate.length < 6) return;
    if (candidate === DEMO_CODE) {
      setVerified(true);
      setError(false);
    } else {
      setAttempts((a) => a + 1);
      setError(true); // rising edge → shake + scramble-out inside the control
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / otp-reel — every box is a slot reel
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">
            Two-factor authentication
          </h2>
          <p className="mt-1 text-sm text-muted">
            We sent a 6-digit code to{" "}
            <span className="font-mono text-foreground">
              +1 (415) ••• ••32
            </span>
            . Enter it below to finish signing in.
          </p>
        </div>

        <div className="px-6 py-6">
          <CipherReelOtp
            label="Verification code"
            helperText="Demo code: 481 632 — anything else trips the error."
            error={error}
            errorMessage="That code didn't match. A fresh attempt was cleared for you."
            disabled={verified}
            onChange={(c) => {
              codeRef.current = c;
              setCode(c);
              if (c.length > 0 && error) setError(false);
            }}
            onComplete={verify}
          />

          <button
            type="button"
            disabled={verified || code.length < 6}
            onClick={() => verify(codeRef.current)}
            className="mt-5 w-full rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {verified ? "Verified" : "Verify device"}
          </button>

          {verified ? (
            <p className="mt-3 text-xs text-[color:var(--success,#47a447)]">
              Device verified — you can close this window.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="font-mono text-xs text-muted">
            {attempts === 0
              ? "attempt 1 of 5"
              : `attempt ${Math.min(attempts + 1, 5)} of 5`}
          </p>
          <button
            type="button"
            disabled={cooldown > 0 || verified}
            onClick={() => {
              setCooldown(RESEND_S);
              setError(false);
            }}
            className="rounded-sm font-mono text-xs text-foreground underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Type to spin a reel into its detent, Backspace reverse-spins it out,
        paste a full code for the staggered cascade. Idle boxes keep a faint
        cipher drift.
      </p>
    </div>
  );
}
