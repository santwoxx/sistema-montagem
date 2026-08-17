"use client";

import { useState } from "react";
import { Button, Field, Select, Textarea } from "@/components/ui";

const OPCOES = [
  { valor: "CLIENTE_AUSENTE", label: "Cliente ausente" },
  { valor: "PECA_DANIFICADA", label: "Peça danificada ou faltando" },
  { valor: "REAGENDAR", label: "Cliente pediu para remarcar" },
  { valor: "OUTRO", label: "Outro problema" },
];

export function RegistrarOcorrenciaForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full text-center text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
      >
        Não consegui concluir agora — registrar ocorrência
      </button>
    );
  }

  return (
    <form action={action} onSubmit={() => setEnviando(true)} className="space-y-4">
      <Field label="O que aconteceu?">
        <Select name="tipo" required defaultValue="">
          <option value="" disabled>
            Selecione uma opção
          </option>
          {OPCOES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Detalhes (opcional)">
        <Textarea
          name="observacao"
          rows={2}
          placeholder="Ex: cliente não atendeu, porta com defeito de fábrica..."
        />
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">
          Foto (opcional, útil se for peça danificada)
        </p>
        <input
          type="file"
          name="foto"
          accept="image/*"
          capture="environment"
          className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-navy-light"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variante="secundario"
          className="flex-1"
          onClick={() => setAberto(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" variante="perigo" className="flex-1" disabled={enviando}>
          {enviando ? "Enviando…" : "Registrar ocorrência"}
        </Button>
      </div>
    </form>
  );
}
