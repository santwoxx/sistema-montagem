import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  atualizarMontagemAction,
  alternarPagamentoLojaAction,
  alternarPagamentoMontadorAction,
  excluirMontagemAction,
  confirmarEnvioCentralSyncAction,
  concluirComProvaAction,
} from "@/lib/actions/montagens";
import { pareceIdDoCentralSync } from "@/lib/centralsync";
import { linkMapa, linkWaze } from "@/lib/mapas";
import { CopiarTexto } from "@/components/CopiarTexto";
import { Alerta, Badge, Button, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { NovaMontagemForm } from "@/components/NovaMontagemForm";
import { FormConfirmar } from "@/components/FormConfirmar";
import { ComprovanteAdmin } from "@/components/ComprovanteAdmin";
import { Estrelas } from "@/components/Estrelas";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  linkTelefone,
  linkWhatsapp,
  OCORRENCIA_COLOR,
  OCORRENCIA_LABEL,
  paraInputDate,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/format";

// Teto de tempo das Server Actions desta página (a plataforma lê isto do
// build). O envio ao CentralSync espera uma Cloud Function que quase sempre
// parte fria e tenta duas vezes (ver avisarCentralSync): com o teto padrão
// de 10s da Vercel, a função era cortada no meio e o admin recebia um erro
// da plataforma, sem a mensagem explicando o que houve. 60s é o máximo
// aceito em qualquer plano, e só é usado se a chamada realmente demorar.
export const maxDuration = 60;

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

      <Card className="mb-6">
        <p className="text-sm font-medium text-gray-500">Endereço do cliente</p>
        <p className="mt-1 text-gray-900">{montagem.clienteEndereco}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={linkMapa(montagem.clienteEndereco)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            📍 Google Maps
          </a>
          <a
            href={linkWaze(montagem.clienteEndereco)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline"
          >
            🚗 Waze
          </a>
          <CopiarTexto texto={montagem.clienteEndereco} rotulo="Copiar endereço" />
          {montagem.clienteTelefone ? (
            <>
              <a
                href={linkTelefone(montagem.clienteTelefone)}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:underline"
              >
                📞 {montagem.clienteTelefone}
              </a>
              <a
                href={linkWhatsapp(montagem.clienteTelefone)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline"
              >
                💬 WhatsApp
              </a>
            </>
          ) : null}
          <Link
            href={`/admin/rota?data=${paraInputDate(montagem.dataAgendada)}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-navy hover:underline"
          >
            🗺️ Ver na rota do dia
          </Link>
        </div>
      </Card>

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

      <Card className="mb-6">
        <p className="mb-3 text-sm font-medium text-slate-500">
          Comprovante de conclusão
        </p>
        {montagem.fotosProdutoUrls.length > 0 ? (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            {montagem.fotosProdutoUrls.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Foto do produto montado ${i + 1}`}
                  className="max-h-96 w-full rounded-xl border border-slate-200 object-contain"
                />
              </a>
            ))}
          </div>
        ) : montagem.fotoProdutoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={montagem.fotoProdutoUrl}
            alt="Foto do produto montado"
            className="mb-4 max-h-96 w-full rounded-xl border border-slate-200 object-contain"
          />
        ) : (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Ainda não há foto do produto montado nesta montagem.
            {montagem.feitoPorAdm
              ? " Como o serviço foi feito pela própria empresa, é por aqui que a foto entra."
              : " Quem montou pode enviar pelo aplicativo, ou você mesmo anexa por aqui."}
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {montagem.assinaturaMontador ? (
            <div>
              <p className="mb-1 text-xs text-slate-500">Assinatura de quem montou</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={montagem.assinaturaMontador}
                alt="Assinatura de quem montou"
                className="w-full rounded-lg border border-slate-200 bg-white"
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">Sem a assinatura de quem montou.</p>
          )}
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
          ) : (
            <p className="text-xs text-slate-500">Sem a assinatura do cliente.</p>
          )}
        </div>
        <ComprovanteAdmin
          action={concluirComProvaAction.bind(null, montagem.id)}
          jaTemFoto={Boolean(montagem.fotoProdutoUrl)}
          concluida={montagem.status === "CONCLUIDO"}
        />
      </Card>

      {pareceIdDoCentralSync(montagem.numeroPedido) ? (
        <Card className="mb-6 border-blue-100">
          <p className="text-sm font-medium text-slate-500">Integração CentralSync</p>
          {montagem.notificadoCentralSyncEm ? (
            <>
              <p className="mt-2 text-sm text-emerald-700">
                ✔ Enviado ao CentralSync em{" "}
                {formatarDataHora(montagem.notificadoCentralSyncEm)}.
              </p>
              <p className="mt-1 mb-3 text-sm text-slate-500">
                A conclusão está esperando revisão na aba Entregas do CentralSync
                (caixa &ldquo;Montagens Feitas&rdquo;). Se lá não aparecer, reenvie.
              </p>
              <form action={confirmarEnvioCentralSyncAction.bind(null, montagem.id, "montagem")}>
                <SubmitButton pendingText="Reenviando…">Reenviar ao CentralSync</SubmitButton>
              </form>
            </>
          ) : montagem.status === "CONCLUIDO" ? (
            <>
              <p className="mt-1 mb-3 text-sm text-slate-500">
                Montagem concluída
                {montagem.feitoPorAdm
                  ? " pela própria empresa"
                  : montagem.montador
                    ? ` por ${montagem.montador.nome}`
                    : ""}
                . Confira a foto e as assinaturas acima — o CentralSync só recebe
                a conclusão quando você enviar daqui.
              </p>
              <form action={confirmarEnvioCentralSyncAction.bind(null, montagem.id, "montagem")} className="space-y-3">
                {(!montagem.fotoProdutoUrl || !montagem.assinaturaMontador || !montagem.assinaturaCliente) && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Falta comprovante (foto/assinaturas)? Informe o motivo para enviar assim mesmo:
                    </label>
                    <input
                      type="text"
                      name="motivoSemComprovante"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      placeholder="Ex: Serviço refeito pelo dono, peça danificada, etc."
                    />
                  </div>
                )}
                <SubmitButton pendingText="Enviando…">Enviar ao CentralSync</SubmitButton>
              </form>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Esse pedido veio do CentralSync. Quando quem for montar concluir
              (foto + assinaturas), a montagem aparece aqui e no painel geral com
              o botão para você conferir e enviar a conclusão para a loja.
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
            notaUrl: montagem.notaUrl ?? undefined,
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
