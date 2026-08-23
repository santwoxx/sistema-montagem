import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMontador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  atualizarClienteMontadorAction,
  atualizarStatusAction,
  concluirComProvaAction,
  registrarOcorrenciaAction,
} from "@/lib/actions/montagens";
import { gerarLinkAvaliacaoAction } from "@/lib/actions/avaliacoes";
import { Alerta, Badge, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ConcluirMontagemForm } from "@/components/ConcluirMontagemForm";
import { RegistrarOcorrenciaForm } from "@/components/RegistrarOcorrenciaForm";
import { EditarEnderecoCliente } from "@/components/EditarEnderecoCliente";
import { EnviarAvaliacaoButton } from "@/components/EnviarAvaliacaoButton";
import { Estrelas } from "@/components/Estrelas";
import { CopiarTexto } from "@/components/CopiarTexto";
import { linkMapa, linkWaze } from "@/lib/mapas";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  linkTelefone,
  linkWhatsapp,
  OCORRENCIA_COLOR,
  OCORRENCIA_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/format";

export default async function MontagemDetalheMontadorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const session = await requireMontador();
  const { id } = await params;
  const { erro, sucesso } = await searchParams;

  const montagem = await prisma.montagem.findUnique({
    where: { id },
    include: { loja: true, avaliacao: true, ocorrencias: { orderBy: { criadoEm: "desc" } } },
  });

  if (!montagem) notFound();
  if (montagem.montadorId !== session.sub) redirect("/montador");

  const emAndamento = montagem.status === "EM_ANDAMENTO";
  // Montagem que já foi dada como concluída mas ficou sem a foto (o admin
  // marcou o status na mão, ou o envio falhou lá atrás) continua podendo
  // receber o comprovante — sem isso o montador perdia o formulário e a
  // loja nunca recebia a prova do serviço.
  const faltaComprovante = montagem.status === "CONCLUIDO" && !montagem.fotoProdutoUrl;

  return (
    <div>
      <p className="mb-2">
        <Link href="/montador" className="text-sm text-blue-600 hover:underline">
          ← Voltar
        </Link>
      </p>

      <PageHeader
        titulo={montagem.clienteNome}
        descricao={montagem.loja.nome}
        acoes={
          <Badge className={STATUS_COLOR[montagem.status]}>
            {STATUS_LABEL[montagem.status]}
          </Badge>
        }
      />

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {sucesso ? <Alerta tipo="sucesso">{sucesso}</Alerta> : null}

      <div className="space-y-4">
        <Card>
          <p className="text-sm font-medium text-gray-500">Endereço</p>
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
          </div>
          {montagem.status !== "CONCLUIDO" ? (
            <EditarEnderecoCliente
              action={atualizarClienteMontadorAction.bind(null, montagem.id)}
              enderecoAtual={montagem.clienteEndereco}
              telefoneAtual={montagem.clienteTelefone ?? ""}
            />
          ) : null}
        </Card>

        {montagem.clienteTelefone ? (
          <Card>
            <p className="text-sm font-medium text-gray-500">Contato do cliente</p>
            <p className="mt-1 text-gray-900">{montagem.clienteTelefone}</p>
            <div className="mt-3 flex gap-3">
              <a
                href={linkTelefone(montagem.clienteTelefone)}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              >
                📞 Ligar
              </a>
              <a
                href={linkWhatsapp(montagem.clienteTelefone)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline"
              >
                💬 WhatsApp
              </a>
            </div>
          </Card>
        ) : null}

        <Card>
          <p className="text-sm font-medium text-gray-500">Serviço</p>
          <p className="mt-1 text-gray-900">{montagem.descricaoServico}</p>
          {montagem.numeroPedido ? (
            <p className="mt-2 text-xs text-gray-400">Pedido nº {montagem.numeroPedido}</p>
          ) : null}
          {montagem.dataAgendada ? (
            <p className="mt-1 text-xs text-gray-400">
              Agendado para {formatarData(montagem.dataAgendada)}
            </p>
          ) : null}
          {montagem.observacoes ? (
            <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              {montagem.observacoes}
            </p>
          ) : null}
        </Card>

        {montagem.manualUrl ? (
          <Card>
            <p className="text-sm font-medium text-gray-500">Manual / instrução</p>
            {montagem.manualTipo?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={montagem.manualUrl}
                alt="Manual/instrução da montagem"
                className="mt-2 max-h-80 w-full rounded-lg border border-gray-200 object-contain"
              />
            ) : null}
            <a
              href={montagem.manualUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              📄{" "}
              {montagem.manualTipo?.startsWith("image/")
                ? "Abrir em tamanho real"
                : `Abrir ${montagem.manualNomeArquivo || "arquivo"}`}
            </a>
          </Card>
        ) : null}

        <Card>
          <p className="text-sm font-medium text-gray-500">Sua comissão</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatarMoeda(montagem.valorMontador)}
          </p>
          <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-sm">
            <div className="flex items-center justify-between text-gray-600">
              <span>Valor do produto/serviço</span>
              <span className="font-medium text-gray-900">
                {formatarMoeda(montagem.valorServico)}
              </span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Sua comissão ({montagem.percentualMontador}%)</span>
              <span className="font-medium text-gray-900">
                {formatarMoeda(montagem.valorMontador)}
              </span>
            </div>
          </div>
          {montagem.status === "CONCLUIDO" ? (
            <Badge
              className={
                (montagem.pagoAoMontador
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800") + " mt-3"
              }
            >
              {montagem.pagoAoMontador ? "Comissão paga" : "Comissão pendente"}
            </Badge>
          ) : null}
        </Card>

        {montagem.status === "PENDENTE" ? (
          <form action={atualizarStatusAction.bind(null, montagem.id, "EM_ANDAMENTO")}>
            <SubmitButton className="w-full" variante="primario" pendingText="Iniciando…">
              Iniciar montagem
            </SubmitButton>
          </form>
        ) : null}

        {emAndamento || faltaComprovante ? (
          <Card>
            <p className="mb-1 text-base font-semibold text-slate-900">
              {faltaComprovante ? "Falta o comprovante" : "Concluir montagem"}
            </p>
            <p className="mb-4 text-sm text-slate-500">
              {faltaComprovante
                ? "Esta montagem está marcada como concluída, mas sem a foto do produto montado — a loja precisa dela para conferir o serviço."
                : "Tire uma foto do produto montado e colete as assinaturas suas e do cliente para finalizar."}
            </p>
            <ConcluirMontagemForm
              action={concluirComProvaAction.bind(null, montagem.id)}
              exigirAssinaturas={
                emAndamento ||
                !montagem.assinaturaMontador ||
                !montagem.assinaturaCliente
              }
              jaTemFoto={Boolean(montagem.fotoProdutoUrl)}
              rotuloBotao={faltaComprovante ? "Enviar comprovante" : "Concluir montagem"}
            />
            {emAndamento ? (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <RegistrarOcorrenciaForm
                  action={registrarOcorrenciaAction.bind(null, montagem.id)}
                />
              </div>
            ) : null}
          </Card>
        ) : null}

        {montagem.ocorrencias.length > 0 ? (
          <Card>
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
                      className="mt-2 max-h-48 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {montagem.status === "CONCLUIDO" ? (
          <>
            <p className="text-center text-sm text-gray-500">
              Montagem concluída em {formatarData(montagem.concluidoEm)}.
            </p>
            {montagem.fotoProdutoUrl || montagem.assinaturaMontador || montagem.assinaturaCliente ? (
              <Card>
                <p className="mb-3 text-sm font-medium text-slate-500">Comprovante</p>
                {montagem.fotoProdutoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={montagem.fotoProdutoUrl}
                    alt="Foto do produto montado"
                    className="mb-4 w-full rounded-xl border border-slate-200 object-cover"
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

            <Card>
              <p className="mb-1 text-base font-semibold text-slate-900">
                Avaliação do cliente
              </p>
              {montagem.avaliacao ? (
                <div>
                  <div className="mt-2 flex items-center gap-2">
                    <Estrelas valor={montagem.avaliacao.estrelas} tamanho="text-2xl" />
                    <span className="text-sm text-slate-500">
                      {montagem.avaliacao.estrelas} de 5
                    </span>
                  </div>
                  {montagem.avaliacao.comentario ? (
                    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      &ldquo;{montagem.avaliacao.comentario}&rdquo;
                    </p>
                  ) : null}
                </div>
              ) : montagem.clienteTelefone ? (
                <>
                  <p className="mb-4 text-sm text-slate-500">
                    Peça para o cliente avaliar seu atendimento: envie o link
                    de avaliação por WhatsApp em um clique.
                  </p>
                  <EnviarAvaliacaoButton
                    action={gerarLinkAvaliacaoAction.bind(null, montagem.id)}
                    jaSolicitadoEm={
                      montagem.avaliacaoSolicitadaEm
                        ? formatarDataHora(montagem.avaliacaoSolicitadaEm)
                        : null
                    }
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Cadastre o telefone do cliente para poder enviar o link de
                  avaliação.
                </p>
              )}
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
