"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=";

export function DecryptText({
  text,
  delay = 150,
  stagger = 55,
  className = "",
  replayKey = 0,
}: {
  text: string;
  /** ms before the first character locks */
  delay?: number;
  /** ms between character locks (left to right) */
  stagger?: number;
  className?: string;
  /** bump to replay the animation */
  replayKey?: number;
}) {
  const chars = Array.from(text);
  const [locked, setLocked] = useState(-1);
  const [churn, setChurn] = useState<string[]>(chars.map(() => ""));
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

  return (
    <span aria-label={text} role="text" className={`font-mono ${className}`}>
      {chars.map((c, i) => {
        const state = i <= locked ? "locked" : i === locked + 1 ? "resolving" : "churning";
        return (
          <span
            key={i}
            aria-hidden
            className={
              state === "locked"
                ? "text-foreground"
                : state === "resolving"
                  ? "text-foreground brightness-150"
                  : "text-muted/70"
            }
          >
            {c === " " ? " " : state === "locked" ? c : churn[i] || c}
          </span>
        );
      })}
    </span>
  );
}
