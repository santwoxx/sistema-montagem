function Bloco({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-blue-100/60 ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Bloco className="h-12 w-12 rounded-xl" />
          <Bloco className="h-4 w-32" />
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <Bloco className="mx-auto h-4 w-48" />
          <Bloco className="mx-auto mt-3 h-4 w-64" />
          <Bloco className="mx-auto mt-6 h-10 w-56" />
        </div>
      </div>
    </div>
  );
}
