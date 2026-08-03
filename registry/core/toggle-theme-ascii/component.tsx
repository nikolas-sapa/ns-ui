"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ThemeToggleAscii — a real theme toggle whose swatch previews the theme
// it is *about* to switch to, honestly: at mount and on every theme change
// it reads the actual resolved --background/--foreground values via
// getComputedStyle and paints its own chip in their NEGATIVE — chip
// background = the current foreground token, chip ink = the current
// background token — so the swatch always shows, in real token colors, very
// nearly what the page will look like the instant you click it. That is a
// mechanic only a theme control can have: it would mean nothing on a switch
// that doesn't change the palette it's drawn in. A small ascii sun/moon
// glyph rides inside the chip and cross-fades between the two forms.
// ---------------------------------------------------------------------------

const SUN = [" \\|/ ", "-(O)-", " /|\\ "];
const MOON = ["  .-)", " (   ", "  `-)"];

function readToken(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || (name === "--background" ? "#ffffff" : "#000000");
}

export interface ThemeToggleAsciiProps {
  /** controlled dark state; omit for uncontrolled (reads/writes <html class="dark">) */
  dark?: boolean;
  defaultDark?: boolean;
  onDarkChange?: (dark: boolean) => void;
  /** whether clicking mutates document.documentElement's "dark" class + localStorage */
  syncDocument?: boolean;
  /** localStorage key used when syncDocument is true */
  storageKey?: string;
  className?: string;
}

export function ThemeToggleAscii({
  dark,
  defaultDark = false,
  onDarkChange,
  syncDocument = true,
  storageKey = "ns-ui-theme",
  className = "",
}: ThemeToggleAsciiProps) {
  const isControlled = dark !== undefined;
  const [internalDark, setInternalDark] = useState(defaultDark);
  const [mounted, setMounted] = useState(false);
  const isDark = isControlled ? (dark as boolean) : internalDark;

  const chipRef = useRef<HTMLSpanElement>(null);

  // paint the negative-preview chip from real resolved token values, at
  // mount and every time <html>'s class list changes (our own click, or any
  // other control on the page toggling the same theme).
  useEffect(() => {
    const paint = () => {
      const chip = chipRef.current;
      if (!chip) return;
      const bg = readToken("--background");
      const fg = readToken("--foreground");
      // negative: chip paper = foreground token, chip ink = background token
      chip.style.backgroundColor = fg;
      chip.style.color = bg;
    };
    paint();
    setMounted(true);
    const mo = new MutationObserver(paint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  // sync from the initial real document state on mount (uncontrolled only)
  useEffect(() => {
    if (isControlled) return;
    setInternalDark(document.documentElement.classList.contains("dark"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !isDark;
    if (!isControlled) setInternalDark(next);
    onDarkChange?.(next);
    if (syncDocument) {
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem(storageKey, next ? "dark" : "light");
      } catch {
        // storage unavailable (private mode) — the toggle still works for this tab
      }
    }
  };

  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={mounted ? isDark : undefined}
      aria-label={mounted ? (isDark ? "Switch to light theme" : "Switch to dark theme") : "Toggle theme"}
      suppressHydrationWarning
      className={`group inline-flex items-center gap-2 rounded-sm border border-border px-2 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <span
        ref={chipRef}
        aria-hidden
        className="relative grid size-8 place-items-center overflow-hidden rounded-sm border border-border transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"
      >
        <pre
          className={`pointer-events-none absolute inset-0 grid place-items-center whitespace-pre text-[9px] leading-tight transition-opacity duration-200 motion-reduce:transition-none ${
            isDark ? "opacity-0" : "opacity-100"
          }`}
          style={reduced ? { transition: "none" } : undefined}
        >
          {SUN.join("\n")}
        </pre>
        <pre
          className={`pointer-events-none absolute inset-0 grid place-items-center whitespace-pre text-[9px] leading-tight transition-opacity duration-200 motion-reduce:transition-none ${
            isDark ? "opacity-100" : "opacity-0"
          }`}
          style={reduced ? { transition: "none" } : undefined}
        >
          {MOON.join("\n")}
        </pre>
      </span>
      <span className="uppercase tracking-[0.15em] text-muted group-hover:text-foreground">
        {mounted ? (isDark ? "dark" : "light") : "theme"}
      </span>
    </button>
  );
}
