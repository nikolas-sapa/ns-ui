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
import { readFileSync } from "node:fs";
import {
  BACKFILL_WINDOW_DAYS,
  SNAPSHOT_WINDOW_DAYS,
  backfillDetail,
  dayWindow,
  deriveState,
  isDayInBackfillWindow,
  isValidCalendarDay,
  prettyDay,
  recordSample,
  secretMatches,
  summarizeService,
  toBarState,
  uptimeFigure,
  utcDay,
  windowStartDay,
  type SnapshotCounts,
  type SnapshotRow,
  type SnapshotState,
  type SnapshotStore,
} from "./status.logic.ts";

// The same shape `convex/status.ts` builds over `ctx.db`, backed by an array.
// `patch` mirrors Convex's semantics: an explicit `undefined` removes a field.
// The counters and `lastState` are optional here and NOT in `SnapshotRow`, on
// purpose: a row as it exists in the deployment today was written before
// accumulation (or before `lastState`) shipped and carries none of them. The
// fake stores that shape faithfully so the legacy path is exercised against
// the real code rather than assumed to work.
type Legacy = Omit<SnapshotRow, "sampleCount" | "degradedCount" | "downCount" | "lastState" | "backfilled">;
type Stored = Legacy &
  Partial<SnapshotCounts> &
  Partial<{ lastState: SnapshotState; backfilled: boolean }> & { id: number };

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
        backfilled: row.backfilled,
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
      // Always overwritten, never conditionally kept — unlike `detail`, this
      // is not an aggregate, see the doc comment on `SnapshotRow.lastState`.
      row.lastState = fields.lastState;
      // Sticky, see the doc comment on `SnapshotRow.backfilled`.
      row.backfilled = fields.backfilled;
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

// --- 3. the owner's three questions, end to end --------------------------
// A. a degraded sample is never rounded up to ok.
// B. a down sample makes the day down.
// C. a past day keeps the state it earned, and a later sample can only ever
//    make a day WORSE, never better.
// Each block writes samples through `recordSample`, reads them back the way
// `convex/status.ts.recent` does, and renders them the way the strip does.
{
  const day = utcDay(today);
  const at = (m: number) => today + m * 60_000;

  // A. five ok samples and one degraded → the bar is DEGRADED, not ok.
  {
    const { store, rows, since } = makeStore();
    for (let i = 0; i < 5; i += 1) {
      await recordSample(store, {
        day,
        serviceId: "published-cli",
        state: "ok",
        recordedAt: at(i * 10),
      });
    }
    await recordSample(store, {
      day,
      serviceId: "published-cli",
      state: "degraded",
      detail: "version drift",
      recordedAt: at(50),
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, "degraded", "one degraded sample was rounded up to ok");
    assert.deepEqual(
      [rows[0].sampleCount, rows[0].degradedCount, rows[0].downCount],
      [6, 1, 0],
    );
    // ...and the strip draws it degraded rather than ok.
    const window = dayWindow(new Date(today));
    const summary = summarizeService("published-cli", window, since(windowStartDay(today)));
    assert.equal(summary.bars[summary.bars.length - 1].state, "degraded");
    assert.equal(summary.latest, "degraded");
    // A degraded day is a recorded day, and it is NOT an ok one.
    assert.equal(summary.recordedDays, 1);
    assert.equal(summary.okDays, 0);
    assert.equal(uptimeFigure(summary), `0.0% · 1 day recorded since ${prettyDay(day)}`);
  }

  // B. ok, then degraded, then down → the worst sample wins.
  {
    const { store, rows, since } = makeStore();
    for (const [i, state] of (["ok", "degraded", "down"] as const).entries()) {
      await recordSample(store, {
        day,
        serviceId: "live-origin",
        state,
        recordedAt: at(i * 10),
      });
    }
    assert.equal(rows[0].state, "down", "a down sample did not win over ok/degraded");
    const summary = summarizeService(
      "live-origin",
      dayWindow(new Date(today)),
      since(windowStartDay(today)),
    );
    assert.equal(summary.bars[summary.bars.length - 1].state, "down");
    assert.equal(summary.okDays, 0);
  }

  // B2. THE OWNER'S EXACT SCENARIO — degraded, then ok, same day: the day
  // resolves to degraded, not ok, and is distinguishable from a day that was
  // never degraded ("recovered by end of day" on the bar). This is the
  // 2026-08-20 incident shape: a stale published package, then a republish
  // that fixed it, both on the same UTC day.
  {
    const { store, rows, since } = makeStore();
    await recordSample(store, {
      day,
      serviceId: "published-cli",
      state: "degraded",
      detail: "0.6.0 published vs 0.7.0 in this repo; 326 components in the published package vs 389 in this build",
      recordedAt: at(0),
    });
    await recordSample(store, {
      day,
      serviceId: "published-cli",
      state: "ok",
      detail: "npm dist-tags latest for @nikolas.sapa/ns-ui: 0.7.0, and data/registry-index.json indexes every component in this build",
      recordedAt: at(480),
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, "degraded", "an ok sample after a degraded one flipped the day to ok");
    assert.equal(rows[0].lastState, "ok", "the last sample's own state was not recorded");
    assert.deepEqual(
      [rows[0].sampleCount, rows[0].degradedCount, rows[0].downCount],
      [2, 1, 0],
    );
    // `detail` follows `state`, not the newest sample — see the doc comment
    // on `recordSample`. The ok sample's detail must NOT caption this day.
    assert.equal(rows[0].detail?.includes("326 components"), true);

    const summary = summarizeService(
      "published-cli",
      dayWindow(new Date(today)),
      since(windowStartDay(today)),
    );
    const bar = summary.bars[summary.bars.length - 1];
    assert.equal(bar.state, "degraded", "the day did not resolve to degraded");
    assert.equal(bar.recovered, true, "a degraded-then-ok day was not marked recovered");
    assert.equal(summary.okDays, 0, "a recovered day counted toward okDays");
    assert.equal(summary.latest, "degraded");

    // A day that was NEVER degraded must not read as recovered.
    const cleanStore = makeStore();
    await recordSample(cleanStore.store, {
      day,
      serviceId: "published-mcp",
      state: "ok",
      recordedAt: at(0),
    });
    const cleanSummary = summarizeService(
      "published-mcp",
      dayWindow(new Date(today)),
      cleanStore.since(windowStartDay(today)),
    );
    assert.equal(cleanSummary.bars[cleanSummary.bars.length - 1].recovered, false);
  }

  // C. a later ok sample cannot flip a down day back to ok — including a day
  //    in the PAST, read back after the days that followed it were written.
  {
    const { store, rows, since } = makeStore();
    const outage = utcDay(today - 3 * DAY_MS);
    await recordSample(store, {
      day: outage,
      serviceId: "live-origin",
      state: "down",
      detail: "origin answered 503",
      recordedAt: today - 3 * DAY_MS,
    });
    await recordSample(store, {
      day: outage,
      serviceId: "live-origin",
      state: "ok",
      detail: "298 items",
      recordedAt: today - 3 * DAY_MS + 600_000,
    });
    // Three clean days after it.
    for (let d = 2; d >= 0; d -= 1) {
      await recordSample(store, {
        day: utcDay(today - d * DAY_MS),
        serviceId: "live-origin",
        state: "ok",
        recordedAt: today - d * DAY_MS,
      });
    }
    const outageRow = rows.find((r) => r.day === outage);
    assert.ok(outageRow);
    assert.equal(outageRow.state, "down", "a later ok sample flipped a down day to ok");
    assert.equal(outageRow.detail, "origin answered 503");

    const window = dayWindow(new Date(today));
    const summary = summarizeService("live-origin", window, since(windowStartDay(today)));
    const bar = summary.bars.find((b) => b.day === outage);
    assert.ok(bar, "the outage day fell outside the rendered window");
    assert.equal(bar.state, "down", "the past outage did not render as down");
    assert.equal(bar.detail, "origin answered 503");
    // 4 recorded days, 3 of them ok: the outage is in the denominator and out
    // of the numerator.
    assert.equal(summary.recordedDays, 4);
    assert.equal(summary.okDays, 3);
    assert.equal(uptimeFigure(summary), `75.0% · 4 days recorded since ${prettyDay(outage)}`);
    assert.equal(summary.latest, "ok");
  }
}

// --- 4. the window: one slot per day, and a gap that stays a gap ----------
{
  const window = dayWindow(new Date(today));
  assert.equal(window.length, SNAPSHOT_WINDOW_DAYS);
  assert.equal(window[window.length - 1], utcDay(today), "the strip does not end today");
  assert.equal(window[0], windowStartDay(today), "the strip and the query disagree on the cutoff");
  // Strictly ascending, one calendar day apart, no repeats — the property a
  // month or year boundary would break.
  for (let i = 1; i < window.length; i += 1) {
    assert.equal(
      Date.parse(`${window[i]}T00:00:00.000Z`) - Date.parse(`${window[i - 1]}T00:00:00.000Z`),
      DAY_MS,
      `window is not contiguous at ${window[i - 1]} → ${window[i]}`,
    );
  }
  assert.equal(new Set(window).size, SNAPSHOT_WINDOW_DAYS);

  // Rows on days 10, 9 and 7 back — day 8 is a hole nobody sampled.
  const { store, since } = makeStore();
  const held = new Map<string, string>();
  for (const [back, state] of [[10, "down"], [9, "degraded"], [7, "ok"]] as const) {
    const d = utcDay(today - back * DAY_MS);
    held.set(d, state);
    await recordSample(store, {
      day: d,
      serviceId: "live-origin",
      state,
      recordedAt: today - back * DAY_MS,
    });
  }
  const summary = summarizeService("live-origin", window, since(windowStartDay(today)));
  assert.equal(summary.bars.length, SNAPSHOT_WINDOW_DAYS);
  for (const bar of summary.bars) {
    // Every bar sits in ITS OWN day's slot: the hole stays a hole instead of
    // pulling the days after it one place left.
    assert.equal(
      bar.state,
      held.get(bar.day) ?? "nodata",
      `${bar.day} rendered ${bar.state}`,
    );
  }
  assert.equal(summary.bars[SNAPSHOT_WINDOW_DAYS - 1 - 8].state, "nodata", "the gap was filled");
  // The figure counts only the days that have data, and degraded is not ok.
  assert.equal(summary.recordedDays, 3);
  assert.equal(summary.okDays, 1);
  assert.equal(
    uptimeFigure(summary),
    `33.3% · 3 days recorded since ${prettyDay(utcDay(today - 10 * DAY_MS))}`,
  );
  // `recent` has no upper bound (`q.gte("day", cutoff)`), so a row dated
  // outside the window — clock skew, a manual write — reaches this function.
  // It is dropped, not slotted somewhere convenient, and it moves no other bar.
  const stray = summarizeService("live-origin", window, [
    ...since(windowStartDay(today)),
    { day: utcDay(today - 200 * DAY_MS), serviceId: "live-origin", state: "ok", detail: null },
    { day: utcDay(today + DAY_MS), serviceId: "live-origin", state: "ok", detail: null },
  ]);
  assert.equal(stray.recordedDays, 3, "a row outside the window entered the strip");
  assert.deepEqual(
    stray.bars.map((b) => b.state),
    summary.bars.map((b) => b.state),
  );

  // A row for a different service is not this service's bar.
  const other = summarizeService("published-cli", window, since(windowStartDay(today)));
  assert.equal(other.recordedDays, 0);
  assert.equal(uptimeFigure(other), "no snapshots recorded yet");
}

// --- 5. nothing recorded prints WORDS, never a number --------------------
{
  const window = dayWindow(new Date(today));
  const empty = summarizeService("live-origin", window, []);
  assert.equal(empty.recordedDays, 0);
  assert.equal(empty.okDays, 0);
  assert.equal(empty.firstRecordedDay, null);
  assert.equal(empty.latest, "nodata");
  assert.ok(
    empty.bars.every((b) => b.state === "nodata"),
    "an empty history produced a bar that was not NO DATA",
  );
  const figure = uptimeFigure(empty);
  assert.equal(figure, "no snapshots recorded yet");
  assert.ok(!/\d/.test(figure), "the empty-history figure printed a number");
}

// --- 6. an unrecognised state can never render as ok ----------------------
{
  assert.equal(toBarState("ok"), "ok");
  assert.equal(toBarState("degraded"), "degraded");
  assert.equal(toBarState("down"), "down");
  for (const bogus of ["", " ", "ok ", "OK", "Ok", "unknown", "operational", "up", "healthy", "null"]) {
    assert.equal(toBarState(bogus), "nodata", `"${bogus}" was not treated as NO DATA`);
  }
  // ...including when it arrives on a real row, through the real summary.
  const window = dayWindow(new Date(today));
  const summary = summarizeService("live-origin", window, [
    { day: utcDay(today), serviceId: "live-origin", state: "UP", detail: null },
  ]);
  assert.equal(summary.latest, "nodata");
  assert.equal(summary.okDays, 0);
  // An unknown state is excluded from BOTH sides of the fraction, so it can
  // neither inflate the figure nor deflate it.
  assert.equal(summary.recordedDays, 0);
  assert.equal(uptimeFigure(summary), "no snapshots recorded yet");

  // ...and it carries NO CAPTION either. The row still has a `detail` on it,
  // and letting that through would render `aria-label="5 Aug 2026 — no data:
  // 298 items in /r/registry.json"`: a measurement caption under a bar that
  // says nothing was measured. A NO DATA bar's detail is null, always.
  const captioned = summarizeService("live-origin", window, [
    { day: utcDay(today), serviceId: "live-origin", state: "UP", detail: "298 items in /r/registry.json" },
  ]);
  const captionedBar = captioned.bars[captioned.bars.length - 1];
  assert.equal(captionedBar.state, "nodata");
  assert.equal(
    captionedBar.detail,
    null,
    "a NO DATA bar carried a measurement caption",
  );
  assert.ok(
    captioned.bars.every((b) => b.state !== "nodata" || b.detail === null),
    "some NO DATA bar carried a caption",
  );
  // The days nobody wrote at all are unchanged by this: still nodata, still
  // captionless, so the assertion above is not passing because the window is
  // empty of rows.
  assert.equal(captioned.bars[0].state, "nodata");
  assert.equal(captioned.bars[0].detail, null);
  // A RECOGNISED state keeps its caption — the fix nulls captions on nodata
  // bars, it does not strip details from bars generally.
  const kept = summarizeService("live-origin", window, [
    { day: utcDay(today), serviceId: "live-origin", state: "down", detail: "origin answered 503" },
  ]);
  assert.equal(kept.bars[kept.bars.length - 1].detail, "origin answered 503");
}

// --- 8. the window label on the card is the strip's own length ------------
// The card prints "<n> days" under the bars. That number is read off the bars
// it drew, not typed a second time, so it cannot claim 90 days over a strip of
// some other length.
{
  const src = readFileSync(new URL("../app/status/uptime.tsx", import.meta.url), "utf8");
  assert.ok(
    src.includes("{bars.length} days"),
    "the card's window label is not counted off the bars it drew",
  );
  assert.ok(
    !/>\s*90 days\s*</.test(src),
    "the card still hardcodes a 90-day label",
  );
  assert.equal(dayWindow(new Date(today)).length, SNAPSHOT_WINDOW_DAYS);
  // A shorter window shortens the strip, and the label follows it because it
  // is the same number.
  assert.equal(summarizeService("live-origin", dayWindow(new Date(today), 7), []).bars.length, 7);
}

// --- 7. the colour map on the render side --------------------------------
// A literal-value claim, asserted literally against the source. The
// exhaustiveness half ("every BarState has a colour") is enforced by
// `Record<BarState, string>` under `npx tsc --noEmit`; what a type cannot
// state is WHICH colour, and that is what /status is read for.
{
  const src = readFileSync(new URL("../app/status/uptime.tsx", import.meta.url), "utf8");
  const map = src.slice(src.indexOf("const BAR:"), src.indexOf("const WORD:"));
  assert.ok(map.length > 0, "the BAR colour map is no longer in uptime.tsx");
  for (const [state, cls] of [
    ["ok", "bg-[var(--success)]"],
    ["degraded", "bg-ns-accent"], // the blue accent — amber is banned here
    ["down", "bg-[var(--error)]"],
    ["nodata", "bg-ns-muted/25"],
  ] as const) {
    assert.ok(
      map.includes(`${state}: "${cls}",`),
      `BAR.${state} is not ${cls}`,
    );
  }
  // No amber/orange/gold is ever PAINTED here, and --warning is never spent on
  // this page even though the token exists. The banned forms are the paint
  // ones, so the check cannot be weakened by editing the header comment that
  // names those colours in order to ban them.
  for (const banned of [
    "var(--warning)",
    "bg-amber",
    "bg-orange",
    "text-amber",
    "text-orange",
    "border-amber",
    "border-orange",
  ]) {
    assert.ok(!src.includes(banned), `uptime.tsx paints "${banned}"`);
  }
  // The one thing a colour map cannot say: down and degraded must not share a
  // swatch with ok.
  assert.ok(!map.includes("degraded: \"bg-[var(--success)]\""));

  // A recovered day's ONLY signal is this text, in both the accessible name
  // and its aria-hidden tooltip twin — there is no separate colour or legend
  // entry for it (see the file-level note on `Bar.recovered`). Proven
  // literally, the same way the colour map above is: if this string is
  // deleted or the `bar.recovered` guard around it is removed, this bit of
  // the change has no other test that would catch it.
  const RECOVERED_TEXT = ", recovered — last sample ok";
  const occurrences = src.split(RECOVERED_TEXT).length - 1;
  assert.ok(
    occurrences >= 2,
    `"${RECOVERED_TEXT}" must appear at least twice (accessible name + tooltip) — found ${occurrences}`,
  );
  assert.ok(
    src.includes(`bar.recovered ? "${RECOVERED_TEXT}"`),
    "the recovered text is not gated on bar.recovered",
  );
  // Never a claim about the day being OVER — see the file-level note on why
  // this is worded as "last sample ok" rather than "by end of day".
  assert.ok(!src.includes("end of day"), 'uptime.tsx must not claim a day is "over"');
}

// --- 9. backfill guards: day validity, the trailing window, future days ---
{
  // Strict shape, not just plausible-looking.
  assert.equal(isValidCalendarDay("2026-08-19"), true);
  for (const bogus of [
    "2026-8-19",
    "26-08-19",
    "2026/08/19",
    "2026-08-19T00:00:00Z",
    "2026-13-01", // no month 13
    "2026-02-30", // no such day, even though it round-trips through Date
    "2026-00-10", // no month 0
    "",
    "2026-08-19 ",
  ]) {
    assert.equal(isValidCalendarDay(bogus), false, `"${bogus}" was accepted as a calendar day`);
  }

  const now = Date.UTC(2026, 7, 21, 12, 0, 0); // fixed clock: 2026-08-21 noon UTC
  assert.equal(BACKFILL_WINDOW_DAYS, 30);

  // Today itself is in the window.
  assert.equal(isDayInBackfillWindow(utcDay(now), now), true);
  // The two days this task backfills.
  assert.equal(isDayInBackfillWindow("2026-08-19", now), true);
  assert.equal(isDayInBackfillWindow("2026-08-20", now), true);
  // Exactly 30 days back (BACKFILL_WINDOW_DAYS counts today inclusive, same
  // convention as `windowStartDay`/`SNAPSHOT_WINDOW_DAYS`) is the oldest day
  // still in the window; 31 days back is not.
  const day30back = utcDay(now - 29 * DAY_MS);
  const day31back = utcDay(now - 30 * DAY_MS);
  assert.equal(isDayInBackfillWindow(day30back, now), true, "the last day inside the window was rejected");
  assert.equal(isDayInBackfillWindow(day31back, now), false, "a day outside the window was accepted");

  // A future day is always rejected, even if it would otherwise fall inside
  // the trailing window's arithmetic.
  assert.equal(isDayInBackfillWindow(utcDay(now + DAY_MS), now), false, "a future day was accepted");
  assert.equal(isDayInBackfillWindow(utcDay(now + 365 * DAY_MS), now), false);
}

// --- 10. the shared secret check: closed by default, exact match only ----
{
  assert.equal(secretMatches("s3cret", "s3cret"), true);
  assert.equal(secretMatches("wrong", "s3cret"), false);
  assert.equal(secretMatches("", "s3cret"), false);
  // Unset/empty configured secret never matches, including an equally-empty
  // guess — closed by default, same rule `requireSnapshotSecret` states.
  assert.equal(secretMatches("", ""), false);
  assert.equal(secretMatches("s3cret", ""), false);
}

// --- 11. a backfilled sample lands on the day it names, not today --------
{
  const { store, rows } = makeStore();
  const now = Date.UTC(2026, 7, 21, 9, 0, 0); // "today" the mutation would run on
  const target = "2026-08-19"; // NOT utcDay(now)

  const result = await recordSample(store, {
    day: target,
    serviceId: "published-cli",
    state: "degraded",
    detail:
      "0.6.0 published vs 0.7.0 in this repo; 326 components in the published package vs 389 in this build",
    recordedAt: now,
    backfilled: true,
  });

  assert.equal(result, "inserted");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].day, target, "a backfilled sample did not land on its named day");
  assert.notEqual(rows[0].day, utcDay(now), "a backfilled sample landed on today instead of its named day");
  assert.equal(rows[0].backfilled, true, "a backfilled row was not flagged");
}

// --- 12. a backfilled row is flagged, sticky, and distinguishable --------
{
  // (a) a fresh backfilled insert is flagged.
  {
    const { store, rows } = makeStore();
    await recordSample(store, {
      day: "2026-08-19",
      serviceId: "published-cli",
      state: "degraded",
      recordedAt: Date.now(),
      backfilled: true,
    });
    assert.equal(rows[0].backfilled, true);
  }

  // (b) a live (non-backfilled) sample is NOT flagged.
  {
    const { store, rows } = makeStore();
    await recordSample(store, {
      day: utcDay(Date.now()),
      serviceId: "live-origin",
      state: "ok",
      recordedAt: Date.now(),
    });
    assert.equal(rows[0].backfilled, false, "a live sample was flagged as backfilled");
  }

  // (c) the flag is STICKY: a later, non-backfilled sample the same day does
  // not clear a flag a backfilled sample already set.
  {
    const { store, rows } = makeStore();
    const day = "2026-08-20";
    await recordSample(store, {
      day,
      serviceId: "published-cli",
      state: "degraded",
      recordedAt: Date.now(),
      backfilled: true,
    });
    await recordSample(store, {
      day,
      serviceId: "published-cli",
      state: "ok",
      recordedAt: Date.now() + 1000,
      // no `backfilled` here — a plain live sample
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].backfilled, true, "a live sample cleared a sticky backfilled flag");
  }

  // (d) that flag reads through to the render side (`HistoryEntry.backfilled`
  // -> `Bar.backfilled`), and a NO DATA day is never marked backfilled.
  {
    const { store, since } = makeStore();
    const day = "2026-08-19";
    await recordSample(store, {
      day,
      serviceId: "published-cli",
      state: "degraded",
      recordedAt: Date.now(),
      backfilled: true,
    });
    const window = dayWindow(new Date(Date.UTC(2026, 7, 21)));
    const summary = summarizeService("published-cli", window, since(windowStartDay(Date.UTC(2026, 7, 21))));
    const bar = summary.bars.find((b) => b.day === day);
    assert.ok(bar);
    assert.equal(bar.backfilled, true, "a backfilled row did not read back as backfilled");
    // Every other bar in the window is NO DATA and therefore not backfilled.
    assert.ok(
      summary.bars.filter((b) => b.day !== day).every((b) => b.backfilled === false),
      "an unrecorded (NO DATA) day read as backfilled",
    );
  }

  // (e) the UI text is gated on `bar.backfilled`, the same literal-string
  // proof style test 7 uses for `bar.recovered`.
  {
    const src = readFileSync(new URL("../app/status/uptime.tsx", import.meta.url), "utf8");
    const BACKFILLED_TEXT = ", backfilled — entered after the fact";
    const occurrences = src.split(BACKFILLED_TEXT).length - 1;
    assert.ok(
      occurrences >= 2,
      `"${BACKFILLED_TEXT}" must appear at least twice (accessible name + tooltip) — found ${occurrences}`,
    );
    assert.ok(
      src.includes(`bar.backfilled ? "${BACKFILLED_TEXT}"`),
      "the backfilled text is not gated on bar.backfilled",
    );
  }
}

// --- 13. backfill still resolves through recordSample/deriveState --------
// The exact B2 scenario from test 3 (degraded, then a same-day ok sample
// resolves to degraded and reads recovered) replayed with BOTH samples
// marked `backfilled: true`, and `detail` run through `backfillDetail` the
// way `status.backfill` itself does — proving the backfill path is not a
// second, diverging way to set `state`, but the same aggregation code a live
// poller uses, just with samples dated, flagged and captioned differently.
{
  const { store, rows, since } = makeStore();
  const day = "2026-08-19";
  const at = (m: number) => Date.UTC(2026, 7, 19, 0, m);

  await recordSample(store, {
    day,
    serviceId: "published-cli",
    state: "degraded",
    detail: backfillDetail(
      "0.6.0 published vs 0.7.0 in this repo; 326 components in the published package vs 389 in this build",
    ),
    recordedAt: at(0),
    backfilled: true,
  });
  await recordSample(store, {
    day,
    serviceId: "published-cli",
    state: "ok",
    detail: backfillDetail(
      "npm dist-tags latest for @nikolas.sapa/ns-ui: 0.7.0, and data/registry-index.json indexes every component in this build",
    ),
    recordedAt: at(480),
    backfilled: true,
  });

  assert.equal(rows.length, 1);
  // Same `deriveState` result a live B2 sample pair produces: down/degraded
  // beats a later ok, the day is degraded, not ok.
  assert.equal(rows[0].state, "degraded", "backfill did not route through deriveState's worst-of-day rule");
  assert.equal(rows[0].lastState, "ok");
  assert.deepEqual([rows[0].sampleCount, rows[0].degradedCount, rows[0].downCount], [2, 1, 0]);
  assert.equal(rows[0].backfilled, true);
  // The measurement text survives verbatim...
  assert.equal(rows[0].detail?.includes("326 components"), true);
  // ...with the after-the-fact marker appended, not substituted for it.
  assert.equal(rows[0].detail?.endsWith("(entered after the fact; not measured live)"), true);

  const window = dayWindow(new Date(Date.UTC(2026, 7, 21)));
  const summary = summarizeService("published-cli", window, since(windowStartDay(Date.UTC(2026, 7, 21))));
  const bar = summary.bars.find((b) => b.day === day);
  assert.ok(bar);
  assert.equal(bar.state, "degraded");
  assert.equal(bar.recovered, true, "backfill did not produce the same recovered=true a live pair would");
  assert.equal(bar.backfilled, true);
}

// --- 14. backfillDetail: appends the marker, never invents one ------------
{
  assert.equal(backfillDetail(undefined), undefined, "an absent detail grew a marker from nothing");
  assert.equal(
    backfillDetail("326 components in the published package vs 389 in this build"),
    "326 components in the published package vs 389 in this build (entered after the fact; not measured live)",
  );
  // The measurement text is a prefix of the result — nothing is dropped or
  // reworded, only appended.
  const original = "0.6.0 published vs 0.7.0 in this repo; 326 components in the published package vs 389 in this build";
  const withMarker = backfillDetail(original);
  assert.ok(withMarker?.startsWith(original), "backfillDetail altered the original measurement text");
  assert.ok(withMarker !== original, "backfillDetail did not distinguish a backfilled detail at all");
}

console.log(
  "convex/status.logic.ts: one bar per day/service, samples aggregate, " +
    "unmeasured days absent, degraded never rounded up, past days stable, " +
    "gaps hold their slot, unknown states read NO DATA, backfill guards hold " +
    "and route through the same deriveState path — ok",
);
