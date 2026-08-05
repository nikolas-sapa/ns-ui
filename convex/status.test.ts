// Proves the properties the daily status strip depends on: one bar per
// (day, service), a bar that aggregates EVERY sample of its day rather than
// the last one written, and a day nobody sampled staying absent.
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
  deriveState,
  recordSample,
  utcDay,
  windowStartDay,
  type SnapshotCounts,
  type SnapshotRow,
  type SnapshotStore,
} from "./status.logic.ts";

// The same shape `convex/status.ts` builds over `ctx.db`, backed by an array.
// `patch` mirrors Convex's semantics: an explicit `undefined` removes a field.
// The counters are optional here and NOT in `SnapshotRow`, on purpose: a row
// as it exists in the deployment today was written before accumulation
// shipped and carries none. The fake stores that shape faithfully so the
// legacy path is exercised against the real code rather than assumed to work.
type Legacy = Omit<SnapshotRow, "sampleCount" | "degradedCount" | "downCount">;
type Stored = Legacy & Partial<SnapshotCounts> & { id: number };

function makeStore(seed: Legacy[] = []) {
  const rows: Stored[] = [];
  let nextId = 1;
  for (const row of seed) {
    rows.push({ id: nextId, ...row });
    nextId += 1;
  }
  const store: SnapshotStore<number> = {
    find: async (day, serviceId) => {
      const row = rows.find((r) => r.day === day && r.serviceId === serviceId);
      if (row === undefined) return null;
      return {
        id: row.id,
        state: row.state,
        detail: row.detail,
        sampleCount: row.sampleCount,
        degradedCount: row.degradedCount,
        downCount: row.downCount,
      };
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
      row.sampleCount = fields.sampleCount;
      row.degradedCount = fields.degradedCount;
      row.downCount = fields.downCount;
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

// --- the derivation itself ------------------------------------------------
// Stated on its own before any store is involved, because every bar on the
// page is this function's output.
assert.equal(deriveState({ sampleCount: 6, degradedCount: 0, downCount: 0 }), "ok");
assert.equal(deriveState({ sampleCount: 6, degradedCount: 1, downCount: 0 }), "degraded");
assert.equal(deriveState({ sampleCount: 6, degradedCount: 0, downCount: 1 }), "down");
// Down beats degraded: a day that was ever actually down is not "degraded".
assert.equal(deriveState({ sampleCount: 6, degradedCount: 4, downCount: 1 }), "down");
// Zero samples is not a state. It is an absent day, and asking for its state
// is a bug rather than a healthy bar.
assert.throws(() => deriveState({ sampleCount: 0, degradedCount: 0, downCount: 0 }));

// --- 1. many samples in one day aggregate into ONE bar --------------------
{
  const { store, rows } = makeStore();
  const day = utcDay(today);
  const at = (minutes: number) => today + minutes * 60_000;

  const first = await recordSample(store, {
    day,
    serviceId: "live-origin",
    state: "ok",
    detail: "298 items",
    recordedAt: at(0),
  });
  const second = await recordSample(store, {
    day,
    serviceId: "live-origin",
    state: "ok",
    detail: "298 items",
    recordedAt: at(10),
  });

  assert.equal(first, "inserted");
  assert.equal(second, "updated");
  assert.equal(rows.length, 1, "a second sample the same day added a second bar");
  assert.equal(rows[0].state, "ok", "two ok samples did not read ok");
  assert.deepEqual(
    [rows[0].sampleCount, rows[0].degradedCount, rows[0].downCount],
    [2, 0, 0],
  );
  assert.equal(rows[0].recordedAt, at(10), "recordedAt is not the latest sample");

  // The sample that changes the day's verdict.
  await recordSample(store, {
    day,
    serviceId: "live-origin",
    state: "down",
    detail: "origin answered 503",
    recordedAt: at(20),
  });
  assert.equal(rows[0].state, "down");
  assert.deepEqual(
    [rows[0].sampleCount, rows[0].degradedCount, rows[0].downCount],
    [3, 0, 1],
  );

  // THE POINT OF THE WHOLE CHANGE: everything recovering afterwards does not
  // erase the outage. Nine more ok samples, and the day still reads down.
  for (let i = 1; i <= 9; i += 1) {
    await recordSample(store, {
      day,
      serviceId: "live-origin",
      state: "ok",
      detail: "298 items",
      recordedAt: at(20 + i * 10),
    });
  }
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, "down", "later ok samples overwrote a down day");
  assert.deepEqual(
    [rows[0].sampleCount, rows[0].degradedCount, rows[0].downCount],
    [12, 0, 1],
  );
  // The caption still describes the state the bar shows, not the last sample
  // taken — an ok sample must never caption a down day "298 items".
  assert.equal(rows[0].detail, "origin answered 503");
  assert.equal(rows[0].recordedAt, at(110));

  // Degraded only when nothing was down.
  await recordSample(store, {
    day,
    serviceId: "published-packages",
    state: "ok",
    recordedAt: at(0),
  });
  await recordSample(store, {
    day,
    serviceId: "published-packages",
    state: "degraded",
    detail: "version drift",
    recordedAt: at(10),
  });
  const pkg = rows.find((r) => r.serviceId === "published-packages");
  assert.ok(pkg);
  // A different service the same day is a different bar, not an overwrite.
  assert.equal(rows.length, 2);
  assert.equal(pkg.state, "degraded");
  assert.equal(pkg.detail, "version drift");
  assert.deepEqual([pkg.sampleCount, pkg.degradedCount, pkg.downCount], [2, 1, 0]);

  // A matching sample with no detail CLEARS the old caption rather than
  // carrying a stale fact forward under a fresh timestamp.
  await recordSample(store, {
    day,
    serviceId: "published-packages",
    state: "degraded",
    recordedAt: at(20),
  });
  assert.equal(pkg.detail, undefined, "a stale detail survived a later sample");
  assert.equal(pkg.sampleCount, 3);

  // Tomorrow is a fresh bar with fresh counters — accumulation never leaks
  // across the day boundary.
  await recordSample(store, {
    day: utcDay(today + DAY_MS),
    serviceId: "live-origin",
    state: "ok",
    recordedAt: today + DAY_MS,
  });
  const tomorrow = rows.find((r) => r.day === utcDay(today + DAY_MS));
  assert.ok(tomorrow);
  assert.equal(tomorrow.state, "ok");
  assert.deepEqual(
    [tomorrow.sampleCount, tomorrow.degradedCount, tomorrow.downCount],
    [1, 0, 0],
  );
}

// --- 1b. a single down sample makes the day down -------------------------
{
  const { store, rows } = makeStore();
  const day = utcDay(today);
  await recordSample(store, {
    day,
    serviceId: "live-origin",
    state: "down",
    detail: "origin answered 503",
    recordedAt: today,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, "down", "the first sample of a day was not honoured");
  assert.deepEqual(
    [rows[0].sampleCount, rows[0].degradedCount, rows[0].downCount],
    [1, 0, 1],
  );
}

// --- 1c. a row written before accumulation keeps counting from 1 ---------
{
  // Exactly what is in the deployment now: one row, one ping, no counters.
  const { store, rows } = makeStore([
    {
      day: utcDay(today),
      serviceId: "live-origin",
      state: "down",
      detail: "origin answered 503",
      recordedAt: today,
    },
  ]);

  await recordSample(store, {
    day: utcDay(today),
    serviceId: "live-origin",
    state: "ok",
    detail: "298 items",
    recordedAt: today + 600_000,
  });

  const row = rows[0];
  assert.equal(rows.length, 1);
  // The legacy row IS one recorded sample, so the day now holds two — and the
  // down it recorded is not erased by the ok that followed.
  assert.deepEqual([row.sampleCount, row.degradedCount, row.downCount], [2, 0, 1]);
  assert.equal(row.state, "down");
  assert.equal(row.detail, "origin answered 503");
}

// --- 2. a day with no snapshot reads back ABSENT, never "ok" -------------
{
  const { store, since } = makeStore();
  await recordSample(store, {
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

  // And an unsampled day cannot even be described as zero samples: there is
  // no row to carry a `sampleCount` of 0, which is what "no data" means.
  assert.equal(
    window.find((r) => r.day === utcDay(yesterday)),
    undefined,
  );
}

console.log(
  "convex/status.logic.ts: one bar per day/service, samples aggregate, " +
    "unmeasured days absent — ok",
);
