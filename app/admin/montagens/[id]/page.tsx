import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  atualizarMontagemAction,
  alternarPagamentoLojaAction,
  alternarPagamentoMontadorAction,
  excluirMontagemAction,
  confirmarEnvioCentralSyncAction,
} from "@/lib/actions/montagens";
import { pareceIdDoCentralSync } from "@/lib/centralsync";
import { Alerta, Badge, Button, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { NovaMontagemForm } from "@/components/NovaMontagemForm";
import { FormConfirmar } from "@/components/FormConfirmar";
import { Estrelas } from "@/components/Estrelas";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  OCORRENCIA_COLOR,
  OCORRENCIA_LABEL,
  paraInputDate,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/format";

export default async function MontagemDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { id } = await params;
  const { erro, sucesso } = await searchParams;

  const [montagem, lojas, montadores, comissoes] = await Promise.all([
    prisma.montagem.findUnique({
      where: { id },
      include: { avaliacao: true, ocorrencias: { orderBy: { criadoEm: "desc" } }, montador: true },
    }),
    prisma.loja.findMany({ orderBy: { nome: "asc" } }),
    prisma.user.findMany({ where: { role: "MONTADOR" }, orderBy: { nome: "asc" } }),
    prisma.comissaoLoja.findMany(),
  ]);

  if (!montagem) notFound();

  return (
    <div>
      <p className="mb-2">
        <Link href="/admin/montagens" className="text-sm text-blue-600 hover:underline">
          ← Voltar para montagens
        </Link>
      </p>
      <PageHeader
        titulo={montagem.clienteNome}
        descricao={montagem.numeroPedido ? `Pedido nº ${montagem.numeroPedido}` : undefined}
        acoes={
          <Badge className={STATUS_COLOR[montagem.status]}>
            {STATUS_LABEL[montagem.status]}
          </Badge>
        }
      />

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {sucesso ? <Alerta tipo="sucesso">{sucesso}</Alerta> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-gray-500">Pagamento da loja</p>
          <div className="mt-2 flex items-center justify-between">
            <Badge
              className={
                montagem.pagoPelaLoja
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }
            >
              {montagem.pagoPelaLoja ? "Pago" : "Pendente"}
            </Badge>
            <form action={alternarPagamentoLojaAction.bind(null, montagem.id)}>
              <SubmitButton variante="secundario" pendingText="Salvando…">
                Marcar como {montagem.pagoPelaLoja ? "pendente" : "pago"}
              </SubmitButton>
            </form>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Valor total: {formatarMoeda(montagem.valorServico)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Assistência ({montagem.percentualAssistencia}%): {formatarMoeda(montagem.valorAssistencia)} — fica com a empresa
          </p>
        </Card>

        <Card>
          <p className="text-sm font-medium text-gray-500">Pagamento ao montador</p>
          <div className="mt-2 flex items-center justify-between">
            <Badge
              className={
                montagem.pagoAoMontador
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }
            >
              {montagem.pagoAoMontador ? "Pago" : "Pendente"}
            </Badge>
            <form action={alternarPagamentoMontadorAction.bind(null, montagem.id)}>
              <SubmitButton variante="secundario" pendingText="Salvando…">
                Marcar como {montagem.pagoAoMontador ? "pendente" : "pago"}
              </SubmitButton>
            </form>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Comissão ({montagem.percentualMontador}%): {formatarMoeda(montagem.valorMontador)}
          </p>
        </Card>
      </div>

      {montagem.fotoProdutoUrl || montagem.assinaturaMontador || montagem.assinaturaCliente ? (
        <Card className="mb-6">
          <p className="mb-3 text-sm font-medium text-slate-500">
            Comprovante de conclusão
          </p>
          {montagem.fotoProdutoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={montagem.fotoProdutoUrl}
              alt="Foto do produto montado"
              className="mb-4 max-h-96 w-full rounded-xl border border-slate-200 object-contain"
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {montagem.assinaturaMontador ? (
              <div>
                <p className="mb-1 text-xs text-slate-500">Assinatura do montador</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={montagem.assinaturaMontador}
                  alt="Assinatura do montador"
                  className="w-full rounded-lg border border-slate-200 bg-white"
                />
              </div>
            ) : null}
            {montagem.assinaturaCliente ? (
              <div>
                <p className="mb-1 text-xs text-slate-500">Assinatura do cliente</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={montagem.assinaturaCliente}
                  alt="Assinatura do cliente"
                  className="w-full rounded-lg border border-slate-200 bg-white"
                />
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {pareceIdDoCentralSync(montagem.numeroPedido) ? (
        <Card className="mb-6 border-blue-100">
          <p className="text-sm font-medium text-slate-500">Integração CentralSync</p>
          {montagem.notificadoCentralSyncEm ? (
            <p className="mt-2 text-sm text-emerald-700">
              ✔ CentralSync avisado em {formatarDataHora(montagem.notificadoCentralSyncEm)}.
            </p>
          ) : montagem.status === "CONCLUIDO" ? (
            <>
              <p className="mt-1 mb-3 text-sm text-slate-500">
                Esse pedido veio do CentralSync e já foi concluído aqui
                {montagem.montador ? ` por ${montagem.montador.nome}` : ""}. Confirme
                para enviar a foto e as assinaturas de volta pra lá.
              </p>
              <form action={confirmarEnvioCentralSyncAction.bind(null, montagem.id)}>
                <SubmitButton pendingText="Enviando…">Confirmar e avisar o CentralSync</SubmitButton>
              </form>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Assim que a montagem for concluída (foto + assinaturas), você
              poderá confirmar o envio da conclusão de volta pro CentralSync
              aqui.
            </p>
          )}
        </Card>
      ) : null}

      {montagem.status === "CONCLUIDO" ? (
        <Card className="mb-6">
          <p className="mb-1 text-sm font-medium text-gray-500">Avaliação do cliente</p>
          {montagem.avaliacao ? (
            <div>
              <div className="mt-2 flex items-center gap-2">
                <Estrelas valor={montagem.avaliacao.estrelas} tamanho="text-xl" />
                <span className="text-sm text-gray-500">
                  {montagem.avaliacao.estrelas} de 5 · {formatarData(montagem.avaliacao.criadoEm)}
                </span>
              </div>
              {montagem.avaliacao.comentario ? (
                <p className="mt-2 text-sm text-gray-700">
                  &ldquo;{montagem.avaliacao.comentario}&rdquo;
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              {montagem.avaliacaoSolicitadaEm
                ? `Link de avaliação enviado ao cliente em ${formatarDataHora(
                    montagem.avaliacaoSolicitadaEm
                  )}. Aguardando resposta.`
                : "O montador ainda não pediu a avaliação deste serviço ao cliente."}
            </p>
          )}
        </Card>
      ) : null}

      {montagem.ocorrencias.length > 0 ? (
        <Card className="mb-6 border-amber-100">
          <p className="mb-3 text-sm font-medium text-slate-500">
            Histórico de ocorrências
          </p>
          <div className="space-y-3">
            {montagem.ocorrencias.map((o) => (
              <div key={o.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className={OCORRENCIA_COLOR[o.tipo]}>
                    {OCORRENCIA_LABEL[o.tipo]}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {formatarDataHora(o.criadoEm)}
                  </span>
                </div>
                {o.observacao ? (
                  <p className="mt-2 text-sm text-slate-700">{o.observacao}</p>
                ) : null}
                {o.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.fotoUrl}
                    alt="Foto da ocorrência"
                    className="mt-2 max-h-64 rounded-lg border border-slate-200 object-cover"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <NovaMontagemForm
          action={atualizarMontagemAction.bind(null, montagem.id)}
          lojas={lojas}
          montadores={montadores}
          comissoes={comissoes}
          modoEdicao
          valoresIniciais={{
            lojaId: montagem.lojaId,
            montadorId: montagem.feitoPorAdm ? "ADM" : (montagem.montadorId ?? ""),
            clienteNome: montagem.clienteNome,
            clienteTelefone: montagem.clienteTelefone ?? "",
            clienteEndereco: montagem.clienteEndereco,
            numeroPedido: montagem.numeroPedido ?? "",
            descricaoServico: montagem.descricaoServico,
            valorServico: String(montagem.valorServico),
            percentualAssistencia: String(montagem.percentualAssistencia),
            percentualMontador: String(montagem.percentualMontador),
            dataAgendada: paraInputDate(montagem.dataAgendada),
            observacoes: montagem.observacoes ?? "",
            status: montagem.status,
            manualUrl: montagem.manualUrl ?? undefined,
            manualNomeArquivo: montagem.manualNomeArquivo ?? undefined,
          }}
        />
      </Card>

      <Card className="mt-6 border-red-100">
        <p className="text-sm font-medium text-slate-500">Zona de risco</p>
        <p className="mt-1 text-sm text-slate-500">
          Excluir remove esta montagem e seus dados de pagamento
          permanentemente. Se for só desistir do serviço, prefira mudar o
          status para &quot;Cancelado&quot; acima em vez de excluir.
        </p>
        <FormConfirmar
          action={excluirMontagemAction.bind(null, montagem.id)}
          mensagem={`Excluir a montagem de "${montagem.clienteNome}"? Essa ação não pode ser desfeita.`}
          className="mt-3"
        >
          <Button type="submit" variante="perigo">
            Excluir montagem
          </Button>
        </FormConfirmar>
      </Card>
    </div>
  );
}
