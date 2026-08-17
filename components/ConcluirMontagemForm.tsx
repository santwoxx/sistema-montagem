"use client";

import { useRef, useState } from "react";
import { Alerta, Button } from "@/components/ui";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";

export function ConcluirMontagemForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  const padMontadorRef = useRef<SignaturePadHandle>(null);
  const padClienteRef = useRef<SignaturePadHandle>(null);
  const [fotoNome, setFotoNome] = useState<string | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function validarEEnviar(e: React.FormEvent<HTMLFormElement>) {
    if (padMontadorRef.current?.isEmpty()) {
      e.preventDefault();
      setErroLocal("Falta a sua assinatura.");
      return;
    }
    if (padClienteRef.current?.isEmpty()) {
      e.preventDefault();
      setErroLocal("Falta a assinatura do cliente.");
      return;
    }
    setErroLocal(null);
    setEnviando(true);

    const form = e.currentTarget;
    (form.elements.namedItem("assinaturaMontador") as HTMLInputElement).value =
      padMontadorRef.current?.toDataURL() ?? "";
    (form.elements.namedItem("assinaturaCliente") as HTMLInputElement).value =
      padClienteRef.current?.toDataURL() ?? "";
  }

  return (
    <form action={action} onSubmit={validarEEnviar} className="space-y-5">
      {erroLocal ? <Alerta tipo="erro">{erroLocal}</Alerta> : null}

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">
          Foto do produto montado
        </p>
        <input
          type="file"
          name="foto"
          accept="image/*"
          capture="environment"
          required
          onChange={(e) => setFotoNome(e.target.files?.[0]?.name ?? null)}
          className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-navy-light"
        />
        {fotoNome ? <p className="mt-1 text-xs text-slate-500">{fotoNome}</p> : null}
      </div>

      <SignaturePad ref={padMontadorRef} label="Sua assinatura (montador)" />
      <SignaturePad ref={padClienteRef} label="Assinatura do cliente" />
      <input type="hidden" name="assinaturaMontador" />
      <input type="hidden" name="assinaturaCliente" />

      <Button type="submit" variante="sucesso" className="w-full" disabled={enviando}>
        {enviando ? "Enviando…" : "Concluir montagem"}
      </Button>
    </form>
  );
}
