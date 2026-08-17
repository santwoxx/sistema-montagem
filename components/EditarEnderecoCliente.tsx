"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function EditarEnderecoCliente({
  action,
  enderecoAtual,
  telefoneAtual,
}: {
  action: (formData: FormData) => void;
  enderecoAtual: string;
  telefoneAtual: string;
}) {
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <Button
        type="button"
        variante="fantasma"
        className="mt-3 !px-2 !py-1 text-xs"
        onClick={() => setEditando(true)}
      >
        ✏️ Corrigir endereço ou telefone
      </Button>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <Field label="Endereço completo">
        <Input name="clienteEndereco" defaultValue={enderecoAtual} required />
      </Field>
      <Field label="Telefone do cliente">
        <Input
          name="clienteTelefone"
          defaultValue={telefoneAtual}
          placeholder="(11) 91234-5678"
        />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pendingText="Salvando…" className="flex-1">
          Salvar
        </SubmitButton>
        <Button type="button" variante="secundario" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
