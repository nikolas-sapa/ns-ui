"use client";

import { useState, type FormEvent } from "react";
import { RespireField } from "./component";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function RespireFieldDemo() {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const [exhaleKey, setExhaleKey] = useState(0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (EMAIL_RE.test(value.trim())) {
      setError(false);
      setSent(true);
      setExhaleKey((k) => k + 1);
    } else {
      setSent(false);
      setError(true);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs tracking-widest text-muted">
          ns-ui / respire-field
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          The field breathes.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Focus dilates the membrane. Every keystroke sends a pulse around it
          from the caret. An invalid submit makes it constrict and quiver, a
          valid one lets it exhale.
        </p>

        <form onSubmit={submit} noValidate className="mt-12">
          <label
            htmlFor="respire-email"
            className="font-mono text-[11px] tracking-[0.2em] text-muted"
          >
            EMAIL
          </label>
          <div className="mt-2">
            <RespireField
              id="respire-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(false);
                setSent(false);
              }}
              error={error}
              exhaleKey={exhaleKey}
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <p
              className={`text-xs ${
                error ? "text-[#ea001d]" : "text-muted"
              }`}
              aria-live="polite"
            >
              {error
                ? "Enter a valid email."
                : sent
                  ? "Subscribed. The membrane exhaled."
                  : "Validated on submit."}
            </p>
            <button
              type="submit"
              className="shrink-0 rounded-sm border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface"
            >
              Subscribe
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
