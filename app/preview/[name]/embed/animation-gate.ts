/**
 * The card-thumbnail animation gate.
 *
 * Every catalog and saved-library card runs its demo in a real iframe (see
 * `live-preview-frame.tsx`'s docblock for why). The mount manager caps how
 * many iframes exist at once, but "mounted" is not "visible" — a preload
 * card can sit fully scrolled past while its iframe keeps running whatever
 * `requestAnimationFrame` loop the demo started (measured: with 10 cards
 * mounted mid-scroll, the 4 that were off-screen were spending *more* rAF
 * callback time per second than the 6 on-screen ones — canvas/WebGL demos
 * don't know or care that nobody can see them).
 *
 * This patches `requestAnimationFrame`/`cancelAnimationFrame` once, inside
 * the embed document only, before the demo (or the autoplay driver) ever
 * calls the real one — see `embed/page.tsx` for why it has to be a
 * server-rendered `<script>` rather than a client component's effect. While
 * paused, a loop's own `requestAnimationFrame(loop)` call is intercepted and
 * held rather than forwarded, so the loop goes fully idle (no polling, no
 * per-frame cost) until told to resume — at which point every held callback
 * is re-issued in one batch. Callbacks always receive a continuous clock:
 * the wall-clock time spent paused is subtracted from every timestamp, so a
 * demo computing `elapsed = ts - startRef.current` sees smooth time passing,
 * not a single frame where it jumped forward by however long it was
 * off-screen (which would read as a particle explosion or a phase jump on
 * resume for anything driven by elapsed/delta time).
 *
 * Two independent signals drive it, both a plain "paused unless both true":
 *  - `visible`, set by `live-preview-frame.tsx`'s postMessage — the true
 *    on-screen check the mount manager already computes for eviction
 *    ordering (`use-mount-manager.ts`'s `isOnScreen`), reused rather than
 *    re-derived with a second observer.
 *  - `document.visibilityState` — a same-origin iframe inherits the tab's
 *    visibility state from its top browsing context, so backgrounding the
 *    tab flips this for free with no parent involvement.
 *
 * Scoped to `/preview/<name>/embed` only (see that route's docblock): the
 * direct link (`/preview/<name>`) and the interactive playground variant
 * must keep running exactly as they do today — this file is never imported
 * there.
 */
export const ANIMATION_GATE_SCRIPT = `(function () {
  var w = window;
  if (w.__nsUiGateInstalled) return;
  w.__nsUiGateInstalled = true;

  var visible = true; // optimistic until the parent's first postMessage corrects it
  var pausedAt = 0;
  var pausedTotal = 0;
  var held = [];
  var nextId = 1;
  var tokens = new Map();
  var nativeRaf = w.requestAnimationFrame.bind(w);

  function effectiveVisible() {
    return visible && document.visibilityState !== "hidden";
  }

  function wrap(cb, token) {
    return function (ts) {
      if (token.cancelled) return;
      cb(ts - pausedTotal);
    };
  }

  w.requestAnimationFrame = function (cb) {
    var id = nextId++;
    var token = { cancelled: false };
    tokens.set(id, token);
    if (effectiveVisible()) {
      nativeRaf(wrap(cb, token));
    } else {
      held.push({ cb: cb, token: token });
    }
    return id;
  };

  w.cancelAnimationFrame = function (id) {
    var token = tokens.get(id);
    if (token) token.cancelled = true;
    tokens.delete(id);
  };

  function flush() {
    var queued = held;
    held = [];
    for (var i = 0; i < queued.length; i++) {
      if (!queued[i].token.cancelled) nativeRaf(wrap(queued[i].cb, queued[i].token));
    }
  }

  function sync() {
    if (effectiveVisible()) {
      if (pausedAt) {
        pausedTotal += performance.now() - pausedAt;
        pausedAt = 0;
      }
      flush();
    } else if (!pausedAt) {
      pausedAt = performance.now();
    }
  }

  document.addEventListener("visibilitychange", sync);
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.source !== "ns-ui-preview") return;
    visible = !!e.data.visible;
    sync();
  });
})();`;
