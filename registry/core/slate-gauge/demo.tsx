"use client";

import { SlateGauge } from "./component";

export default function SlateGaugeDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="h-[320px] w-full max-w-4xl">
        {/* the wall's geometry never moves — tab through the slates or click
            one to lift it and read the full quote; watch the wall itself for
            a few seconds and one centre-nailed slate down the gust's path
            will clatter on its own */}
        <SlateGauge />
      </div>
    </main>
  );
}
