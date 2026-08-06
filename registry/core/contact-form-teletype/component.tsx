"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

// ---------------------------------------------------------------------------
// TeletypeForm — a contact form whose validation surfaces as a real running
// receipt, not a red border. Every field validates on a debounced keystroke
// (or on submit, for whatever hasn't fired yet) and PRINTS a new line below
// the form — teletype-style, each line typing itself out over a duration
// proportional to its own length via a width transition stepped one
// character at a time, never cleared once written. Correcting a field does
// NOT erase its old line: the old line gets struck through in place and a
// fresh line for the same field prints below it, so the receipt reads as an
// honest log of the fill (what was tried, in order) rather than a status
// badge that overwrites itself.
//
// Distinct from validation-inline-wick (a single field's border diffuses a
// tint from the offending character — no log, no history) and from
// validation-error-summary (a punch list gathered at the TOP of the form on
// failed submit, with leader lines back to fields, that self-dismisses once
// every field resolves and forgets earlier attempts). Distinct from
// ticker-teleprinter (a marquee crawl with no semantic content) and
// progress-telegraph-log (a log of a caller-driven async operation's own
// sub-steps, not of user-typed field validation). Here the log is the point:
// it accretes for the life of the form, keeping every correction visible.
// ---------------------------------------------------------------------------

export interface TeletypeFieldSpec {
  name: string;
  label: string;
  type?: "text" | "email" | "textarea";
  placeholder?: string;
  /** return an error message, or null when the value passes */
  validate: (value: string) => string | null;
}

export interface ContactFormTeletypeProps {
  /** the form fields, in order */
  fields?: TeletypeFieldSpec[];
  /** called with all field values, keyed by field id, on submit */
  onSubmit?: (values: Record<string, string>) => void;
  /** ms after the last keystroke before that field's line prints. Default 260. */
  debounceMs?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const DEFAULT_FIELDS: TeletypeFieldSpec[] = [
  {
    name: "name",
    label: "Name",
    validate: (v) => (v.trim().length === 0 ? "required" : v.trim().length < 2 ? "too short" : null),
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    validate: (v) =>
      v.trim().length === 0 ? "required" : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "not a valid address",
  },
  {
    name: "message",
    label: "Message",
    type: "textarea",
    validate: (v) => (v.trim().length === 0 ? "required" : v.trim().length < 10 ? "too short" : null),
  },
];

interface Entry {
  id: number;
  field: string;
  label: string;
  ok: boolean;
  text: string;
  struck: boolean;
}

function receiptLine(label: string, ok: boolean, err: string | null): string {
  const dots = ".".repeat(Math.max(3, 22 - label.length));
  return ok ? `${label.toUpperCase()} ${dots} OK` : `${label.toUpperCase()} ${dots} FAIL — ${err}`;
}

export function ContactFormTeletype({
  fields = DEFAULT_FIELDS,
  onSubmit,
  debounceMs = 260,
  className = "",
}: ContactFormTeletypeProps) {
  const uid = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, ""]))
  );
  const [entries, setEntries] = useState<Entry[]>([]);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const entryIdRef = useRef(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const refs = debounceRefs.current;
    return () => {
      Object.values(refs).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  function printLine(field: TeletypeFieldSpec, value: string) {
    const err = field.validate(value);
    const ok = err === null;
    setEntries((prev) => {
      const struck = prev.map((e) => (e.field === field.name ? { ...e, struck: true } : e));
      return [
        ...struck,
        {
          id: entryIdRef.current++,
          field: field.name,
          label: field.label,
          ok,
          text: receiptLine(field.label, ok, err),
          struck: false,
        },
      ];
    });
  }

  function handleChange(field: TeletypeFieldSpec, next: string) {
    setValues((v) => ({ ...v, [field.name]: next }));
    const refs = debounceRefs.current;
    if (refs[field.name]) clearTimeout(refs[field.name]);
    refs[field.name] = setTimeout(() => printLine(field, next), debounceMs);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let allOk = true;
    fields.forEach((f) => {
      const refs = debounceRefs.current;
      if (refs[f.name]) clearTimeout(refs[f.name]);
      const v = values[f.name] ?? "";
      const err = f.validate(v);
      if (err) allOk = false;
      printLine(f, v);
    });
    if (allOk) onSubmit?.(values);
  }

  const fieldCls =
    "ns-cft-field w-full rounded-sm border border-border bg-background px-3 py-2 font-mono text-sm text-foreground transition-colors duration-150 placeholder:text-ns-muted/60 hover:border-ns-muted focus-visible:border-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent";

  return (
    <div className={`ns-cft w-full ${className}`}>
      <style>{CSS}</style>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {fields.map((field) => {
          const fieldId = `${uid}-${field.name}`;
          return (
            <div key={field.name} className="flex flex-col gap-1.5">
              <label htmlFor={fieldId} className="font-mono text-xs uppercase tracking-widest text-ns-muted">
                {field.label}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={fieldId}
                  name={field.name}
                  rows={3}
                  value={values[field.name]}
                  placeholder={field.placeholder}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className={`${fieldCls} resize-none`}
                />
              ) : (
                <input
                  id={fieldId}
                  name={field.name}
                  type={field.type ?? "text"}
                  value={values[field.name]}
                  placeholder={field.placeholder}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className={fieldCls}
                />
              )}
            </div>
          );
        })}
        <button
          type="submit"
          className="ns-cft-submit self-start rounded-sm border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest text-foreground transition-colors duration-150 hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Send
        </button>
      </form>

      <div
        role="log"
        aria-live="polite"
        aria-label="Field validation receipt"
        className="ns-cft-receipt mt-6 flex flex-col gap-0.5 rounded-sm border border-border bg-surface p-3 font-mono text-xs"
      >
        <p className="pb-1 text-ns-muted">— RECEIPT —</p>
        {entries.length === 0 && (
          <p aria-hidden="true" className="text-ns-muted/60">
            (awaiting input)
          </p>
        )}
        {entries.map((entry) => (
          <ReceiptLine key={entry.id} entry={entry} reduced={reducedRef.current} />
        ))}
      </div>
    </div>
  );
}

function ReceiptLine({ entry, reduced }: { entry: Entry; reduced: boolean }) {
  const [printed, setPrinted] = useState(reduced);
  const chars = Math.max(1, entry.text.length);

  useEffect(() => {
    if (reduced) return;
    const raf = requestAnimationFrame(() => setPrinted(true));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const duration = reduced ? 0 : Math.min(900, Math.max(160, chars * 20));

  return (
    <div
      className="ns-cft-line"
      style={{ color: entry.ok ? "var(--foreground)" : "var(--error, #ea001d)" }}
    >
      <span
        className={`ns-cft-print inline-block overflow-hidden whitespace-pre align-top ${
          entry.struck ? "ns-cft-struck" : ""
        }`}
        style={{
          width: printed ? `${chars}ch` : "0ch",
          transition: reduced ? "none" : `width ${duration}ms steps(${chars}, end)`,
        }}
      >
        {entry.text}
      </span>
    </div>
  );
}

const CSS = `
.ns-cft-struck { text-decoration: line-through; text-decoration-thickness: 1px; opacity: 0.55; transition: opacity 200ms ease; }
`;
