"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

/** One literal data row shown on the sheet underneath — the actual value, never a placeholder. */
export interface EnvelopeField {
  /** Field label, e.g. "Name". */
  label: string;
  /** The real value on file, e.g. "Jordan Ellis". */
  value: string;
}

/** One requested scope: a switch that governs one die-cut window over one or more real rows. */
export interface EnvelopeScope {
  id: string;
  /** Visible + accessible switch label, e.g. "Repositories". */
  label: string;
  /** The real rows this scope's window sits over. */
  fields: EnvelopeField[];
  /** Short accessible summary named by aria-describedby, e.g. "14 events this week". */
  sample: string;
  /** Required scopes render as a glassine (hatched) window: always open, never closable. */
  required?: boolean;
  /** Initial aperture for an optional scope. Defaults to closed. */
  defaultOpen?: boolean;
}

export interface EnvelopeWindowProps {
  /** The app requesting access, e.g. "Northlake Analytics". */
  appName: string;
  /** The scopes it's asking for, in the order they appear on the sheet. */
  scopes: EnvelopeScope[];
  /** Called with the ids of every currently-open scope (required scopes always included). */
  onAllow?: (openScopeIds: string[]) => void;
  /** Called after every optional window has been closed. */
  onDeny?: () => void;
  className?: string;
}

const OPEN_MS = 240;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo
const WINDOW_PAD = 6;

type Rect = { top: number; left: number; width: number; height: number };

/**
 * An OAuth-style consent screen built as a physical envelope. The user's real
 * account data sits on a sheet in normal document flow; an opaque die-cut
 * window sits over each scope's rows, and that window's aperture (0..1) is
 * literally the switch's checked state. Opening a scope parts two flaps from
 * the seam outward via animated clip-path insets; closing reverses the same
 * scalar. Required scopes render as glassine (hatched) windows: always at
 * aperture 1, visible, never closable — what the app can always see.
 */
export function EnvelopeWindow({
  appName,
  scopes,
  onAllow,
  onDeny,
  className = "",
}: EnvelopeWindowProps) {
  const uid = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(scopes.map((s) => [s.id, s.required ? true : (s.defaultOpen ?? false)])),
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const next: Record<string, Rect> = {};
      for (const scope of scopes) {
        const el = rowRefs.current.get(scope.id);
        if (!el) continue;
        next[scope.id] = {
          top: el.offsetTop - WINDOW_PAD,
          left: el.offsetLeft - WINDOW_PAD,
          width: el.offsetWidth + WINDOW_PAD * 2,
          height: el.offsetHeight + WINDOW_PAD * 2,
        };
      }
      setRects(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes]);

  const toggle = (scope: EnvelopeScope) => {
    if (scope.required) return;
    setOpen((prev) => ({ ...prev, [scope.id]: !prev[scope.id] }));
  };

  const isOpen = (scope: EnvelopeScope) => scope.required || !!open[scope.id];
  const openCount = scopes.filter(isOpen).length;
  const total = scopes.length;
  const allowLabel = `Allow access to ${openCount} of ${total} areas`;

  const handleDeny = () => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const s of scopes) if (!s.required) next[s.id] = false;
      return next;
    });
    onDeny?.();
  };

  const handleAllow = () => {
    onAllow?.(scopes.filter(isOpen).map((s) => s.id));
  };

  // Optional switches lead the control list, required ones trail it — the
  // window layout above stays in the caller's own scope order regardless.
  const orderedSwitches = [
    ...scopes.filter((s) => !s.required),
    ...scopes.filter((s) => s.required),
  ];

  const hatchId = `envwin-hatch-${uid}`;

  return (
    <div
      className={`ns-envelope-window w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background ${className}`}
      style={{
        boxShadow: "inset 0 1px 2px color-mix(in srgb, var(--foreground) 6%, transparent)",
      }}
    >
      <style>{`
        .ns-envwin-flap {
          transition: clip-path ${OPEN_MS}ms ${EASE};
        }
        .ns-envwin-thumb {
          transition: transform 200ms ${EASE};
        }
        .ns-envwin-track {
          transition: background-color 200ms ease-out, border-color 200ms ease-out;
        }
        .ns-envwin-track:hover {
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--foreground) 12%, transparent);
        }
        .ns-envwin-allow {
          transition: background-color 150ms ease-out, border-color 150ms ease-out;
        }
        .ns-envwin-allow:hover {
          background-color: color-mix(in srgb, var(--ns-accent) 18%, transparent);
        }
        .ns-envwin-deny:hover {
          border-color: var(--foreground);
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-envwin-flap, .ns-envwin-thumb, .ns-envwin-track, .ns-envwin-allow {
            transition: none;
          }
        }
      `}</style>

      {/* Shared die-cut hatch, referenced by every glassine (required) window. */}
      <svg width="0" height="0" aria-hidden focusable="false">
        <defs>
          <pattern
            id={hatchId}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ns-muted)" strokeWidth="1" />
          </pattern>
        </defs>
      </svg>

      <header className="border-b border-border px-5 py-3">
        <p className="font-mono text-xs tracking-widest text-ns-muted">AUTHORIZE ACCESS</p>
        <p className="mt-1 text-sm text-foreground">
          <span className="font-medium">{appName}</span> wants to access your account
        </p>
      </header>

      <div ref={containerRef} className="relative px-5 py-4">
        {scopes.map((scope) => (
          <div
            key={scope.id}
            ref={(el) => {
              if (el) rowRefs.current.set(scope.id, el);
              else rowRefs.current.delete(scope.id);
            }}
            data-envelope-row={scope.id}
            className="py-2.5 first:pt-0 last:pb-0"
          >
            {scope.fields.map((f, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-ns-muted">{f.label}</span>
                <span className="font-mono text-ns-muted">{f.value}</span>
              </div>
            ))}
          </div>
        ))}

        {scopes.map((scope) => {
          const rect = rects[scope.id];
          if (!rect) return null;
          const rectStyle = {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          };

          if (scope.required) {
            // Glassine: a translucent, hatched pane always over the data —
            // visible, textured, but never a plain clear cut.
            return (
              <div
                key={scope.id}
                aria-hidden
                data-envelope-window={scope.id}
                className="pointer-events-none absolute overflow-hidden rounded-[6px] border border-border"
                style={{
                  ...rectStyle,
                  boxShadow: "inset 0 1px 3px color-mix(in srgb, var(--foreground) 16%, transparent)",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: "color-mix(in srgb, var(--background) 55%, transparent)" }}
                />
                <svg className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
                  <rect width="100%" height="100%" fill={`url(#${hatchId})`} opacity={0.55} />
                </svg>
              </div>
            );
          }

          const a = open[scope.id] ? 1 : 0;
          return (
            <div
              key={scope.id}
              aria-hidden
              data-envelope-window={scope.id}
              className="pointer-events-none absolute overflow-hidden rounded-[6px] border border-border"
              style={{
                ...rectStyle,
                boxShadow: "inset 0 1px 3px color-mix(in srgb, var(--foreground) 14%, transparent)",
              }}
            >
              {/* Two flaps parting from the centre seam. Each covers half the
                  window at aperture 0 and clips away toward its own edge as
                  aperture rises to 1 — the reveal is the clip, not a fade. */}
              <div
                className="ns-envwin-flap pointer-events-auto absolute inset-x-0 top-0 h-1/2 bg-background"
                style={{ clipPath: `inset(0 0 ${a * 100}% 0)` }}
              />
              <div
                className="ns-envwin-flap pointer-events-auto absolute inset-x-0 bottom-0 h-1/2 bg-background"
                style={{ clipPath: `inset(${a * 100}% 0 0 0)` }}
              />
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-5 py-2">
        {orderedSwitches.map((scope) => {
          const labelId = `${uid}-${scope.id}-label`;
          const descId = `${uid}-${scope.id}-desc`;
          const checked = isOpen(scope);
          return (
            <div
              key={scope.id}
              className="flex items-start justify-between gap-4 py-2.5 first:pt-3 last:pb-3"
            >
              <div className="min-w-0">
                <div id={labelId} className="text-sm text-foreground">
                  {scope.label}
                </div>
                <div id={descId} className="mt-0.5 text-xs text-ns-muted">
                  {scope.required ? "Required by this app. " : ""}
                  {`Shows: ${scope.sample}`}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-labelledby={labelId}
                aria-describedby={descId}
                aria-disabled={scope.required || undefined}
                data-envelope-switch={scope.id}
                onClick={() => toggle(scope)}
                className={`ns-envwin-track relative h-5 w-9 shrink-0 rounded-full border border-border p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  scope.required ? "cursor-default" : ""
                }`}
                style={{
                  backgroundColor: checked ? "var(--ns-accent)" : "var(--border)",
                  borderColor: checked ? "var(--ns-accent)" : "var(--border)",
                  opacity: scope.required ? 0.65 : 1,
                }}
              >
                <span
                  aria-hidden
                  className="ns-envwin-thumb block h-4 w-4 rounded-full bg-background"
                  style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>
          );
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        {allowLabel}
      </p>

      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={handleDeny}
          className="ns-envwin-deny rounded-md border border-border px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={handleAllow}
          className="ns-envwin-allow rounded-md border border-ns-accent px-3 py-1.5 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ backgroundColor: "color-mix(in srgb, var(--ns-accent) 10%, transparent)" }}
        >
          {allowLabel}
        </button>
      </div>
    </div>
  );
}
