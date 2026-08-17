"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function ErroGeral({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="max-w-sm text-center">
        <p className="mb-2 text-base font-semibold text-slate-900">
          Algo deu errado
        </p>
        <p className="mb-5 text-sm text-slate-500">
          Não conseguimos carregar esta página agora. Tente novamente em
          alguns instantes.
        </p>
        <Button onClick={() => retry()}>Tentar novamente</Button>
      </Card>
    </div>
  );
}
