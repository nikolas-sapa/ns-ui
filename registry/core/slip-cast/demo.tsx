"use client";

import { useEffect, useState } from "react";
import { SlipCast, type JsonRecord, type JsonValue, type SlotSchema } from "./component";

// A structured-extraction tool call: a flat header, a nested "flags" object,
// and a "legs" array of objects — the three shapes the component has to
// prove out (scalar slot, nested-object container, growing array with a
// ghost buffer). `SCHEMA` is known in full up front, exactly as it would be
// the moment a model's tool-call schema resolves, before any argument value
// exists.

const SCHEMA: SlotSchema[] = [
  { key: "origin", kind: "string" },
  { key: "destination", kind: "string" },
  { key: "travelers", kind: "number" },
  {
    key: "flags",
    kind: "object",
    fields: [
      { key: "nonstopOnly", kind: "boolean" },
      { key: "cabin", kind: "string" },
      { key: "loyaltyProgram", kind: "null" },
    ],
  },
  {
    key: "legs",
    kind: "array",
    item: [
      { key: "carrier", kind: "string" },
      { key: "price", kind: "number" },
      { key: "durationMin", kind: "number" },
    ],
  },
];

// Ordered arrival of dotted paths, the way keys land as a model streams
// tool-call arguments token by token. Setting "legs.0.carrier" before
// "legs.0.price" creates the array entry on first touch.
const STREAM: Array<{ path: string; value: JsonValue }> = [
  { path: "origin", value: "SEA" },
  { path: "destination", value: "NRT" },
  { path: "travelers", value: 2 },
  { path: "flags.nonstopOnly", value: true },
  { path: "flags.cabin", value: "premium-economy" },
  { path: "flags.loyaltyProgram", value: null },
  { path: "legs.0.carrier", value: "ANA" },
  { path: "legs.0.durationMin", value: 583 },
  { path: "legs.0.price", value: 742 },
  { path: "legs.1.carrier", value: "Delta" },
  { path: "legs.1.price", value: 811 },
  { path: "legs.1.durationMin", value: 611 },
  { path: "legs.2.carrier", value: "JAL" },
  { path: "legs.2.price", value: 693 },
  { path: "legs.2.durationMin", value: 597 },
];

const STEP_MS = 480;
const HOLD_MS = 2600;

function setAtPath(root: JsonRecord, path: string, value: JsonValue): JsonRecord {
  const parts = path.split(".");
  const next: JsonRecord = { ...root };
  let cursor: Record<string, JsonValue> = next;
  parts.forEach((part, i) => {
    const isLast = i === parts.length - 1;
    if (isLast) {
      cursor[part] = value;
      return;
    }
    const isArrayKey = /^\d+$/.test(parts[i + 1]);
    const existing = cursor[part];
    const container: JsonValue = isArrayKey
      ? Array.isArray(existing)
        ? [...existing]
        : []
      : existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...(existing as JsonRecord) }
        : {};
    cursor[part] = container;
    cursor = container as Record<string, JsonValue>;
  });
  return next;
}

export default function SlipCastDemo() {
  const [cycle, setCycle] = useState(0);
  const [step, setStep] = useState(0);

  // remounts the whole stream on a loop so the preview / autoplay card is
  // always mid-pour rather than settling on a finished, static frame
  useEffect(() => {
    setStep(0);
    const totalMs = STREAM.length * STEP_MS + HOLD_MS;
    const tick = setInterval(() => {
      setStep((s) => (s < STREAM.length ? s + 1 : s));
    }, STEP_MS);
    const restart = setTimeout(() => setCycle((c) => c + 1), totalMs);
    return () => {
      clearInterval(tick);
      clearTimeout(restart);
    };
  }, [cycle]);

  let value: JsonRecord = {};
  for (let i = 0; i < step; i++) {
    value = setAtPath(value, STREAM[i].path, STREAM[i].value);
  }
  const streaming = step < STREAM.length;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-md border border-border bg-background p-5">
        <SlipCast key={cycle} schema={SCHEMA} value={value} streaming={streaming} label="search_flights arguments" />
      </div>
    </div>
  );
}
