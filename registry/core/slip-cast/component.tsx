"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// SlipCast — pour streaming, schema-shaped JSON into a visible mold. The
// moment the schema is known (before a single token of data has arrived) the
// full shape of the answer renders as a skeleton of empty slots: every key
// already typeset in Geist Mono at --muted, sitting in a dashed 1px --border
// blank pre-sized by its declared type (numbers short, booleans a fixed
// true/false width, strings full-row so a long value never reflows the row
// that holds it). That skeleton IS the progress bar — there is no separate
// spinner or bar element anywhere in this component.
//
// As each value streams in, its slot — and only its slot — flips from
// pending to set: the dashed border crossfades to solid over 150ms
// ease-out-expo (border-style itself can't be animated, so this is two
// stacked frames whose opacity crosses over, not a literal style
// interpolation), the value drops in with a small spring overshoot
// (translateY 3px -> 0), and a 4px corner tick fades --muted -> --foreground.
// Nested objects get the same dashed->solid treatment on their own
// container, independent of whether their children have filled yet — a
// nested object "sets" the instant its key exists in the stream, even with
// every field inside it still dashed. Arrays keep two ghost rows appended
// past the last arrived item at all times, so the row a value is about to
// land in was already on screen, dashed, before it filled — nothing new
// reflows into existence under the incoming value itself, only the trailing
// ghost buffer grows. Nesting indents in fixed 16px steps.
//
// Content that mounts already-complete (a value with every field present on
// first render) skips the fill animation entirely — the "live" transitions
// only arm after mount, so a component that never streamed doesn't play a
// pointless cascade.
//
// Unlike a generic content-shaped loading skeleton (bars standing in for
// unknown prose), this is schema-driven and field-granular: real keys are
// typeset before any value exists, every slot tracks its own pending/set
// state independently, and a slot still dashed when streaming ends is left
// exactly as dashed — an honest "this field never arrived" rather than a
// skeleton dissolving into empty space. It renders the *shape* of a
// streaming payload; it does not own the character-level caret inside a
// value that is itself still arriving — that's kerf-caret's job, and the two
// compose (a string slot's value can itself be a kerf-caret span).
//
// Pure DOM + CSS: real dt/dd pairs inside real dl elements (nested objects
// get a nested dl, array items a dl per row), role=region with aria-busy
// while streaming, a visually-hidden aria-live=polite region that announces
// batched "N of M fields complete" milestones (debounced, never per-token),
// and exactly one focusable control per top-level object: a Copy JSON
// button. Colors are tokens only (--background --foreground --muted
// --border --accent); --accent appears only on the copy button's focus
// ring. prefers-reduced-motion drops every transition — slots simply appear
// filled, nothing eases.

export type SlotType = "string" | "number" | "boolean" | "null";
export type SlotKind = SlotType | "object" | "array";

export interface SlotSchema {
  /** the real field name, typeset verbatim as the dt */
  key: string;
  kind: SlotKind;
  /** children, for kind: "object" */
  fields?: SlotSchema[];
  /** shape of one array item, for kind: "array" — an object shape, or a scalar kind for a flat array */
  item?: SlotSchema[] | SlotType;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }
  | undefined;

export type JsonRecord = Record<string, JsonValue>;

export interface SlipCastProps {
  /** the known shape of the answer, available before any value has arrived */
  schema: SlotSchema[];
  /** the accumulated value so far — a deep-partial object; absent keys read as pending */
  value: JsonRecord | undefined;
  /** true while more values are still expected; drives aria-busy and the milestone copy */
  streaming?: boolean;
  /** accessible name for the region, and the noun the copy button acts on */
  label?: string;
  className?: string;
}

const GHOST_ROWS_AHEAD = 2;
const ANNOUNCE_DEBOUNCE_MS = 350;

function hasOwn(obj: unknown, key: string): obj is Record<string, JsonValue> {
  return typeof obj === "object" && obj !== null && Object.prototype.hasOwnProperty.call(obj, key);
}

function getAtPath(root: JsonValue, path: string): { present: boolean; value: JsonValue } {
  let cur: JsonValue = root;
  for (const part of path.split(".")) {
    if (!hasOwn(cur, part)) return { present: false, value: undefined };
    cur = (cur as JsonRecord)[part];
    if (cur === undefined) return { present: false, value: undefined };
  }
  return { present: true, value: cur };
}

/** Flattens the schema into the fixed set of slots the milestone count is
 * measured against. Arrays count as exactly one slot — their item rows are
 * unbounded and streaming, so they're excluded from the denominator or "4 of
 * 9" would keep retargeting mid-stream. */
function flattenSchema(fields: SlotSchema[], base = ""): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const path = base ? `${base}.${f.key}` : f.key;
    out.push(path);
    if (f.kind === "object" && f.fields) out.push(...flattenSchema(f.fields, path));
  }
  return out;
}

function formatScalar(kind: SlotType, value: JsonValue): ReactNode {
  if (kind === "null") return <span className="italic">null</span>;
  if (kind === "boolean") return value ? "true" : "false";
  if (kind === "number") return typeof value === "number" ? value.toLocaleString() : String(value ?? "");
  return typeof value === "string" ? value : String(value ?? "");
}

function ValueSlot({ kind, present, value }: { kind: SlotType; present: boolean; value: JsonValue }) {
  return (
    <span className={`ns-slip-value-wrap ns-slip-${kind}`} data-state={present ? "set" : "pending"}>
      <span className="ns-slip-edge ns-slip-edge-dashed" aria-hidden="true" />
      <span className="ns-slip-edge ns-slip-edge-solid" aria-hidden="true" />
      <span className="ns-slip-tick" aria-hidden="true" />
      <span className="ns-slip-value">{present ? formatScalar(kind, value) : ""}</span>
    </span>
  );
}

function ObjectSlot({ present, children }: { present: boolean; children: ReactNode }) {
  // a div, not a span: a <dl> is flow content and cannot legally nest inside
  // phrasing content — a span wrapper here would get silently reparented by
  // the HTML parser, taking the edge-overlay positioning context with it
  return (
    <div className="ns-slip-container" data-state={present ? "set" : "pending"}>
      <span className="ns-slip-edge ns-slip-edge-dashed" aria-hidden="true" />
      <span className="ns-slip-edge ns-slip-edge-solid" aria-hidden="true" />
      <span className="ns-slip-tick" aria-hidden="true" />
      <dl className="ns-slip-dl">{children}</dl>
    </div>
  );
}

function renderField(field: SlotSchema, parent: JsonValue, depth: number, keyPrefix: string): ReactNode {
  const present = hasOwn(parent, field.key);
  const raw = present ? (parent as JsonRecord)[field.key] : undefined;
  const rowKey = `${keyPrefix}.${field.key}`;
  const indent = { paddingLeft: depth * 16 };

  if (field.kind === "object") {
    const nested = field.fields ?? [];
    return (
      <div className="ns-slip-row" style={indent} key={rowKey}>
        <dt className="ns-slip-key">{field.key}</dt>
        <dd>
          <ObjectSlot present={present}>
            {nested.map((child) => renderField(child, raw, depth + 1, rowKey))}
          </ObjectSlot>
        </dd>
      </div>
    );
  }

  if (field.kind === "array") {
    const arr = present && Array.isArray(raw) ? raw : [];
    const rowCount = arr.length + GHOST_ROWS_AHEAD;
    const itemFields = Array.isArray(field.item) ? field.item : undefined;
    const scalarKind: SlotType = typeof field.item === "string" ? field.item : "string";
    return (
      <div className="ns-slip-row" style={indent} key={rowKey}>
        <dt className="ns-slip-key">{field.key}</dt>
        <dd>
          <ObjectSlot present={present}>
            {Array.from({ length: rowCount }, (_, i) => {
              const itemPresent = i < arr.length;
              const itemValue = itemPresent ? arr[i] : undefined;
              const itemRowKey = `${rowKey}.${i}`;
              if (itemFields) {
                return (
                  <div className="ns-slip-row" style={{ paddingLeft: (depth + 1) * 16 }} key={itemRowKey}>
                    <dt className="ns-slip-index">[{i}]</dt>
                    <dd>
                      <ObjectSlot present={itemPresent}>
                        {itemFields.map((child) => renderField(child, itemValue, depth + 2, itemRowKey))}
                      </ObjectSlot>
                    </dd>
                  </div>
                );
              }
              return (
                <div className="ns-slip-row" style={{ paddingLeft: (depth + 1) * 16 }} key={itemRowKey}>
                  <dt className="ns-slip-index">[{i}]</dt>
                  <dd>
                    <ValueSlot kind={scalarKind} present={itemPresent} value={itemValue} />
                  </dd>
                </div>
              );
            })}
          </ObjectSlot>
        </dd>
      </div>
    );
  }

  return (
    <div className="ns-slip-row" style={indent} key={rowKey}>
      <dt className="ns-slip-key">{field.key}</dt>
      <dd>
        <ValueSlot kind={field.kind} present={present} value={raw} />
      </dd>
    </div>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path below
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const CSS = `
.ns-slip-cast dt,.ns-slip-cast dd,.ns-slip-cast dl{margin:0;padding:0}
.ns-slip-cast .ns-slip-dl{display:flex;flex-direction:column;gap:8px}
.ns-slip-cast .ns-slip-row{display:flex;align-items:flex-start;gap:12px}
.ns-slip-cast .ns-slip-row > dd{flex:1;min-width:0;display:flex}
.ns-slip-cast .ns-slip-key,.ns-slip-cast .ns-slip-index{
  flex:0 0 auto;min-width:64px;padding-top:3px;
  font-family:var(--font-mono);font-size:11.5px;line-height:18px;color:var(--muted);white-space:nowrap;
}
.ns-slip-cast .ns-slip-index{opacity:.75;min-width:32px}

.ns-slip-cast .ns-slip-container{position:relative;display:block;flex:1;padding:8px;border-radius:12px}
.ns-slip-cast .ns-slip-container > .ns-slip-dl{position:relative}

.ns-slip-cast .ns-slip-value-wrap{
  position:relative;display:inline-flex;align-items:center;box-sizing:border-box;
  min-height:22px;padding:2px 7px;border-radius:6px;
}
.ns-slip-cast .ns-slip-string{display:flex;width:100%}
.ns-slip-cast .ns-slip-number{min-width:3.5ch;justify-content:flex-end;font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.ns-slip-cast .ns-slip-boolean{width:5ch;font-family:var(--font-mono)}
.ns-slip-cast .ns-slip-null{width:4ch;font-family:var(--font-mono)}

.ns-slip-cast .ns-slip-edge{position:absolute;inset:0;border-radius:inherit;pointer-events:none}
.ns-slip-cast .ns-slip-edge-dashed{border:1px dashed var(--border);opacity:1}
.ns-slip-cast .ns-slip-edge-solid{border:1px solid var(--border);opacity:0}
.ns-slip-cast [data-state="set"] > .ns-slip-edge-dashed{opacity:0}
.ns-slip-cast [data-state="set"] > .ns-slip-edge-solid{opacity:1}
.ns-slip-cast [data-state="set"] > .ns-slip-tick{background:var(--foreground)}
.ns-slip-cast [data-state="set"] > .ns-slip-value{opacity:1;transform:translateY(0)}

.ns-slip-cast .ns-slip-tick{
  position:absolute;top:-1px;left:-1px;width:4px;height:4px;background:var(--muted);
}
.ns-slip-cast .ns-slip-value{position:relative;font-size:12.5px;color:var(--foreground);opacity:0;transform:translateY(3px)}

/* the fill transitions only arm once mounted-live, so pre-filled content
   (a value that arrived complete on first render) never plays a cascade it
   didn't earn */
.ns-slip-cast.ns-slip-live .ns-slip-edge{transition:opacity 150ms cubic-bezier(.16,1,.3,1)}
.ns-slip-cast.ns-slip-live .ns-slip-tick{transition:background-color 200ms ease-out}
.ns-slip-cast.ns-slip-live .ns-slip-value{transition:transform 320ms cubic-bezier(.34,1.56,.64,1),opacity 200ms ease-out}

.ns-slip-cast .ns-slip-copy{outline:none}
.ns-slip-cast .ns-slip-copy:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

@media (prefers-reduced-motion: reduce){
  .ns-slip-cast .ns-slip-edge,.ns-slip-cast .ns-slip-tick,.ns-slip-cast .ns-slip-value{transition:none !important}
}
`;

export function SlipCast({ schema, value, streaming = false, label = "Structured output", className = "" }: SlipCastProps) {
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [announced, setAnnounced] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // arms the fill transitions one frame after mount so a value that is
    // already complete on first paint renders filled instantly, not animated
    const id = requestAnimationFrame(() => setLive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const flat = useMemo(() => flattenSchema(schema), [schema]);
  const filled = useMemo(() => flat.filter((path) => getAtPath(value, path).present).length, [flat, value]);
  const total = flat.length;

  useEffect(() => {
    if (announceTimer.current) clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => {
      setAnnounced(`${filled} of ${total} field${total === 1 ? "" : "s"} complete`);
    }, ANNOUNCE_DEBOUNCE_MS);
    return () => {
      if (announceTimer.current) clearTimeout(announceTimer.current);
    };
  }, [filled, total]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const handleCopy = async () => {
    const ok = await copyToClipboard(JSON.stringify(value ?? {}, null, 2));
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      role="region"
      aria-busy={streaming}
      aria-label={label}
      className={`ns-slip-cast ${live ? "ns-slip-live" : ""} ${className}`}
    >
      <style>{CSS}</style>

      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{label}</span>
        <button
          type="button"
          className="ns-slip-copy rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-muted transition-colors duration-150 hover:text-foreground"
          onClick={handleCopy}
          aria-label={copied ? `${label} copied to clipboard` : `Copy ${label} as JSON`}
        >
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>

      <dl className="ns-slip-dl">{schema.map((field) => renderField(field, value, 0, "root"))}</dl>

      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  );
}
