"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * GA4 measurement ID, e.g. `G-XXXXXXXXXX`. Unset — the local and
 * preview-without-the-var case — emits nothing, so GA is opt-in per deploy
 * target rather than something that has to be stubbed out in development.
 *
 * It lives here rather than in the layout specifically to inherit the
 * top-frame guard below. Dropped into <head> instead, it would boot once per
 * catalog card iframe, which is the exact bug the Vercel scripts above were
 * moved here to fix: 5-12 copies per load, every pageview multiplied by the
 * number of visible cards.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

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
      {GA_ID ? (
        <>
          {/* afterInteractive, not beforeInteractive: analytics is never on
              the critical path, and gtag.js is ~90KB of third-party script.
              `send_page_view` stays on — the App Router does a full document
              request per navigation here (no client-side router cache for
              these routes), so the default pageview is correct and a manual
              pathname listener would double-count. */}
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}
