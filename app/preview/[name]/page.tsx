import { notFound } from "next/navigation";
import { demos } from "@/registry/index";

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { name } = await params;
  const { embed } = await searchParams;
  const Demo = demos[name];
  if (!Demo) notFound();

  // `?embed=1` is how the landing-page cards load this page inside an iframe.
  // It changes nothing visual — this page stays the reference the cards are
  // matched against — it only makes the demo inert. Without it, a demo that
  // focuses something on mount (event-horizon-command focuses its input) hands
  // focus to the iframe, and the browser scrolls the *host* page to reveal
  // that iframe: the landing page jumped ~1000px on its own. Inert also keeps
  // the demo's own controls out of the host page's tab order.
  const embedded = embed === "1";

  return (
    <div className="min-h-screen" inert={embedded}>
      <Demo />
    </div>
  );
}
