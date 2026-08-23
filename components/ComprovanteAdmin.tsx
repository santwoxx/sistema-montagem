"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { ConcluirMontagemForm } from "@/components/ConcluirMontagemForm";

/**
 * Envio do comprovante (foto do produto montado e assinaturas) pelo painel
 * do admin. Existe porque não havia caminho nenhum para o dono anexar essa
 * foto: o formulário só aparecia para o montador designado, então montagem
 * feita pela própria empresa ficava sem comprovante para sempre.
 *
 * O formulário só é montado depois do clique de propósito: as áreas de
 * assinatura medem o próprio tamanho na hora em que aparecem, e dentro de um
 * bloco escondido elas nasceriam com largura zero.
 */
export function ComprovanteAdmin({
  action,
  jaTemFoto,
  concluida,
}: {
  action: (formData: FormData) => void | Promise<void>;
  jaTemFoto: boolean;
  concluida: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-4 w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-navy hover:border-navy hover:bg-navy/5"
      >
        📷 {jaTemFoto ? "Trocar a foto ou as assinaturas" : "Enviar a foto do produto montado"}
      </button>
    );
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="mb-4 text-sm text-slate-500">
        Use aqui quando a montagem foi feita pela própria empresa, ou quando
        quem montou não conseguiu enviar pelo aplicativo. A foto é reduzida
        automaticamente antes de subir.
      </p>
      <ConcluirMontagemForm
        action={action}
        exigirAssinaturas={false}
        jaTemFoto={jaTemFoto}
        rotuloAssinaturaMontador="Assinatura de quem montou"
        rotuloBotao={concluida ? "Salvar comprovante" : "Salvar e concluir montagem"}
      />
      <Button
        type="button"
        variante="fantasma"
        className="mt-2 w-full"
        onClick={() => setAberto(false)}
      >
        Cancelar
      </Button>
    </div>
  );
}
