// Suspense fallback for `/account` while the Convex queries in
// `_account-data.tsx` are in flight. Painted immediately (no data
// dependency) so FCP no longer waits on the transatlantic round trip.
// No interactive elements here, so no focus-visible ring is needed.
export function AccountSkeleton() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col px-6 py-16 sm:px-10">
      <div className="h-7 w-24 animate-pulse rounded-sm bg-muted/30" />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-14">
        <div className="flex flex-col gap-8">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded-sm bg-muted/30" />
            <div className="h-4 w-40 animate-pulse rounded-sm bg-muted/20" />
          </div>

          <div className="space-y-3">
            <div className="h-4 w-16 animate-pulse rounded-sm bg-muted/30" />
            <div className="h-9 w-full animate-pulse rounded-sm border border-border bg-muted/10" />
          </div>

          <div className="space-y-3">
            <div className="h-4 w-16 animate-pulse rounded-sm bg-muted/30" />
            <div className="h-32 w-full animate-pulse rounded-sm border border-border bg-muted/10" />
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="space-y-3">
            <div className="h-4 w-20 animate-pulse rounded-sm bg-muted/30" />
            <div className="h-48 w-full animate-pulse rounded-sm border border-border bg-muted/10" />
          </div>
        </div>
      </div>

      <div className="mt-12 h-px w-full border-t border-border pt-6" />
    </main>
  );
}
