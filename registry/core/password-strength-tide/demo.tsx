"use client";

import { useState } from "react";
import { TideGaugePassword } from "./component";

const inputClass =
  "w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-ns-muted/70 hover:border-foreground/25 focus:border-ns-accent/60 focus:ring-2 focus:ring-ns-accent/30";

export default function TideGaugePasswordDemo() {
  const [email, setEmail] = useState("");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / password-strength-tide — entropy raises the tide
      </p>

      <div className="w-full max-w-sm rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-ns-muted">
            Type a password and watch the tank fill. Every keystroke sloshes
            the surface; deletions pull the tide back out.
          </p>
        </div>

        <form
          className="flex flex-col gap-5 px-6 py-6"
          onSubmit={(e) => e.preventDefault()}
        >
          <div>
            <label
              htmlFor="signup-email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <TideGaugePassword label="Password" name="password" />
            <p className="text-xs text-ns-muted">
              12+ characters mixing case, digits, and symbols reaches Strong.
            </p>
          </div>

          <TideGaugePassword
            label="Confirm password"
            name="confirm-password"
            autoComplete="new-password"
          />

          <button
            type="submit"
            className="mt-1 w-full rounded-sm bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Create account
          </button>

          <p className="text-center text-xs text-ns-muted">
            Already registered?{" "}
            <a
              href="#sign-in"
              className="text-foreground underline decoration-border underline-offset-2 transition-colors hover:decoration-foreground/40"
            >
              Sign in
            </a>
          </p>
        </form>
      </div>

      <p className="max-w-sm text-center text-xs text-ns-muted">
        Water level tracks charset entropy on a damped spring. Toggle the eye
        to drop a ripple at the icon; strength is announced politely to screen
        readers.
      </p>
    </div>
  );
}
