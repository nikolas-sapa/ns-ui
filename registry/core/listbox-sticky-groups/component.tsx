"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ShingleCourse — a grouped listbox for long lists (timezones, countries,
// currencies) where every passed group header keeps its own place. Each
// group's heading is a real <button>, position:sticky with an inline
// `top: index * 20px` and an explicit `z-index: index + 1`. The group <li>
// wrapping a header + its options is `display:contents` — NOT a normal box —
// because a sticky element's containing block is its nearest box-generating
// ancestor: if the group's own <li> were that ancestor, its header would
// release the moment that group's own rows scrolled out, and the trail could
// never accumulate past the current group (plain one-at-a-time sticky
// headers, the exact thing this beats). With the box suppressed, every
// header's containing block is the single shared <ul role="listbox">, so
// passed headers stay pinned — and since every header shares one fixed
// height and each successive one pins 20px lower, a later header naturally
// paints over the bottom of the one before it — leaving a 20px sliver of
// every passed header visible at once, stacked like a fanned deck of index
// cards, for the entire life of the scroll. That stack IS the table of
// contents: no separate minimap, no "you are here" widget, just the group
// labels the list already had, repurposed as they're consumed. An
// IntersectionObserver per group (a 1px sentinel at the START of the NEXT
// group, offset by that group's own sticky top) flips a `shingled` class on
// the group it just covered — pure detection, it never drives layout, so
// there is no reflow and nothing to fight the browser's own sticky
// implementation. Clicking a shingle eases the list's scrollTop (ease-out-
// expo, ~420ms, WAAPI-free rAF loop), computed from that group's SENTINEL
// (never the header itself — a currently-stuck header's own rect reflects
// its pinned screen position, not its natural document position, which would
// cancel the target math to a no-op) so that group's header lands at ITS OWN
// offset — i.e. becomes the current, uncovered header — with everything
// before it still fanned out above. Keyboard is a standard single-tab-stop
// listbox: ArrowUp/Down step
// the active option, Home/End/PageUp/PageDown jump within the flat option
// list exactly as a native <select> would, typeahead matches by label
// prefix. The shingle buttons are their own, separate tab stops (real
// buttons, aria-label "Jump to <group>"); the visible group name lives in
// its own child span so a group's aria-labelledby still announces the
// plain name, not the button's jump-to phrasing. prefers-reduced-motion
// keeps every sticky offset and the compress styling — the stacking is not
// an animation, it's layout — and only skips the eased scroll (jumps the
// scrollTop directly) and the color/type transition on the header itself.
// ---------------------------------------------------------------------------

const HEADER_STEP = 20; // px — sticky top offset per group index
const SCROLL_MS = 420;
const TYPEAHEAD_MS = 500;
const PAGE_SIZE = 8;

export interface ShingleCourseOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ShingleCourseGroup {
  id: string;
  label: string;
  options: ShingleCourseOption[];
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// deliberately not exhaustive — enough per region that scrolling actually
// shingles several headers, consumers pass their own `groups` for the real
// 300-row timezone/country/currency list this is built for
const REGION_DATA: { id: string; label: string; cities: string[] }[] = [
  {
    id: "africa",
    label: "Africa",
    cities: [
      "Abidjan", "Accra", "Addis Ababa", "Algiers", "Cairo", "Casablanca",
      "Dakar", "Dar es Salaam", "Johannesburg", "Kampala", "Khartoum",
      "Lagos", "Nairobi", "Tunis",
    ],
  },
  {
    id: "americas",
    label: "Americas",
    cities: [
      "Anchorage", "Bogota", "Buenos Aires", "Chicago", "Denver", "Halifax",
      "Havana", "Lima", "Los Angeles", "Mexico City", "Montevideo",
      "New York", "Panama", "Phoenix", "Santiago", "Sao Paulo",
      "St Johns", "Toronto", "Vancouver", "Winnipeg",
    ],
  },
  {
    id: "asia",
    label: "Asia",
    cities: [
      "Almaty", "Bangkok", "Baku", "Dhaka", "Dubai", "Hong Kong",
      "Istanbul", "Jakarta", "Jerusalem", "Karachi", "Kathmandu",
      "Kolkata", "Kuala Lumpur", "Manila", "Riyadh", "Seoul", "Shanghai",
      "Singapore", "Taipei", "Tehran", "Tokyo", "Yangon",
    ],
  },
  {
    id: "atlantic",
    label: "Atlantic",
    cities: ["Azores", "Bermuda", "Canary", "Cape Verde", "Reykjavik", "South Georgia"],
  },
  {
    id: "pacific",
    label: "Australia & Pacific",
    cities: [
      "Adelaide", "Auckland", "Brisbane", "Darwin", "Fiji", "Guam",
      "Honolulu", "Melbourne", "Noumea", "Perth", "Port Moresby", "Suva",
      "Sydney", "Tongatapu",
    ],
  },
  {
    id: "europe",
    label: "Europe",
    cities: [
      "Amsterdam", "Athens", "Belgrade", "Berlin", "Brussels", "Bucharest",
      "Budapest", "Copenhagen", "Dublin", "Helsinki", "Kyiv", "Lisbon",
      "London", "Madrid", "Moscow", "Oslo", "Paris", "Prague", "Rome",
      "Sofia", "Stockholm", "Vienna", "Vilnius", "Warsaw", "Zurich", "Zagreb",
    ],
  },
  {
    id: "indian",
    label: "Indian Ocean",
    cities: ["Chagos", "Christmas", "Cocos", "Mahe", "Maldives"],
  },
  {
    id: "antarctica",
    label: "Antarctica",
    cities: ["Casey", "Davis", "Mawson", "McMurdo", "Troll"],
  },
];

const DEFAULT_GROUPS: ShingleCourseGroup[] = REGION_DATA.map((r) => ({
  id: r.id,
  label: r.label,
  options: r.cities.map((city) => ({
    value: `${r.id}-${slugify(city)}`,
    label: city,
  })),
}));

interface FlatOption {
  gi: number;
  oi: number;
  opt: ShingleCourseOption;
}

export function ShingleCourse({
  groups = DEFAULT_GROUPS,
  value,
  defaultValue = "",
  onValueChange,
  label = "Timezone",
  disabled = false,
  name,
  className = "",
}: {
  groups?: ShingleCourseGroup[];
  /** controlled value; omit for uncontrolled */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** field label rendered above the listbox */
  label?: string;
  disabled?: boolean;
  /** when set, renders a hidden input for form posts */
  name?: string;
  className?: string;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const listboxId = `${uid}-listbox`;
  const headerId = (gi: number) => `${uid}-hdr-${gi}`;
  const optId = (gi: number, oi: number) => `${uid}-opt-${gi}-${oi}`;

  const listRef = useRef<HTMLUListElement>(null);
  const sentinelRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollCancelRef = useRef<() => void>(() => {});
  const typeRef = useRef<{ buf: string; timer: number }>({ buf: "", timer: 0 });

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const val = isControlled ? value : internal;

  const flat = useMemo<FlatOption[]>(() => {
    const arr: FlatOption[] = [];
    groups.forEach((g, gi) => {
      g.options.forEach((opt, oi) => arr.push({ gi, oi, opt }));
    });
    return arr;
  }, [groups]);

  const groupStart = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const g of groups) {
      starts.push(acc);
      acc += g.options.length;
    }
    return starts;
  }, [groups]);

  const firstEnabledFlat = () => flat.findIndex((f) => !f.opt.disabled);
  const lastEnabledFlat = () => {
    for (let i = flat.length - 1; i >= 0; i--) {
      if (!flat[i]?.opt.disabled) return i;
    }
    return -1;
  };

  const [activeFlat, setActiveFlat] = useState(() => {
    const sel = flat.findIndex((f) => f.opt.value === val && !f.opt.disabled);
    return sel >= 0 ? sel : firstEnabledFlat();
  });

  // which group indices are currently covered by the one after them —
  // detected via IntersectionObserver, never derived from scrollTop math
  const [arrived, setArrived] = useState<Set<number>>(() => new Set());
  const isShingled = (gi: number) => arrived.has(gi + 1);

  // -- shingle detection: one sentinel + observer per group -----------------
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const observers: IntersectionObserver[] = [];
    groups.forEach((_, gi) => {
      const sentinel = sentinelRefs.current.get(gi);
      if (!sentinel) return;
      const top = gi * HEADER_STEP;
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry || !entry.rootBounds) return;
          const passed =
            !entry.isIntersecting &&
            entry.boundingClientRect.top < entry.rootBounds.top;
          setArrived((prev) => {
            const has = prev.has(gi);
            if (passed === has) return prev;
            const next = new Set(prev);
            if (passed) next.add(gi);
            else next.delete(gi);
            return next;
          });
        },
        { root, rootMargin: `-${top + 1}px 0px 0px 0px`, threshold: 0 }
      );
      io.observe(sentinel);
      observers.push(io);
    });
    return () => observers.forEach((io) => io.disconnect());
  }, [groups]);

  useEffect(() => {
    if (activeFlat < 0) return;
    const f = flat[activeFlat];
    if (!f) return;
    const el = document.getElementById(optId(f.gi, f.oi));
    el?.scrollIntoView({ block: "nearest" });
  }, [activeFlat]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = typeRef.current;
    return () => window.clearTimeout(t.timer);
  }, []);

  useEffect(() => {
    return () => scrollCancelRef.current();
  }, []);

  // -- scroll-to-top on shingle click: ease-out-expo, skipped under
  // prefers-reduced-motion (jumps straight to target) ------------------------
  const scrollGroupToTop = (gi: number) => {
    const listEl = listRef.current;
    // anchor on the SENTINEL, not the header: once a header is stuck, its
    // own getBoundingClientRect reflects the current stuck screen position
    // rather than its natural document-flow position, so measuring from the
    // header itself makes this cancel out to a no-op for exactly the
    // headers a user is most likely to click (ones already pinned in the
    // shingle trail). The sentinel is a plain, never-sticky 1px marker at
    // the exact start of the group, so its rect is trustworthy regardless
    // of any header's stuck state.
    const sentinel = sentinelRefs.current.get(gi);
    if (!listEl || !sentinel) return;
    const listRect = listEl.getBoundingClientRect();
    const sentinelRect = sentinel.getBoundingClientRect();
    const naturalTop = sentinelRect.top - listRect.top + listEl.scrollTop;
    const target = Math.max(0, naturalTop - gi * HEADER_STEP);

    scrollCancelRef.current();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const start = listEl.scrollTop;
    const delta = target - start;
    if (reduced || Math.abs(delta) < 1) {
      listEl.scrollTop = target;
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / SCROLL_MS);
      listEl.scrollTop = start + delta * easeOutExpo(t);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    scrollCancelRef.current = () => cancelAnimationFrame(raf);
  };

  // -- selection --------------------------------------------------------------
  const commit = (fi: number) => {
    const f = flat[fi];
    if (!f || f.opt.disabled) return;
    if (!isControlled) setInternal(f.opt.value);
    onValueChange?.(f.opt.value);
  };

  const typeahead = (ch: string) => {
    const t = typeRef.current;
    t.buf += ch.toLowerCase();
    window.clearTimeout(t.timer);
    t.timer = window.setTimeout(() => {
      t.buf = "";
    }, TYPEAHEAD_MS);
    const n = flat.length;
    if (n === 0) return;
    const start = activeFlat >= 0 ? activeFlat : 0;
    const offset = t.buf.length > 1 ? 0 : 1;
    for (let k = 0; k < n; k++) {
      const i = (start + offset + k) % n;
      const f = flat[i];
      if (f && !f.opt.disabled && f.opt.label.toLowerCase().startsWith(t.buf)) {
        setActiveFlat(i);
        return;
      }
    }
  };

  const step = (from: number, dir: 1 | -1, count = 1) => {
    let i = from;
    let moves = 0;
    let candidate = from;
    while (moves < count) {
      let next = i;
      let found = false;
      for (let k = 0; k < flat.length; k++) {
        next += dir;
        if (next < 0 || next >= flat.length) break;
        if (!flat[next]?.opt.disabled) {
          found = true;
          break;
        }
      }
      if (!found) break;
      i = next;
      candidate = i;
      moves++;
    }
    return candidate;
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const key = e.key;
    if (key === "ArrowDown") {
      e.preventDefault();
      setActiveFlat((a) => step(a, 1));
    } else if (key === "ArrowUp") {
      e.preventDefault();
      setActiveFlat((a) => step(a, -1));
    } else if (key === "PageDown") {
      e.preventDefault();
      setActiveFlat((a) => step(a, 1, PAGE_SIZE));
    } else if (key === "PageUp") {
      e.preventDefault();
      setActiveFlat((a) => step(a, -1, PAGE_SIZE));
    } else if (key === "Home") {
      e.preventDefault();
      const i = firstEnabledFlat();
      if (i >= 0) setActiveFlat(i);
    } else if (key === "End") {
      e.preventDefault();
      const i = lastEnabledFlat();
      if (i >= 0) setActiveFlat(i);
    } else if (key === "Enter" || (key === " " && typeRef.current.buf === "")) {
      e.preventDefault();
      commit(activeFlat);
    } else if (key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      typeahead(key);
    }
  };

  return (
    <div className={className}>
      <span
        id={labelId}
        className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-muted"
      >
        {label}
      </span>
      {name ? <input type="hidden" name={name} value={val} /> : null}

      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-disabled={disabled || undefined}
        aria-activedescendant={
          !disabled && activeFlat >= 0
            ? (() => {
                const f = flat[activeFlat];
                return f ? optId(f.gi, f.oi) : undefined;
              })()
            : undefined
        }
        onKeyDown={onListKeyDown}
        className={`relative max-h-[420px] overflow-y-auto overscroll-contain rounded-md border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {groups.map((g, gi) => {
          const shingled = isShingled(gi);
          return (
            // display:contents — the group <li> must NOT generate its own box.
            // A sticky element's containing block is its nearest box-generating
            // ancestor; if that were this per-group <li>, header gi would be
            // released the moment group gi's own rows scroll out, and the
            // shingle trail could never accumulate past the current group. With
            // the box suppressed, every header's containing block is the shared
            // <ul role="listbox"> itself, so passed headers stay pinned (and
            // stacked, painted in DOM order) for the life of the whole scroll.
            <li
              key={g.id}
              role="group"
              aria-labelledby={headerId(gi)}
              className="contents"
            >
              <div
                ref={(el) => {
                  if (el) sentinelRefs.current.set(gi, el);
                  else sentinelRefs.current.delete(gi);
                }}
                aria-hidden
                style={{ height: 1 }}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => scrollGroupToTop(gi)}
                aria-label={`Jump to ${g.label}`}
                style={{ top: gi * HEADER_STEP, zIndex: gi + 1 }}
                className={`sticky flex h-9 w-full items-center justify-between gap-3 border-border bg-background px-3 text-left outline-none transition-[color,background-color,font-size,letter-spacing,padding] duration-200 enabled:hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-not-allowed motion-reduce:transition-none ${
                  shingled
                    ? "border-b text-[11px] font-medium uppercase tracking-[0.08em] text-muted"
                    : "text-xs font-semibold text-foreground"
                }`}
              >
                <span id={headerId(gi)} className="truncate">
                  {g.label}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 font-mono text-[10px] text-muted"
                >
                  {g.options.length}
                </span>
              </button>

              <ul role="presentation" className="py-1">
                {g.options.map((opt, oi) => {
                  const fi = groupStart[gi]! + oi;
                  const isActive = fi === activeFlat;
                  const isSelected = opt.value === val;
                  return (
                    <li
                      key={opt.value}
                      id={optId(gi, oi)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled || undefined}
                      onPointerMove={() => {
                        if (!opt.disabled && !disabled && fi !== activeFlat) {
                          setActiveFlat(fi);
                        }
                      }}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!disabled && !opt.disabled) commit(fi);
                      }}
                      className={`flex items-center justify-between gap-3 px-3 py-1.5 text-sm transition-colors duration-100 motion-reduce:transition-none ${
                        opt.disabled
                          ? "cursor-not-allowed text-muted/60"
                          : isActive
                            ? "cursor-pointer bg-foreground/[0.07] text-foreground"
                            : "cursor-pointer text-foreground/85"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected ? (
                        <svg
                          aria-hidden
                          viewBox="0 0 16 16"
                          fill="none"
                          className="h-4 w-4 shrink-0 text-accent"
                        >
                          <path
                            d="M3.5 8.5l3 3 6-6.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
