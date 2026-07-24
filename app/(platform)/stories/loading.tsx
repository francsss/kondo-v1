export default function StoriesLoading() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#071813] text-white">
      <div className="text-center">
        <span className="mx-auto block h-12 w-12 animate-pulse rounded-2xl bg-kondo-lime/20" />
        <p className="mt-4 text-sm font-black">Preparing useful Stories…</p>
        <p className="mt-1 text-xs text-white/45">
          Loading only what you need next.
        </p>
      </div>
    </main>
  );
}
