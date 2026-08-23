import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { confirmarEnvioCentralSyncAction } from "@/lib/actions/montagens";
import { PREFIXO_PEDIDO_CENTRALSYNC } from "@/lib/centralsync";
import { valorDevidoPelaLoja } from "@/lib/financeiro";
import { formatarData, formatarDataHora, formatarMoeda, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import { Alerta, Badge, Card, LinkButton, PageHeader, StatCard, Vazio } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

// Quantas montagens da fila do CentralSync a tela lista de uma vez.
const LIMITE_FILA = 10;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { erro, sucesso } = await searchParams;

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [
    pendentes,
    emAndamento,
    naoAtribuidas,
    aReceberAgg,
    aPagarAgg,
    faturamentoMesAgg,
    concluidasMes,
    montadoresAtivos,
    proximas,
    notasPendentesCount,
    filaCentralSync,
  ] = await Promise.all([
    prisma.montagem.count({ where: { status: "PENDENTE" } }),
    prisma.montagem.count({ where: { status: "EM_ANDAMENTO" } }),
    prisma.montagem.count({
      where: { montadorId: null, status: { not: "CANCELADO" } },
    }),
    prisma.montagem.aggregate({
      _sum: { valorServico: true, valorAssistencia: true },
      where: { pagoPelaLoja: false, status: { not: "CANCELADO" } },
    }),
    prisma.montagem.aggregate({
      _sum: { valorMontador: true },
      where: { pagoAoMontador: false, status: "CONCLUIDO" },
    }),
    prisma.montagem.aggregate({
      _sum: { valorServico: true, valorAssistencia: true },
      where: { createdAt: { gte: inicioMes }, status: { not: "CANCELADO" } },
    }),
    prisma.montagem.count({
      where: { status: "CONCLUIDO", concluidoEm: { gte: inicioMes } },
    }),
    prisma.user.count({ where: { role: "MONTADOR", ativo: true } }),
    prisma.montagem.findMany({
      where: {
        status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
      },
      orderBy: [{ dataAgendada: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: { loja: true, montador: true },
    }),
    prisma.notaPendente.count(),
    // Fila de montagens do CentralSync já concluídas aqui e ainda não
    // enviadas para a loja. As assinaturas ficam de fora do select de
    // propósito: são imagens em base64 (campos Text grandes) e aqui só
    // precisamos saber se o comprovante existe — a foto já responde isso,
    // porque a conclusão pelo app do montador grava as três coisas juntas.
    prisma.montagem.findMany({
      where: {
        status: "CONCLUIDO",
        numeroPedido: { startsWith: PREFIXO_PEDIDO_CENTRALSYNC },
        notificadoCentralSyncEm: null,
      },
      orderBy: { concluidoEm: "asc" },
      // 11 para saber que passou de 10 sem gastar um count() a mais.
      take: LIMITE_FILA + 1,
      select: {
        id: true,
        clienteNome: true,
        numeroPedido: true,
        concluidoEm: true,
        fotoProdutoUrl: true,
        feitoPorAdm: true,
        montador: { select: { nome: true } },
      },
    }),
  ]);

  const filaVisivel = filaCentralSync.slice(0, LIMITE_FILA);
  const temMaisNaFila = filaCentralSync.length > LIMITE_FILA;

  const aReceberDasLojas = valorDevidoPelaLoja({
    valorServico: aReceberAgg._sum.valorServico || 0,
    valorAssistencia: aReceberAgg._sum.valorAssistencia || 0,
  });

  return (
    <div>
      <PageHeader
        titulo="Painel geral"
        descricao="Visão rápida das montagens e das finanças da sua empresa."
        acoes={
          <>
            <LinkButton href="/admin/rota" variante="secundario">
              🗺️ Rota do dia
            </LinkButton>
            <LinkButton href="/admin/montagens/nova">+ Nova montagem</LinkButton>
          </>
        }
      />

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {sucesso ? <Alerta tipo="sucesso">{sucesso}</Alerta> : null}

      {notasPendentesCount > 0 ? (
        <Link href="/admin/montagens/nova" className="mb-6 block">
          <Card className="border-gold/40 bg-gold/5 transition-shadow hover:shadow-md">
            <p className="font-semibold text-slate-900">
              📥 {notasPendentesCount} pedido{notasPendentesCount > 1 ? "s" : ""} pendente
              {notasPendentesCount > 1 ? "s" : ""} do CentralSync
            </p>
            <p className="text-sm text-slate-500">
              Aguardando revisão para virar montagem. Toque para abrir.
            </p>
          </Card>
        </Link>
      ) : null}

      {filaVisivel.length > 0 ? (
        <Card className="mb-6 border-blue-200 bg-blue-50/40">
          <p className="font-semibold text-slate-900">
            📤 {temMaisNaFila ? `Mais de ${LIMITE_FILA}` : filaVisivel.length} montagem
            {filaVisivel.length > 1 ? "ns" : ""} pronta
            {filaVisivel.length > 1 ? "s" : ""} para enviar ao CentralSync
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Quem montou já concluiu aqui. Confira o comprovante e envie para a
            loja — só depois disso a montagem aparece lá para eles darem baixa.
          </p>

          <div className="mt-4 space-y-3">
            {filaVisivel.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {m.fotoProdutoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob externo (Vercel Blob), sem next/image configurado para esse domínio
                    <img
                      src={m.fotoProdutoUrl}
                      alt="Foto do produto montado"
                      className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-amber-300 bg-amber-50 text-lg">
                      ⚠️
                    </span>
                  )}
                  <div className="min-w-0">
                    <Link
                      href={`/admin/montagens/${m.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {m.clienteNome}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {m.feitoPorAdm
                        ? "Montado pela própria empresa"
                        : m.montador
                          ? `Montado por ${m.montador.nome}`
                          : "Sem montador designado"}
                      {m.concluidoEm ? ` · ${formatarDataHora(m.concluidoEm)}` : ""}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      Entrega {m.numeroPedido}
                    </p>
                    {m.fotoProdutoUrl ? null : (
                      <p className="text-xs font-medium text-amber-700">
                        Sem foto do produto montado — abra a montagem para
                        anexar antes de enviar.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {m.fotoProdutoUrl ? (
                    <form action={confirmarEnvioCentralSyncAction.bind(null, m.id, "painel")}>
                      <SubmitButton className="px-3 py-2 text-sm" pendingText="Enviando…">
                        Enviar ao CentralSync
                      </SubmitButton>
                    </form>
                  ) : (
                    <LinkButton
                      href={`/admin/montagens/${m.id}`}
                      variante="secundario"
                      className="px-3 py-2 text-sm"
                    >
                      Abrir montagem
                    </LinkButton>
                  )}
                </div>
              </div>
            ))}
          </div>

          {temMaisNaFila ? (
            <p className="mt-3 text-sm text-slate-500">
              Há mais montagens esperando envio. Envie estas e recarregue a
              página para ver as próximas.
            </p>
          ) : null}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
        <StatCard titulo="Pendentes" valor={String(pendentes)} cor="text-amber-600" icone="⏳" />
        <StatCard titulo="Em andamento" valor={String(emAndamento)} cor="text-blue-600" icone="🔧" />
        <StatCard
          titulo="Sem montador"
          valor={String(naoAtribuidas)}
          cor="text-red-600"
          icone="❓"
        />
        <StatCard
          titulo="A receber das lojas"
          valor={formatarMoeda(aReceberDasLojas)}
          sub="Montagens que a loja ainda não pagou (8% + assistência)"
          icone="🏬"
        />
        <StatCard
          titulo="A pagar aos montadores"
          valor={formatarMoeda(aPagarAgg._sum.valorMontador)}
          icone="👷"
        />
        <StatCard
          titulo="Faturamento do mês"
          valor={formatarMoeda(faturamentoMesAgg._sum.valorServico)}
          sub={`${concluidasMes} concluída(s) no mês · ${montadoresAtivos} montador(es) ativo(s)`}
          cor="text-emerald-600"
          icone="📈"
        />
      </div>

      <div className="mt-8">
        <PageHeader titulo="Próximas montagens" />
        {proximas.length === 0 ? (
          <Vazio>Nenhuma montagem pendente ou em andamento no momento.</Vazio>
        ) : (
          <div className="space-y-3">
            {proximas.map((m) => (
              <Link key={m.id} href={`/admin/montagens/${m.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{m.clienteNome}</p>
                      <p className="text-sm text-gray-500">
                        {m.loja.nome} · {m.montador ? m.montador.nome : "Sem montador"}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {m.dataAgendada ? `Agendado para ${formatarData(m.dataAgendada)}` : "Sem data definida"}
                      </p>
                    </div>
                    <Badge className={STATUS_COLOR[m.status]}>
                      {STATUS_LABEL[m.status]}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
