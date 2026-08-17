"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function ErroMontador({
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
    <Card className="text-center">
      <p className="mb-2 text-base font-semibold text-slate-900">
        Algo deu errado nesta página
      </p>
      <p className="mb-5 text-sm text-slate-500">
        Tente novamente. Se o problema continuar, avise o administrador.
      </p>
      <Button onClick={() => retry()} className="w-full">
        Tentar novamente
      </Button>
    </Card>
  );
}
