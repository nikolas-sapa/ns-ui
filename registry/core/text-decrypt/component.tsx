"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=";

export function DecryptText({
  text,
  delay = 150,
  stagger = 55,
  ambient = 0,
  className = "",
  replayKey = 0,
}: {
  /** the text that resolves out of the scramble */
  text: string;
  /** ms before the first character locks */
  delay?: number;
  /** ms between character locks (left to right) */
  stagger?: number;
  /** ms between idle glitches re-scrambling a few characters; 0 = off */
  ambient?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** bump to replay the animation */
  replayKey?: number;
}) {
  const chars = Array.from(text);
  const [locked, setLocked] = useState(-1);
  const [churn, setChurn] = useState<string[]>(chars.map(() => ""));
  const [glitch, setGlitch] = useState<ReadonlySet<number>>(new Set());
  const reduced = useRef(false);

  const randomGlyph = useCallback(
    () => CHARSET[Math.floor(Math.random() * CHARSET.length)],
    []
  );

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setLocked(chars.length - 1);
      return;
    }
    setLocked(-1);
    let raf = 0;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const lockedCount = Math.min(
        chars.length - 1,
        Math.floor((elapsed - delay) / stagger)
      );
      setLocked(lockedCount);
      // churn unresolved glyphs every 3rd frame so they flicker, not strobe
      if (frame++ % 3 === 0) {
        setChurn(chars.map((c, i) => (i > lockedCount && c !== " " ? randomGlyph() : c)));
      }
      if (lockedCount < chars.length - 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay, stagger, replayKey]);

  // idle life: every `ambient` ms a few adjacent characters glitch and relock
  useEffect(() => {
    if (!ambient || reduced.current) return;
    let churnId: ReturnType<typeof setInterval> | undefined;
    const id = setInterval(() => {
      const start = Math.floor(Math.random() * Math.max(1, chars.length - 3));
      const span = new Set(
        [start, start + 1, start + 2].filter((i) => i < chars.length && chars[i] !== " ")
      );
      setGlitch(span);
      let n = 0;
      churnId = setInterval(() => {
        setChurn((prev) =>
          prev.map((c, i) => (span.has(i) ? randomGlyph() : c))
        );
        if (++n > 6) {
          clearInterval(churnId);
          setGlitch(new Set());
        }
      }, 55);
    }, ambient);
    return () => {
      clearInterval(id);
      if (churnId) clearInterval(churnId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient, text, replayKey]);

  return (
    <span aria-label={text} role="text" className={`font-mono ${className}`}>
      {chars.map((c, i) => {
        const state =
          i <= locked && !glitch.has(i)
            ? "locked"
            : i === locked + 1 || glitch.has(i)
              ? "resolving"
              : "churning";
        return (
          <span
            key={i}
            aria-hidden
            className={
              state === "locked"
                ? "text-foreground"
                : state === "resolving"
                  ? "text-foreground brightness-150"
                  : "text-ns-muted/70"
            }
          >
            {c === " " ? " " : state === "locked" ? c : churn[i] || c}
          </span>
        );
      })}
    </span>
  );
}
