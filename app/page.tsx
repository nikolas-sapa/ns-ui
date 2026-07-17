import Link from "next/link";
import registry from "@/registry.json";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">ns-ui</h1>
      <p className="mt-2 text-sm text-muted">Personal component registry.</p>
      <ul className="mt-12 space-y-1">
        {registry.items.map((item) => (
          <li key={item.name}>
            <Link
              href={`/preview/${item.name}`}
              className="flex items-baseline justify-between rounded-md px-3 py-2 transition-colors hover:bg-surface"
            >
              <span className="text-sm">{item.title}</span>
              <span className="font-mono text-xs text-muted">{item.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
