"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { formatarData, formatarMoeda } from "@/lib/format";
import { descartarNotaPendenteAction } from "@/lib/actions/notasPendentes";

export type NotaPendenteResumo = {
  id: string;
  numeroPedido: string | null;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEndereco: string;
  descricaoServico: string;
  valorServico: number | null;
  dataAgendada: string | null;
  observacoes: string | null;
  fotoReferenciaUrl: string | null;
  montadorSugeridoId: string | null;
  montadorSugeridoNome: string | null;
  lojaNomeSugerida: string | null;
  lojaCnpjSugerido: string | null;
};

/**
 * Lista os pedidos recebidos de sistemas externos (hoje só o CentralSync)
 * que ainda não viraram uma montagem. Escolher "Usar esta nota" preenche o
 * formulário abaixo — nada é salvo até o admin conferir e clicar em
 * "Salvar montagem".
 */
export function NotasPendentesCard({
  notas,
  onUsar,
}: {
  notas: NotaPendenteResumo[];
  onUsar: (nota: NotaPendenteResumo) => void;
}) {
  const [usadaId, setUsadaId] = useState<string | null>(null);
  const [descartandoId, setDescartandoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function descartar(id: string) {
    setDescartandoId(id);
    startTransition(async () => {
      await descartarNotaPendenteAction(id);
      setDescartandoId(null);
    });
  }

  return (
    <Card className="border-gold/40 bg-gold/5">
      <h2 className="mb-1 text-base font-semibold text-slate-900">
        Pedidos pendentes ({notas.length})
      </h2>
      <p className="mb-3 text-sm text-slate-500">
        Pedidos enviados pelo CentralSync aguardando revisão. Escolha um para
        preencher o formulário abaixo, confira os dados e clique em &ldquo;Salvar
        montagem&rdquo;.
      </p>
      <div className="space-y-2">
        {notas.map((nota) => (
          <div
            key={nota.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {nota.fotoReferenciaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externa (Firebase Storage), sem next/image configurado para esse domínio
                <img
                  src={nota.fotoReferenciaUrl}
                  alt="Foto do produto"
                  className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{nota.clienteNome}</p>
                {nota.lojaNomeSugerida ? (
                  <p className="truncate text-xs font-medium text-navy">{nota.lojaNomeSugerida}</p>
                ) : null}
                <p className="truncate text-sm text-slate-500">{nota.clienteEndereco}</p>
                <p className="text-xs text-slate-400">
                  {nota.descricaoServico}
                  {nota.valorServico ? ` · ${formatarMoeda(nota.valorServico)}` : ""}
                  {nota.dataAgendada ? ` · Agendado para ${formatarData(nota.dataAgendada)}` : ""}
                  {nota.montadorSugeridoNome ? ` · Sugestão: ${nota.montadorSugeridoNome}` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variante="secundario"
                className="px-3 py-2 text-sm"
                onClick={() => {
                  setUsadaId(nota.id);
                  onUsar(nota);
                }}
              >
                {usadaId === nota.id ? "Usada ✓" : "Usar esta nota"}
              </Button>
              <Button
                type="button"
                variante="fantasma"
                className="px-3 py-2 text-sm"
                disabled={isPending && descartandoId === nota.id}
                onClick={() => descartar(nota.id)}
              >
                Descartar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
