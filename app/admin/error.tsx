"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function ErroAdmin({
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
    <Card className="mx-auto max-w-md text-center">
      <p className="mb-2 text-base font-semibold text-slate-900">
        Algo deu errado nesta página
      </p>
      <p className="mb-5 text-sm text-slate-500">
        Tente novamente. Se o problema continuar, verifique se há uma
        atualização pendente do sistema.
      </p>
      <Button onClick={() => retry()}>Tentar novamente</Button>
    </Card>
  );
}
