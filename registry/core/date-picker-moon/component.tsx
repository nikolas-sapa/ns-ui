"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// TerminatorDateField — masked MM/DD/YYYY date input whose popover calendar
// doubles as a moon-phase almanac. Every one of the 42 day cells carries a
// 14px canvas moon whose terminator curve comes from the real mean synodic
// month (29.530588853 d, reference new moon 2000-01-06 18:14 UTC); a 20px
// canvas in the input's trailing slot mirrors the focused date's phase live
// (150ms crossfade), and committing a date sweeps an eclipse shadow-disc
// across the chosen numeral (420ms ease-out-expo, cleared and redrawn every
// frame — zero accumulation). ONE canvas sits behind the whole grid; glyph
// positions derive from measured cell rects after layout settles. All ink is
// getComputedStyle-token-derived at mount and re-derived on documentElement
// class changes. rAF runs only during crossfade/transit; the static almanac
// costs zero frames.
// ---------------------------------------------------------------------------

const SYNODIC = 29.530588853; // mean synodic month, days
const EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14); // reference new moon, UTC
const DAY_MS = 86400000;
const ICON = 20; // trailing-slot canvas, px
const ICON_R = 8;
const MOON_R = 7; // 14px grid discs
const NUM_Y = 13; // numeral center within a 44px cell
const MOON_Y = 31; // moon center within a 44px cell
const CROSSFADE_MS = 150;
const TRANSIT_MS = 420;

const PHASE_NAMES = [
  "New moon",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full moon",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
] as const;
const WEEKDAYS = [
  ["Su", "Sunday"],
  ["Mo", "Monday"],
  ["Tu", "Tuesday"],
  ["We", "Wednesday"],
  ["Th", "Thursday"],
  ["Fr", "Friday"],
  ["Sa", "Saturday"],
] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type RGB = readonly [number, number, number];
interface Ink {
  fg: RGB;
  bd: RGB;
  bg: RGB;
}
interface CellGeom {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  numY: number;
  moonY: number;
  f: number; // phase fraction for this cell's date
  dim: boolean; // outside the viewed month
}
interface GridGeom {
  w: number;
  h: number;
  dpr: number;
  cells: (CellGeom | null)[];
}

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** phase fraction f in [0,1): 0 = new, 0.5 = full. Sampled at local noon. */
function phaseFraction(d: Date): number {
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const days = (noon.getTime() - EPOCH_MS) / DAY_MS;
  return (((days % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC;
}
const phaseIndex = (f: number) => Math.round(f * 8) % 8;
const illumination = (f: number) => (1 - Math.cos(2 * Math.PI * f)) / 2;

/**
 * Disc stroked --border; lit region --foreground at 85% alpha. Terminator is
 * a semi-ellipse with x-radius r*|cos(2πf)|; the lit limb sits right while
 * waxing (f < 0.5) and left while waning, ellipse sweep flips crescent/gibbous.
 */
function drawMoon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  f: number,
  ink: Ink,
  alpha: number
) {
  const phi = 2 * Math.PI * f;
  const c = Math.cos(phi);
  const k = (1 - c) / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(ink.bd, 0.9 * alpha);
  ctx.lineWidth = 1;
  ctx.stroke();
  if (k < 0.015) return; // new moon — outline only
  const ri = r - 0.5;
  ctx.beginPath();
  if (k > 0.985) {
    ctx.arc(cx, cy, ri, 0, Math.PI * 2);
  } else {
    const waxing = f < 0.5;
    const rx = Math.min(ri, Math.max(0.02, ri * Math.abs(c)));
    // lit limb: right semicircle for waxing, left for waning (top -> bottom)
    ctx.arc(cx, cy, ri, -Math.PI / 2, Math.PI / 2, !waxing);
    // terminator: bottom -> top, bulging toward or away from the lit limb
    ctx.ellipse(cx, cy, rx, ri, 0, Math.PI / 2, -Math.PI / 2, waxing ? c > 0 : c < 0);
  }
  ctx.fillStyle = rgba(ink.fg, 0.85 * alpha);
  ctx.fill();
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const pad2 = (n: number) => String(n).padStart(2, "0");
const pad4 = (n: number) => String(n).padStart(4, "0");
const fmt = (d: Date) =>
  `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${pad4(d.getFullYear())}`;
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function addMonths(d: Date, n: number) {
  const y = d.getFullYear();
  const m = d.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last));
}
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** 42-cell month sheet starting on the Sunday on/before the 1st. */
function cellDates(y: number, m: number): Date[] {
  const offset = new Date(y, m, 1).getDay();
  return Array.from({ length: 42 }, (_, i) => new Date(y, m, i + 1 - offset));
}

/** MM/DD/YYYY mask: digits only, slashes inserted as you type. */
function maskText(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += "/" + d.slice(2, 4);
  if (d.length > 4) out += "/" + d.slice(4, 8);
  return out;
}
function parseMasked(text: string): Date | null {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const mo = Number(m[1]);
  const da = Number(m[2]);
  const yr = Number(m[3]);
  if (yr < 1000 || yr > 9999) return null; // reject non-4-digit-real years
  const d = new Date(yr, mo - 1, da);
  return d.getFullYear() === yr && d.getMonth() === mo - 1 && d.getDate() === da
    ? d
    : null;
}

export function TerminatorDateField({
  value,
  defaultValue = null,
  onValueChange,
  label = "Date",
  disabled = false,
  className = "",
}: {
  /** controlled selected date; omit for uncontrolled */
  value?: Date | null;
  /** uncontrolled initial selected date */
  defaultValue?: Date | null;
  /** called with the new date when a day is picked */
  onValueChange?: (date: Date) => void;
  /** field label rendered above the trigger */
  label?: string;
  /** blocks the trigger and closes the calendar if open */
  disabled?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
}) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const helperId = `${uid}-helper`;
  const popId = `${uid}-pop`;

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<Date | null>(defaultValue);
  const selected = isControlled ? (value ?? null) : internal;

  const [text, setText] = useState(() => (selected ? fmt(selected) : ""));
  const [open, setOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState<Date>(
    () => selected ?? new Date()
  );
  const [view, setView] = useState(() => {
    const b = selected ?? new Date();
    return { y: b.getFullYear(), m: b.getMonth() };
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const iconCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const geomRef = useRef<GridGeom | null>(null);
  const justOpenedRef = useRef(false);
  const closeTimerRef = useRef(0);
  const pendingCaretRef = useRef<number | null>(null);
  const animRef = useRef<{
    iconF: number | null;
    iconAnim: { from: number; to: number; start: number } | null;
    transit: { idx: number; start: number } | null;
  }>({ iconF: null, iconAnim: null, transit: null });
  const engineRef = useRef<{
    setIcon: (f: number) => void;
    startTransit: (idx: number) => boolean;
    redrawGrid: () => void;
  } | null>(null);

  const cells = useMemo(() => cellDates(view.y, view.m), [view.y, view.m]);
  const today = useMemo(() => new Date(), []);
  const invalid = text.length === 10 && parseMasked(text) === null;
  const previewDate = open
    ? focusedDate
    : (parseMasked(text) ?? selected ?? today);
  const previewF = phaseFraction(previewDate);
  const previewName = PHASE_NAMES[phaseIndex(previewF)];

  // -- engine: token ink, icon crossfade, grid redraw, eclipse transit -------
  useEffect(() => {
    const icon = iconCanvasRef.current;
    const root = rootRef.current;
    if (!icon || !root) return;
    const ictx = icon.getContext("2d");
    if (!ictx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // <canvas> is a replaced element — size it explicitly, never via inset
    icon.style.width = `${ICON}px`;
    icon.style.height = `${ICON}px`;
    icon.width = ICON * dpr;
    icon.height = ICON * dpr;

    const ink: Ink = {
      fg: [237, 237, 237],
      bd: [46, 46, 46],
      bg: [10, 10, 10],
    };
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      ink.fg = parseColor(cs.getPropertyValue("--foreground")) ?? ink.fg;
      ink.bd = parseColor(cs.getPropertyValue("--border")) ?? ink.bd;
      ink.bg = parseColor(cs.getPropertyValue("--background")) ?? ink.bg;
    };
    derive();

    let raf = 0;
    let visible = true;

    const drawIcon = (from: number | null, to: number, t: number) => {
      ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ictx.clearRect(0, 0, ICON, ICON);
      if (from !== null && t < 1)
        drawMoon(ictx, ICON / 2, ICON / 2, ICON_R, from, ink, 1 - t);
      drawMoon(
        ictx,
        ICON / 2,
        ICON / 2,
        ICON_R,
        to,
        ink,
        from !== null ? Math.min(1, t) : 1
      );
    };

    const drawGridStatic = () => {
      const canvas = gridCanvasRef.current;
      const g = geomRef.current;
      if (!canvas || !g) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      for (const c of g.cells) {
        if (!c) continue;
        drawMoon(ctx, c.cx, c.moonY, MOON_R, c.f, ink, c.dim ? 0.45 : 1);
      }
    };

    // full clear + full redraw every transit frame — no accumulation
    const drawGridFrame = (p: number, idx: number) => {
      const canvas = gridCanvasRef.current;
      const g = geomRef.current;
      if (!canvas || !g) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawGridStatic();
      const cell = g.cells[idx];
      if (!cell) return;
      const e = easeOutExpo(p);
      const env = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
      const R = 10;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cell.x, cell.y, cell.w, cell.h);
      ctx.clip();
      ctx.globalAlpha = env;
      // lit corona behind the numeral...
      ctx.beginPath();
      ctx.arc(cell.cx, cell.numY, R, 0, Math.PI * 2);
      ctx.fillStyle = rgba(ink.fg, 0.22);
      ctx.fill();
      // ...eclipsed by a background-ink shadow disc sweeping across it
      const sx = cell.cx - R * 2.6 + e * R * 5.2;
      ctx.beginPath();
      ctx.arc(sx, cell.numY, R + 1, 0, Math.PI * 2);
      ctx.fillStyle = rgba(ink.bg, 1);
      ctx.fill();
      ctx.strokeStyle = rgba(ink.bd, 1);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };

    const tick = (now: number) => {
      raf = 0;
      if (document.hidden || !visible) return; // parked; wake resumes
      const A = animRef.current;
      let active = false;
      if (A.iconAnim) {
        const t = Math.min(1, (now - A.iconAnim.start) / CROSSFADE_MS);
        drawIcon(A.iconAnim.from, A.iconAnim.to, t);
        if (t >= 1) A.iconAnim = null;
        else active = true;
      }
      if (A.transit) {
        const p = Math.min(1, (now - A.transit.start) / TRANSIT_MS);
        drawGridFrame(p, A.transit.idx);
        if (p >= 1) {
          A.transit = null;
          drawGridStatic();
        } else active = true;
      }
      if (active) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf && !document.hidden && visible) raf = requestAnimationFrame(tick);
    };

    const setIcon = (f: number) => {
      const A = animRef.current;
      if (A.iconF === null || reduced || Math.abs(f - A.iconF) < 1e-4) {
        A.iconF = f;
        A.iconAnim = null;
        drawIcon(null, f, 1);
        return;
      }
      A.iconAnim = { from: A.iconF, to: f, start: performance.now() };
      A.iconF = f;
      wake();
    };

    const startTransit = (idx: number) => {
      const g = geomRef.current;
      if (reduced || !g || !g.cells[idx] || !gridCanvasRef.current)
        return false;
      animRef.current.transit = { idx, start: performance.now() };
      wake();
      return true;
    };

    engineRef.current = { setIcon, startTransit, redrawGrid: drawGridStatic };

    // live theme re-derive: watch documentElement class flips
    const mo = new MutationObserver(() => {
      derive();
      const A = animRef.current;
      if (A.iconF !== null) drawIcon(null, A.iconF, 1);
      drawGridStatic();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      animRef.current.iconAnim = null;
      animRef.current.transit = null;
      engineRef.current = null;
    };
  }, []);

  // trailing icon tracks the focused/typed date's phase
  useEffect(() => {
    engineRef.current?.setIcon(previewF);
  }, [previewF]);

  // -- grid canvas: measure real cell rects after layout settles, draw once --
  useEffect(() => {
    if (!open) {
      geomRef.current = null;
      return;
    }
    const wrap = gridWrapRef.current;
    const canvas = gridCanvasRef.current;
    if (!wrap || !canvas) return;
    let raf1 = 0;
    let raf2 = 0;
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) {
        geomRef.current = null; // zero-size guard
        return;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${rect.width}px`; // explicit — replaced element
      canvas.style.height = `${rect.height}px`;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const gcells: (CellGeom | null)[] = new Array(42).fill(null);
      cells.forEach((date, i) => {
        const el = cellRefs.current[i];
        if (!el) return;
        const b = el.getBoundingClientRect();
        const x = b.left - rect.left;
        const y = b.top - rect.top;
        gcells[i] = {
          x,
          y,
          w: b.width,
          h: b.height,
          cx: x + b.width / 2,
          numY: y + NUM_Y,
          moonY: y + MOON_Y,
          f: phaseFraction(date),
          dim: date.getMonth() !== view.m,
        };
      });
      geomRef.current = { w: rect.width, h: rect.height, dpr, cells: gcells };
      engineRef.current?.redrawGrid();
    };
    // double rAF: let popover layout settle before reading cell offsets
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf2);
      raf2 = requestAnimationFrame(measure);
    });
    ro.observe(wrap);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      geomRef.current = null;
      animRef.current.transit = null;
    };
  }, [open, cells, view.m]);

  // roving focus follows the focused cell while the grid owns focus
  useEffect(() => {
    if (!open) return;
    const idx = cells.findIndex((c) => sameDay(c, focusedDate));
    if (idx < 0) return;
    const el = cellRefs.current[idx];
    if (!el) return;
    const ae = document.activeElement;
    const inGrid =
      ae instanceof HTMLElement && ae.getAttribute("role") === "gridcell";
    if (justOpenedRef.current || (popRef.current?.contains(ae) && inGrid)) {
      el.focus();
      justOpenedRef.current = false;
    }
  }, [open, focusedDate, cells]);

  // outside click closes without stealing focus
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // sync typed text when a controlled value changes from outside
  const controlledTime = isControlled ? (value ? value.getTime() : -1) : null;
  useEffect(() => {
    if (controlledTime === null) return;
    setText(value ? fmt(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledTime]);

  useEffect(() => {
    return () => window.clearTimeout(closeTimerRef.current);
  }, []);

  // restore caret after the mask reformats `text` — React resets the DOM
  // value on every render, which otherwise collapses the caret to the end
  useLayoutEffect(() => {
    const pos = pendingCaretRef.current;
    if (pos === null) return;
    pendingCaretRef.current = null;
    inputRef.current?.setSelectionRange(pos, pos);
  }, [text]);

  const close = (focusBack: boolean) => {
    window.clearTimeout(closeTimerRef.current);
    animRef.current.transit = null;
    setOpen(false);
    if (focusBack) inputRef.current?.focus();
  };

  const openPopover = () => {
    if (disabled) return;
    const base = parseMasked(text) ?? selected ?? new Date();
    setFocusedDate(base);
    setView({ y: base.getFullYear(), m: base.getMonth() });
    justOpenedRef.current = true;
    setOpen(true);
  };

  const moveFocus = (d: Date) => {
    setFocusedDate(d);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const commit = (date: Date, idx: number | null) => {
    if (!isControlled) setInternal(date);
    onValueChange?.(date);
    setText(fmt(date));
    setFocusedDate(date);
    if (open) {
      if (idx !== null && engineRef.current?.startTransit(idx)) {
        closeTimerRef.current = window.setTimeout(
          () => close(true),
          TRANSIT_MS + 60
        );
      } else close(true);
    }
  };

  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    let d: Date | null = null;
    switch (e.key) {
      case "ArrowLeft":
        d = addDays(focusedDate, -1);
        break;
      case "ArrowRight":
        d = addDays(focusedDate, 1);
        break;
      case "ArrowUp":
        d = addDays(focusedDate, -7);
        break;
      case "ArrowDown":
        d = addDays(focusedDate, 7);
        break;
      case "Home":
        d = addDays(focusedDate, -focusedDate.getDay());
        break;
      case "End":
        d = addDays(focusedDate, 6 - focusedDate.getDay());
        break;
      case "PageUp":
        d = addMonths(focusedDate, e.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        d = addMonths(focusedDate, e.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    e.preventDefault();
    if (d) moveFocus(d);
  };

  const focusedIdx = cells.findIndex((c) => sameDay(c, focusedDate));
  const tabbableIdx =
    focusedIdx >= 0 ? focusedIdx : new Date(view.y, view.m, 1).getDay();
  const monthLabel = `${MONTHS[view.m]} ${view.y}`;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-[13px] font-medium text-foreground"
      >
        {label}
      </label>

      <div
        className={`flex items-center gap-1.5 rounded-sm border bg-background pl-3 pr-1.5 transition-colors ${
          invalid ? "border-foreground/40" : "border-border"
        } ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "focus-within:border-ns-accent focus-within:ring-2 focus-within:ring-ns-accent/25 hover:border-foreground/25"
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM/DD/YYYY"
          disabled={disabled}
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={helperId}
          onChange={(e) => {
            const raw = e.target.value;
            const caret = e.target.selectionStart ?? raw.length;
            // caret position expressed as "how many digits precede it" is
            // stable across reformatting; slash count shifts around it
            const digitsBeforeCaret = raw
              .slice(0, caret)
              .replace(/\D/g, "").length;
            const next = maskText(raw);
            let pos = next.length;
            if (digitsBeforeCaret <= 0) {
              pos = 0;
            } else {
              let seen = 0;
              for (let i = 0; i < next.length; i++) {
                if (/\d/.test(next[i])) {
                  seen++;
                  if (seen === digitsBeforeCaret) {
                    pos = i + 1;
                    break;
                  }
                }
              }
            }
            pendingCaretRef.current = pos;
            setText(next);
            const d = parseMasked(next);
            if (d) {
              if (!isControlled) setInternal(d);
              onValueChange?.(d);
              setFocusedDate(d);
              setView({ y: d.getFullYear(), m: d.getMonth() });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              openPopover();
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              close(true);
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              close(false);
            }
          }}
          onBlur={(e) => {
            if (rootRef.current?.contains(e.relatedTarget as Node)) return;
            if (text !== "" && parseMasked(text) === null)
              setText(selected ? fmt(selected) : "");
          }}
          className="h-9 w-full bg-transparent font-mono text-sm text-foreground placeholder:text-ns-muted/60 focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={`${open ? "Close" : "Open"} calendar. ${previewName}.`}
          aria-expanded={open}
          aria-haspopup="grid"
          aria-controls={open ? popId : undefined}
          onClick={() => (open ? close(false) : openPopover())}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ns-muted transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:cursor-not-allowed"
        >
          <canvas
            ref={iconCanvasRef}
            width={ICON}
            height={ICON}
            aria-hidden
            className="pointer-events-none"
          />
        </button>
      </div>

      <p id={helperId} className="mt-1.5 font-mono text-xs text-ns-muted">
        {invalid
          ? "Not a valid date"
          : `${previewName} · ${Math.round(illumination(previewF) * 100)}% illuminated`}
      </p>

      {open && (
        <div
          ref={popRef}
          id={popId}
          role="dialog"
          aria-label="Choose date"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close(true);
            }
          }}
          className="absolute left-0 top-full z-30 mt-2 w-[292px] rounded-md border border-border bg-surface p-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveFocus(addMonths(focusedDate, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-sm text-ns-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <p
              aria-live="polite"
              className="text-[13px] font-semibold text-foreground"
            >
              {monthLabel}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveFocus(addMonths(focusedDate, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-sm text-ns-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          <div ref={gridWrapRef} className="relative">
            {/* one canvas behind the whole grid — all 42 moons + transit */}
            <canvas
              ref={gridCanvasRef}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0"
            />
            <div
              role="grid"
              aria-label={monthLabel}
              onKeyDown={onGridKeyDown}
              className="relative z-[1]"
            >
              <div role="row" className="grid grid-cols-7">
                {WEEKDAYS.map(([abbr, full]) => (
                  <div
                    key={abbr}
                    role="columnheader"
                    aria-label={full}
                    className="pb-1 text-center font-mono text-[10px] uppercase tracking-wider text-ns-muted"
                  >
                    {abbr}
                  </div>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, r) => (
                <div key={r} role="row" className="grid grid-cols-7">
                  {cells.slice(r * 7, r * 7 + 7).map((date, c) => {
                    const i = r * 7 + c;
                    const inMonth = date.getMonth() === view.m;
                    const isSel = selected !== null && sameDay(date, selected);
                    const isToday = sameDay(date, today);
                    const f = phaseFraction(date);
                    return (
                      <button
                        key={i}
                        ref={(el) => {
                          cellRefs.current[i] = el;
                        }}
                        type="button"
                        role="gridcell"
                        tabIndex={i === tabbableIdx ? 0 : -1}
                        aria-selected={isSel}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}. ${PHASE_NAMES[phaseIndex(f)]}.`}
                        onClick={() => commit(date, i)}
                        onFocus={() => setFocusedDate(date)}
                        className={`relative flex h-11 flex-col items-center rounded-sm pt-[7px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ns-accent ${
                          isSel
                            ? "bg-ns-accent/10 text-ns-accent"
                            : inMonth
                              ? "text-foreground hover:bg-foreground/[0.06]"
                              : "text-ns-muted/70 hover:bg-foreground/[0.04]"
                        }`}
                      >
                        <span
                          className={`text-[13px] leading-none ${
                            isToday && !isSel
                              ? "underline decoration-ns-muted underline-offset-[3px]"
                              : ""
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
