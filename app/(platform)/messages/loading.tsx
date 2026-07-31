export default function MessagesLoading() {
  return (
    <div
      aria-label="Loading messages"
      className="mx-auto max-w-[940px] animate-pulse px-3 pb-28 pt-5 sm:px-6 sm:pt-8 lg:px-8"
      role="status"
    >
      <div className="h-3 w-28 rounded-full bg-muted" />
      <div className="mt-4 h-9 w-44 rounded-xl bg-muted" />
      <div className="mt-3 h-4 w-full max-w-md rounded-full bg-muted" />
      <div className="mt-7 grid gap-3 sm:grid-cols-[190px_minmax(0,1fr)]">
        <div className="h-12 rounded-2xl bg-muted" />
        <div className="h-12 rounded-2xl bg-muted" />
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="flex h-[76px] items-center gap-4 rounded-[1.35rem] border border-border bg-card px-4"
            key={index}
          >
            <div className="h-12 w-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded-full bg-muted" />
              <div className="h-3 w-2/3 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading messages…</span>
    </div>
  );
}
