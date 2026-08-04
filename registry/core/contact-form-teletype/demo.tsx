"use client";

import { ContactFormTeletype } from "./component";

export default function ContactFormTeletypeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / contact-form-teletype</p>
      <ContactFormTeletype className="max-w-sm" />
    </div>
  );
}
