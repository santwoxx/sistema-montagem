"use client";

import { useState, useTransition } from "react";
import { Alerta, Button } from "@/components/ui";

type Resultado = { ok: true; url: string } | { ok: false; erro: string };

export function EnviarAvaliacaoButton({
  action,
  jaSolicitadoEm,
}: {
  action: () => Promise<Resultado>;
  jaSolicitadoEm?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await action();
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      window.open(resultado.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div>
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      <Button
        type="button"
        variante="sucesso"
        className="w-full"
        onClick={enviar}
        disabled={pending}
      >
        {pending ? "Preparando link…" : "💬 Enviar link de avaliação pelo WhatsApp"}
      </Button>
      {jaSolicitadoEm ? (
        <p className="mt-2 text-center text-xs text-slate-500">
          Último pedido de avaliação enviado em {jaSolicitadoEm}.
        </p>
      ) : null}
    </div>
  );
}
