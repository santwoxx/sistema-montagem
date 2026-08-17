function Bloco({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-blue-100/60 ${className ?? ""}`} />;
}

/** Esqueleto genérico para páginas de detalhe (voltar + cabeçalho + cards). */
export function DetalheSkeleton({ cartoes = 3 }: { cartoes?: number }) {
  return (
    <div>
      <Bloco className="mb-3 h-4 w-40" />
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <Bloco className="h-6 w-56" />
          <Bloco className="h-4 w-32" />
        </div>
        <Bloco className="h-7 w-20 rounded-full" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: cartoes }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-blue-100/80 bg-white p-5">
            <Bloco className="h-4 w-28" />
            <Bloco className="mt-3 h-4 w-full" />
            <Bloco className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PainelSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <Bloco className="h-7 w-48" />
          <Bloco className="h-4 w-72" />
        </div>
        <Bloco className="h-10 w-36" />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-blue-100/80 bg-white p-5">
            <Bloco className="h-4 w-24" />
            <Bloco className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        <Bloco className="h-5 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-blue-100/80 bg-white p-5">
            <Bloco className="h-4 w-56" />
            <Bloco className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
