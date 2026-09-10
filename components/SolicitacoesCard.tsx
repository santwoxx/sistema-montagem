"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { formatarData } from "@/lib/format";
import { recusarSolicitacaoAction } from "@/lib/actions/agendamentos";
import { PERIODO_LABEL, type PeriodoAgendamento } from "@/lib/validacao";

export type SolicitacaoResumo = {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteEndereco: string;
  produto: string;
  observacoes: string | null;
  dataPreferida: string | null;
  periodo: string | null;
  criadaEm: string;
};

function rotuloPeriodo(periodo: string | null): string | null {
  if (!periodo) return null;
  return PERIODO_LABEL[periodo as PeriodoAgendamento] ?? null;
}

/**
 * Fila do link público de agendamento (/agendar): pedidos que o próprio
 * cliente preencheu e que ainda não viraram montagem.
 *
 * Mesma ideia da NotasPendentesCard: "Usar" só preenche o formulário abaixo
 * — quem decide preço, comissão e data é o admin, e nada entra no
 * financeiro antes de ele clicar em "Salvar montagem". A diferença é a
 * procedência: aqui os dados foram digitados por alguém de fora, então a
 * tela mostra tudo que o cliente escreveu para poder ser conferido.
 */
export function SolicitacoesCard({
  solicitacoes,
  onUsar,
}: {
  solicitacoes: SolicitacaoResumo[];
  onUsar: (solicitacao: SolicitacaoResumo) => void;
}) {
  const [usadaId, setUsadaId] = useState<string | null>(null);
  const [recusandoId, setRecusandoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function recusar(id: string) {
    setRecusandoId(id);
    startTransition(async () => {
      await recusarSolicitacaoAction(id);
      setRecusandoId(null);
    });
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <h2 className="mb-1 text-base font-semibold text-slate-900">
        Pedidos do site ({solicitacoes.length})
      </h2>
      <p className="mb-3 text-sm text-slate-500">
        Clientes que preencheram o link público de agendamento. Escolha um para
        preencher o formulário abaixo — costuma ser um{" "}
        <strong className="font-medium text-slate-700">serviço particular</strong>,
        já que o cliente veio direto, sem loja.
      </p>
      <div className="space-y-2">
        {solicitacoes.map((s) => {
          const periodo = rotuloPeriodo(s.periodo);
          return (
            <div
              key={s.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{s.clienteNome}</p>
                <p className="text-sm text-slate-600">{s.clienteTelefone}</p>
                <p className="truncate text-sm text-slate-500">{s.clienteEndereco}</p>
                <p className="mt-1 text-xs text-slate-500">{s.produto}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Pedido em {formatarData(s.criadaEm)}
                  {s.dataPreferida ? ` · Prefere ${formatarData(s.dataPreferida)}` : ""}
                  {periodo ? ` · ${periodo}` : ""}
                </p>
                {s.observacoes ? (
                  <p className="mt-1 text-xs italic text-slate-500">
                    &ldquo;{s.observacoes}&rdquo;
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variante="secundario"
                  className="px-3 py-2 text-sm"
                  onClick={() => {
                    setUsadaId(s.id);
                    onUsar(s);
                  }}
                >
                  {usadaId === s.id ? "Usado ✓" : "Usar este pedido"}
                </Button>
                <Button
                  type="button"
                  variante="fantasma"
                  className="px-3 py-2 text-sm"
                  disabled={isPending && recusandoId === s.id}
                  onClick={() => recusar(s.id)}
                >
                  Recusar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
