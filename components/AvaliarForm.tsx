"use client";

import { useState } from "react";
import { Alerta, Button, Textarea } from "@/components/ui";
import { SeletorEstrelas } from "@/components/SeletorEstrelas";

export function AvaliarForm({
  action,
  nomeMontador,
}: {
  action: (formData: FormData) => void;
  nomeMontador: string;
}) {
  const [estrelas, setEstrelas] = useState(0);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function validarEEnviar(e: React.FormEvent<HTMLFormElement>) {
    if (estrelas < 1) {
      e.preventDefault();
      setErroLocal("Escolha de 1 a 5 estrelas antes de enviar.");
      return;
    }
    setErroLocal(null);
    setEnviando(true);
  }

  return (
    <form action={action} onSubmit={validarEEnviar} className="space-y-5">
      {erroLocal ? <Alerta tipo="erro">{erroLocal}</Alerta> : null}

      <div className="flex justify-center">
        <SeletorEstrelas name="estrelas" valor={estrelas} onChange={setEstrelas} />
      </div>

      <Textarea
        name="comentario"
        rows={3}
        maxLength={500}
        placeholder={`Quer contar algo sobre o atendimento de ${nomeMontador}? (opcional)`}
      />

      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar avaliação"}
      </Button>
    </form>
  );
}
