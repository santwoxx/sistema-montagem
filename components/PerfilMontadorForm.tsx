"use client";

import { useState, type ChangeEvent } from "react";
import { Field, Input } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/SubmitButton";
import { comprimirImagem, trocarArquivoDoInput } from "@/lib/imagem";

export function PerfilMontadorForm({
  action,
  nomeAtual,
  telefoneAtual,
  fotoAtualUrl,
}: {
  action: (formData: FormData) => void;
  nomeAtual: string;
  telefoneAtual: string;
  fotoAtualUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(fotoAtualUrl);
  const [preparando, setPreparando] = useState(false);

  async function aoEscolherFoto(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    setPreview(URL.createObjectURL(arquivo));

    // Troca a foto original pela versão reduzida antes do envio: a original
    // do celular não cabe no limite de tamanho de uma Server Action.
    setPreparando(true);
    try {
      const menor = await comprimirImagem(arquivo, { ladoMaximo: 800 });
      if (menor !== arquivo) trocarArquivoDoInput(input, menor);
    } finally {
      setPreparando(false);
    }
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (preparando) e.preventDefault();
      }}
      className="space-y-5"
    >
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar nome={nomeAtual} fotoUrl={preview} tamanho="h-20 w-20 text-xl" />
          <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-gold text-sm shadow-sm ring-2 ring-white hover:bg-gold-hover">
            📷
            <input
              type="file"
              name="foto"
              accept="image/*"
              onChange={aoEscolherFoto}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-sm text-slate-500">
          {preparando
            ? "Preparando a foto…"
            : "Clique no ícone da câmera para trocar sua foto."}
        </p>
      </div>

      <Field label="Nome completo">
        <Input name="nome" defaultValue={nomeAtual} required />
      </Field>
      <Field label="Telefone (WhatsApp)">
        <Input name="telefone" defaultValue={telefoneAtual} placeholder="(11) 91234-5678" />
      </Field>

      <SubmitButton pendingText="Salvando…">Salvar perfil</SubmitButton>
    </form>
  );
}
