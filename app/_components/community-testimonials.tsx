import Link from "next/link";
import type { Testimonial } from "@/lib/testimonials";

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
          <figcaption className="mt-auto text-xs leading-5">
            <Link
              href={item.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-accent"
            >
              {item.name}
            </Link>
            <span className="block text-muted">
              {item.role} at {item.company}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
