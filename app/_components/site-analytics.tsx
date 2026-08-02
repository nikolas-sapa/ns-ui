"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Analytics, minus the copies every card thumbnail was loading.
 *
 * The root layout wraps every route, and a catalog card renders
 * `/preview/<name>/embed` inside an iframe — so each mounted card booted its
 * own Analytics *and* Speed Insights. Measured on the live homepage: both
 * scripts fetched 5x on a single load (once for the page, once per frame), 12
 * on a tall viewport. Beyond the wasted requests that inflates every pageview
 * and vitals sample by the number of visible cards, which quietly corrupts the
 * numbers this site would use to judge a fix like this one.
 *
 * A frame is any document that is not the top-level one, so `window.top` is
 * the whole test — no route list to keep in sync, and it covers the playground
 * frame and the featured-card frame too.
 *
 * Gated behind an effect rather than read during render because the server has
 * no `window`: rendering the scripts on the server and dropping them on the
 * client is a hydration mismatch. Both components are client-only and emit no
 * markup, so a mount-tick delay costs nothing.
 */
export function SiteAnalytics() {
  const [top, setTop] = useState(false);

  useEffect(() => {
    const local = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    setTop(window.self === window.top && !local);
  }, []);

  if (!top) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
