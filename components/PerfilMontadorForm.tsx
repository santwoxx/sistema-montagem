"use client";

import { useState, type ChangeEvent } from "react";
import { Field, Input } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/SubmitButton";

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

  function aoEscolherFoto(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo) setPreview(URL.createObjectURL(arquivo));
  }

  return (
    <form action={action} className="space-y-5">
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
          Clique no ícone da câmera para trocar sua foto.
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
