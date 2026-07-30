export default function OrganizationsLoading() {
  return (
    <div className="min-h-dvh animate-pulse bg-background">
      <div className="h-16 border-b border-border bg-card" />
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-10 w-72 rounded-2xl bg-muted" />
        <div className="mt-4 h-5 w-full max-w-xl rounded-xl bg-muted" />
        <div className="mt-8 h-32 rounded-[2rem] bg-muted" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-64 rounded-[2rem] bg-muted" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
