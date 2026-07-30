import { KondoLogo } from "@/components/KondoLogo";

export default function OnboardingLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading onboarding"
      className="min-h-screen bg-background px-5 py-6 sm:px-10"
    >
      <div className="mx-auto max-w-6xl">
        <KondoLogo />
        <div className="mx-auto mt-14 grid max-w-5xl animate-pulse gap-8 motion-reduce:animate-none lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="hidden space-y-3 lg:block">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                className="h-14 rounded-2xl bg-muted"
                key={`progress-${index}`}
              />
            ))}
          </div>
          <div className="rounded-4xl border border-border bg-card p-7 shadow-soft sm:p-10">
            <div className="h-3 w-36 rounded-full bg-muted" />
            <div className="mt-5 h-9 w-3/4 rounded-xl bg-muted" />
            <div className="mt-3 h-4 w-full rounded-full bg-muted" />
            <div className="mt-10 space-y-4">
              <div className="h-14 rounded-2xl bg-muted" />
              <div className="h-14 rounded-2xl bg-muted" />
              <div className="h-14 rounded-2xl bg-muted" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
