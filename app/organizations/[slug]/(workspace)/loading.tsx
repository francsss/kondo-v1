export default function OrganizationWorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading organization workspace"
      className="mx-auto w-full max-w-[1440px] animate-pulse px-4 py-5 motion-reduce:animate-none sm:px-6 lg:px-8"
      role="status"
    >
      <div className="rounded-4xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-40 rounded-full bg-muted" />
            <div className="mt-3 h-8 max-w-md rounded-xl bg-muted" />
            <div className="mt-2 h-3 w-52 rounded-full bg-muted" />
          </div>
        </div>
        <div className="mt-6 flex gap-2 overflow-hidden border-t border-border pt-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="h-9 w-24 shrink-0 rounded-xl bg-muted"
              key={index}
            />
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-28 rounded-3xl border border-border bg-card"
            key={index}
          />
        ))}
      </div>
      <span className="sr-only">Loading organization workspace…</span>
    </div>
  );
}
