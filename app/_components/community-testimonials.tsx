import Link from "next/link";
import Image from "next/image";
import type { Testimonial } from "@/lib/testimonials";

// Only a path served from this origin is rendered. `next/image` throws on a
// remote host absent from `next.config`'s `remotePatterns` (there are none),
// which would take the whole page down for one bad row — so an off-origin
// value is dropped rather than trusted. Today nothing can supply one: the
// submission form has no photo field, so `photoUrl` only ever comes from the
// built-in seed. This is the guard for the day that changes.
const isLocal = (url: string | undefined): url is string =>
  typeof url === "string" && url.startsWith("/") && !url.startsWith("//");

export function CommunityTestimonials({ items }: { items: Testimonial[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-surface px-6 py-8 text-center">
        <p className="text-sm leading-6 text-muted">
          No experiences shared yet. Be the first to contribute.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {items.map((item) => (
        <figure
          key={item.id}
          className="flex flex-col gap-4 rounded-sm border border-border bg-surface px-5 py-4"
        >
          <blockquote className="text-sm leading-6 text-foreground">
            &ldquo;{item.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-auto flex items-center gap-3 text-xs leading-5">
            {isLocal(item.photoUrl) ? (
              <Image
                src={item.photoUrl}
                alt={item.name}
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <span>
              <Link
                href={item.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-accent"
              >
                {item.name}
              </Link>
              <span className="block text-muted">
                {item.role} at{" "}
                {item.companyUrl ? (
                  <Link
                    href={item.companyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {item.company}
                  </Link>
                ) : (
                  item.company
                )}
              </span>
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
