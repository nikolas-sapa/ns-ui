import Link from "next/link";
import Image from "next/image";
import { ScarpHorizon } from "@/registry/loud/hero-ascii-terrain/component";
import { AccountSignIn } from "./account-signin";

export function AccountSignedOut() {
  return (
    <main
      className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1.15fr)_minmax(28rem,0.85fr)]"
      style={{ fontFamily: "ui-rounded, var(--font-sans)" }}
    >
      <section
        data-auth-visual
        aria-hidden="true"
        className="relative min-h-[42rem] overflow-hidden border-b border-border lg:min-h-screen lg:border-b-0 lg:border-r"
      >
        <ScarpHorizon className="min-h-[42rem] lg:min-h-screen" />
      </section>

      <section
        data-auth-copy
        className="flex min-h-[42rem] flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 lg:min-h-screen lg:px-16 lg:py-14"
      >
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted underline-offset-4 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            ns-ui
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Your library starts here
          </span>
        </div>

        <div className="mx-auto w-full max-w-sm py-16 lg:py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Account
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Sign in to save.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Use GitHub, Google, or an email code. Your saved components stay
            close at hand.
          </p>
          <div className="mt-8">
            <AccountSignIn />
          </div>

          <figure className="mt-14 border-t border-border pt-6">
            <blockquote className="text-sm leading-6 text-foreground">
              “I love using this design system whenever I need inspiration for
              primarily abstract features in our internal products, things that
              add some flare. I love it”
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <Image
                src="/testimonials/alex-lekkas.png"
                alt="Alex Lekkas"
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-full object-cover"
              />
              <span className="text-xs leading-5">
                <Link
                  href="https://www.linkedin.com/in/alexandros-lekkas/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Alex Lekkas
                </Link>
                <span className="block text-muted">Founding Engineer at Spawn Partners</span>
              </span>
            </figcaption>
          </figure>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Built for developers and designers
        </p>
      </section>
    </main>
  );
}
