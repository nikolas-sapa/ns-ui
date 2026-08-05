"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { RespireField } from "./component";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function RespireFieldDemo() {
  // Landing-page autoplay can only dispatch pointer/click events at the real
  // submit button — it can't type — so a valid email is seeded here only
  // when `?autoplay=1` is present, letting the driver's repeated submit
  // presses replay the real "valid submit -> exhale" path instead of the
  // "invalid submit -> constrict/quiver" one. The plain preview (no query
  // param) is unaffected: value still starts empty and stays fully
  // interactive.
  const autoplay = useSearchParams().get("autoplay") === "1";
  const [value, setValue] = useState(autoplay ? "you@example.com" : "");
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
        <p className="font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / input-focus-membrane
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          The field breathes.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ns-muted">
          Focus dilates the membrane. Every keystroke sends a pulse around it
          from the caret. An invalid submit makes it constrict and quiver, a
          valid one lets it exhale.
        </p>

        <form onSubmit={submit} noValidate className="mt-12">
          <label
            htmlFor="respire-email"
            className="font-mono text-[11px] tracking-[0.2em] text-ns-muted"
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
                error ? "text-[var(--error)]" : "text-ns-muted"
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
