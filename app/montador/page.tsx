import Link from "next/link";
import { requireMontador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, StatCard, Vazio } from "@/components/ui";
import { AcoesCliente } from "@/components/AcoesCliente";
import { Estrelas } from "@/components/Estrelas";
import { formatarData, formatarMoeda, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import { inicioDoMesLocal } from "@/lib/datas";

export default async function PainelMontadorPage() {
  const session = await requireMontador();

  const inicioMes = inicioDoMesLocal();

  const [
    ativas,
    concluidasRecentes,
    valorPendenteAgg,
    aReceberAgg,
    faturamentoMesAgg,
    avaliacaoAgg,
    avaliacoesRecentes,
  ] = await Promise.all([
    prisma.montagem.findMany({
      where: { montadorId: session.sub, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      orderBy: [{ dataAgendada: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        clienteNome: true,
        // Endereço e telefone na própria lista: é esta a tela que o
        // montador abre na rua, e sair daqui só para ver para onde ir era
        // um toque a mais em cada montagem do dia.
        clienteEndereco: true,
        clienteTelefone: true,
        dataAgendada: true,
        valorServico: true,
        valorMontador: true,
        status: true,
        loja: { select: { nome: true } },
      },
    }),
    prisma.montagem.findMany({
      where: { montadorId: session.sub, status: "CONCLUIDO" },
      orderBy: { concluidoEm: "desc" },
      take: 5,
      select: {
        id: true,
        clienteNome: true,
        concluidoEm: true,
        valorServico: true,
        valorMontador: true,
        pagoAoMontador: true,
        loja: { select: { nome: true } },
      },
    }),
    prisma.montagem.aggregate({
      _sum: { valorMontador: true },
      where: { montadorId: session.sub, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
    }),
    prisma.montagem.aggregate({
      _sum: { valorMontador: true },
      where: { montadorId: session.sub, createdAt: { gte: inicioMes }, status: { not: "CANCELADO" } },
    }),
    // Espelha o "Faturamento do mês" do painel do admin: valor BRUTO
    // (valorServico) das montagens designadas ao montador no mês, não o
    // ganho dele (isso é o card "A receber", que aplica a % da comissão).
    prisma.montagem.aggregate({
      _sum: { valorServico: true },
      where: { montadorId: session.sub, createdAt: { gte: inicioMes }, status: { not: "CANCELADO" } },
    }),
    prisma.avaliacao.aggregate({
      _avg: { estrelas: true },
      _count: { _all: true },
      where: { montadorId: session.sub },
    }),
    prisma.avaliacao.findMany({
      where: { montadorId: session.sub },
      orderBy: { criadoEm: "desc" },
      take: 3,
      include: { montagem: { select: { clienteNome: true } } },
    }),
  ]);

  const mediaAvaliacao = avaliacaoAgg._avg.estrelas ?? 0;
  const totalAvaliacoes = avaliacaoAgg._count._all;

  return (
    <div>
      <PageHeader titulo={`Olá, ${session.nome.split(" ")[0]}`} descricao="Suas montagens designadas." />

      <div className="mb-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Montagens pendentes" valor={String(ativas.length)} cor="text-amber-600" icone="⏳" />
        <StatCard
          titulo="Valor pendente"
          valor={formatarMoeda(valorPendenteAgg._sum.valorMontador)}
          sub="Montagens ainda não concluídas"
          cor="text-amber-600"
          icone="🧾"
        />
        <StatCard
          titulo="A receber"
          valor={formatarMoeda(aReceberAgg._sum.valorMontador)}
          sub="Sua parte sobre as montagens do mês"
          cor="text-emerald-600"
          icone="💰"
        />
        <StatCard
          titulo="Faturamento do mês"
          valor={formatarMoeda(faturamentoMesAgg._sum.valorServico)}
          sub="Valor total das montagens do mês"
          cor="text-blue-600"
          icone="📈"
        />
      </div>

      <Card className="mb-8">
        <p className="text-sm font-medium text-gray-500">Sua avaliação</p>
        {totalAvaliacoes === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Você ainda não recebeu avaliações de clientes.
          </p>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-2">
              <Estrelas valor={mediaAvaliacao} tamanho="text-2xl" />
              <span className="text-xl font-bold text-gray-900">
                {mediaAvaliacao.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">
                ({totalAvaliacoes} avaliação{totalAvaliacoes > 1 ? "ões" : ""})
              </span>
            </div>
            {avaliacoesRecentes.some((a) => a.comentario) ? (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                {avaliacoesRecentes
                  .filter((a) => a.comentario)
                  .map((a) => (
                    <p key={a.id} className="text-sm text-slate-600">
                      &ldquo;{a.comentario}&rdquo;{" "}
                      <span className="text-xs text-slate-400">
                        — {a.montagem.clienteNome}
                      </span>
                    </p>
                  ))}
              </div>
            ) : null}
          </>
        )}
      </Card>

      <h2 className="mb-3 text-base font-semibold text-gray-900">Para fazer</h2>
      {ativas.length === 0 ? (
        <Vazio>Nenhuma montagem pendente no momento. 🎉</Vazio>
      ) : (
        <div className="space-y-3">
          {/* Cartão sem link em volta: agora ele tem links próprios (Waze,
              ligar, WhatsApp), e âncora dentro de âncora não é HTML válido
              -- o toque acabava abrindo a montagem em vez de navegar. */}
          {ativas.map((m) => (
            <Card key={m.id} className="transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/montador/montagens/${m.id}`}
                    className="font-semibold text-gray-900 hover:underline"
                  >
                    {m.clienteNome}
                  </Link>
                  <p className="text-sm text-gray-500">{m.loja.nome}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {m.dataAgendada ? formatarData(m.dataAgendada) : "Sem data definida"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Nota: {formatarMoeda(m.valorServico)} · Você recebe:{" "}
                    <span className="font-medium text-emerald-600">
                      {formatarMoeda(m.valorMontador)}
                    </span>
                  </p>
                </div>
                <Badge className={STATUS_COLOR[m.status]}>{STATUS_LABEL[m.status]}</Badge>
              </div>

              <p className="mt-2 text-sm text-slate-900">{m.clienteEndereco}</p>

              <AcoesCliente
                endereco={m.clienteEndereco}
                telefone={m.clienteTelefone}
                className="mt-3"
              >
                <Link
                  href={`/montador/montagens/${m.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-navy hover:underline"
                >
                  🔧 Abrir montagem
                </Link>
              </AcoesCliente>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-base font-semibold text-gray-900">
        Concluídas recentemente
      </h2>
      {concluidasRecentes.length === 0 ? (
        <Vazio>Você ainda não concluiu nenhuma montagem.</Vazio>
      ) : (
        <div className="space-y-3">
          {concluidasRecentes.map((m) => (
            <Link key={m.id} href={`/montador/montagens/${m.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{m.clienteNome}</p>
                    <p className="text-sm text-gray-500">{m.loja.nome}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Concluída em {formatarData(m.concluidoEm)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Nota: {formatarMoeda(m.valorServico)} · Você recebe:{" "}
                      <span className="font-medium text-emerald-600">
                        {formatarMoeda(m.valorMontador)}
                      </span>
                    </p>
                  </div>
                  <Badge
                    className={
                      m.pagoAoMontador
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    {m.pagoAoMontador ? "Pago" : "A receber"}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
