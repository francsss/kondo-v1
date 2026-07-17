export default function PlatformLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto max-w-[1100px] animate-pulse px-4 pb-28 pt-8 sm:px-6 lg:px-8"
    >
      <div className="h-4 w-28 rounded-full bg-slate-200 dark:bg-white/10" />
      <div className="mt-4 h-10 w-64 rounded-2xl bg-slate-200 dark:bg-white/10" />
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="h-56 rounded-3xl bg-white dark:bg-white/5" />
        <div className="h-56 rounded-3xl bg-white dark:bg-white/5" />
      </div>
    </div>
  );
}
