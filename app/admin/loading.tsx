import { Card } from "@/components/ui/Card";

export default function AdminLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading Admin workspace"
      className="mx-auto max-w-[1280px] animate-pulse px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10"
    >
      <div className="h-3 w-32 rounded-full bg-slate-200 dark:bg-white/10" />
      <div className="mt-4 h-10 w-72 max-w-full rounded-2xl bg-slate-200 dark:bg-white/10" />
      <div className="mt-3 h-5 w-[36rem] max-w-full rounded-xl bg-slate-100 dark:bg-white/5" />
      <div className="mt-8 flex gap-3">
        <div className="h-10 w-28 rounded-full bg-slate-200 dark:bg-white/10" />
        <div className="h-10 w-28 rounded-full bg-slate-200 dark:bg-white/10" />
        <div className="h-10 w-28 rounded-full bg-slate-200 dark:bg-white/10" />
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Card className="h-48" key={index} />
        ))}
      </div>
    </div>
  );
}
