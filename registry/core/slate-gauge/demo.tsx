"use client";

import { SlateGauge } from "./component";

export default function SlateGaugeDemo() {
  return (
    <main className="flex h-screen w-full items-center justify-center overflow-hidden bg-background p-6">
      {/* the wall's geometry never moves — tab through the slates or click
          one to lift it and read the full quote; watch the wall itself for
          a few seconds and one centre-nailed slate down the gust's path
          will clatter on its own */}
      <div className="h-full w-full">
        <SlateGauge />
      </div>
    </main>
  );
}
