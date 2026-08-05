// Proves the two properties the daily status strip depends on.
// Usage: node convex/status.test.ts
//
// Runs offline against an in-memory store, not against a Convex deployment —
// the logic under test (`convex/status.logic.ts`) is deliberately free of
// Convex imports so `convex/status.ts` and this file can exercise the exact
// same code path. The two-dot filename also keeps the Convex bundler from
// registering this file as a deployed module
// (node_modules/convex/dist/cjs/bundler/index.js skips any basename with more
// than one dot).
//
// One load-bearing assumption, named rather than hidden: `since()` below
// reimplements the real query's range scan (`q.gte("day", cutoff)`) in memory.
// The two agree because a zero-padded YYYY-MM-DD sorts lexicographically
// exactly as it sorts chronologically, which is why the day is stored as that
// string in the first place.
import assert from "node:assert/strict";
import {
  SNAPSHOT_WINDOW_DAYS,
  upsertSnapshot,
  utcDay,
  windowStartDay,
  type SnapshotRow,
  type SnapshotStore,
} from "./status.logic.ts";

// The same shape `convex/status.ts` builds over `ctx.db`, backed by an array.
// `patch` mirrors Convex's semantics: an explicit `undefined` removes a field.
type Stored = SnapshotRow & { id: number };

function makeStore() {
  const rows: Stored[] = [];
  let nextId = 1;
  const store: SnapshotStore<number> = {
    find: async (day, serviceId) => {
      const row = rows.find((r) => r.day === day && r.serviceId === serviceId);
      return row === undefined ? null : { id: row.id };
    },
    insert: async (row) => {
      // No normalizing: the fake stores exactly the keys it was handed, so an
      // insert that leaked an explicit `detail: undefined` would show up here
      // instead of being papered over.
      assert.ok(
        !("detail" in row && row.detail === undefined),
        "insert was handed an explicit undefined detail",
      );
      rows.push({ id: nextId, ...row } as Stored);
      nextId += 1;
    },
    patch: async (id, fields) => {
      const row = rows.find((r) => r.id === id);
      assert.ok(row, `patch: no row ${id}`);
      row.state = fields.state;
      row.recordedAt = fields.recordedAt;
      if (fields.detail === undefined) delete row.detail;
      else row.detail = fields.detail;
    },
  };
  // The read `convex/status.ts` performs: every row at or after the cutoff
  // day, and NOTHING else. No padding, no synthesized days.
  const since = (cutoff: string) => rows.filter((r) => r.day >= cutoff);
  return { store, rows, since };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const today = Date.UTC(2026, 7, 5, 6, 0, 0); // a fixed clock, not Date.now()
const yesterday = today - DAY_MS;

// --- day bucketing is UTC and stable -------------------------------------
assert.equal(utcDay(today), "2026-08-05");
assert.equal(utcDay(yesterday), "2026-08-04");
// A run at 23:59 UTC and one at 00:01 UTC the same calendar day agree.
assert.equal(utcDay(Date.UTC(2026, 7, 5, 23, 59, 59)), "2026-08-05");
// The window includes today plus the 89 days before it.
assert.equal(windowStartDay(today, SNAPSHOT_WINDOW_DAYS), "2026-05-08");
assert.equal(
  Math.round((today - Date.parse(`${windowStartDay(today)}T06:00:00.000Z`)) / DAY_MS),
  SNAPSHOT_WINDOW_DAYS - 1,
);

// --- 1. the upsert is idempotent -----------------------------------------
{
  const { store, rows } = makeStore();
  const day = utcDay(today);

  const first = await upsertSnapshot(store, {
    day,
    serviceId: "live-origin",
    state: "ok",
    detail: "298 items",
    recordedAt: today,
  });
  const second = await upsertSnapshot(store, {
    day,
    serviceId: "live-origin",
    state: "down",
    detail: "origin answered 503",
    recordedAt: today + 60_000,
  });

  assert.equal(first, "inserted");
  assert.equal(second, "updated");
  assert.equal(rows.length, 1, "a second run the same day added a second bar");
  assert.equal(rows[0].state, "down", "the re-run did not overwrite the state");
  assert.equal(rows[0].detail, "origin answered 503");
  assert.equal(rows[0].recordedAt, today + 60_000);

  // A third run that measured no detail CLEARS the old caption rather than
  // carrying a stale fact forward under a fresh timestamp.
  await upsertSnapshot(store, {
    day,
    serviceId: "live-origin",
    state: "ok",
    recordedAt: today + 120_000,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].detail, undefined, "a stale detail survived the re-run");

  // A different service the same day is a different bar, not an overwrite.
  await upsertSnapshot(store, {
    day,
    serviceId: "convex-read-path",
    state: "ok",
    recordedAt: today,
  });
  assert.equal(rows.length, 2);
}

// --- 2. a day with no snapshot reads back ABSENT, never "ok" -------------
{
  const { store, since } = makeStore();
  await upsertSnapshot(store, {
    day: utcDay(today),
    serviceId: "live-origin",
    state: "ok",
    recordedAt: today,
  });

  const window = since(windowStartDay(today));
  const yesterdayRows = window.filter((r) => r.day === utcDay(yesterday));

  assert.equal(yesterdayRows.length, 0, "an unmeasured day produced a row");
  // Stated the other way round, because this is the failure that matters: the
  // read must not hand the page a healthy bar for a day nothing was measured.
  assert.ok(
    !window.some((r) => r.day === utcDay(yesterday) && r.state === "ok"),
    "an unmeasured day read back as ok",
  );
  // ...and the day that WAS measured is present, so the assertion above is
  // not passing merely because the window is empty.
  assert.equal(window.length, 1);
  assert.equal(window[0].day, utcDay(today));

  // Nothing in this module can produce a row for a day it was not handed:
  // the whole 90-day window holds exactly the one day that was written.
  const distinctDays = new Set(window.map((r) => r.day));
  assert.equal(distinctDays.size, 1);
}

console.log("convex/status.logic.ts: upsert idempotent, unmeasured days absent — ok");
