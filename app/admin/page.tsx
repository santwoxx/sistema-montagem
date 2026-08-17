import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatarData, formatarMoeda, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import { Badge, Card, LinkButton, PageHeader, StatCard, Vazio } from "@/components/ui";

export default async function AdminDashboardPage() {
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
    aguardandoConfirmacaoCentralSync,
  ] = await Promise.all([
    prisma.montagem.count({ where: { status: "PENDENTE" } }),
    prisma.montagem.count({ where: { status: "EM_ANDAMENTO" } }),
    prisma.montagem.count({
      where: { montadorId: null, status: { not: "CANCELADO" } },
    }),
    prisma.montagem.aggregate({
      _sum: { valorServico: true },
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
    prisma.montagem.findMany({
      where: {
        status: "CONCLUIDO",
        numeroPedido: { startsWith: "del-" },
        notificadoCentralSyncEm: null,
      },
      select: { id: true, clienteNome: true, montador: { select: { nome: true } } },
      take: 5,
    }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Painel geral"
        descricao="Visão rápida das montagens e das finanças da sua empresa."
        acoes={
          <LinkButton href="/admin/montagens/nova">+ Nova montagem</LinkButton>
        }
      />

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

      {aguardandoConfirmacaoCentralSync.length > 0 ? (
        <Card className="mb-6 border-blue-100 bg-blue-50/40">
          <p className="font-semibold text-slate-900">
            📤 {aguardandoConfirmacaoCentralSync.length} montagem
            {aguardandoConfirmacaoCentralSync.length > 1 ? "ns" : ""} concluída
            {aguardandoConfirmacaoCentralSync.length > 1 ? "s" : ""} esperando confirmação para o CentralSync
          </p>
          <div className="mt-2 space-y-1">
            {aguardandoConfirmacaoCentralSync.map((m) => (
              <Link
                key={m.id}
                href={`/admin/montagens/${m.id}`}
                className="block text-sm text-blue-700 hover:underline"
              >
                {m.clienteNome}
                {m.montador ? ` — concluída por ${m.montador.nome}` : ""}
              </Link>
            ))}
          </div>
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
          valor={formatarMoeda(((faturamentoMesAgg._sum.valorServico || 0) * 0.08) + (faturamentoMesAgg._sum.valorAssistencia || 0))}
          sub="8% sobre o faturamento do mês + Assistências"
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
