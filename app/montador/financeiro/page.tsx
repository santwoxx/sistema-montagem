import Form from "next/form";
import { requireMontador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, Field, Input, PageHeader, Select, StatCard, Vazio } from "@/components/ui";
import { formatarData, formatarMoeda } from "@/lib/format";
import { intervaloDoMes, mesAtual } from "@/lib/datas";
import type { Prisma } from "@prisma/client";

export default async function FinanceiroMontadorPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; lojaId?: string; base?: string }>;
}) {
  const session = await requireMontador();
  const { mes: mesParam, lojaId, base: baseParam } = await searchParams;
  const mes = mesParam ?? mesAtual();

  // Mesma escolha que existe no financeiro do admin, para os dois poderem
  // olhar exatamente o mesmo recorte. O padrão aqui continua sendo a data
  // de conclusão, que é quando o montador de fato ganhou o serviço.
  const base = baseParam === "cadastro" ? "cadastro" : "conclusao";
  const campoData = base === "cadastro" ? "createdAt" : "concluidoEm";
  const { inicio, fim } = intervaloDoMes(mes);

  const concluidasBase: Prisma.MontagemWhereInput = {
    montadorId: session.sub,
    status: "CONCLUIDO",
    ...(lojaId ? { lojaId } : {}),
  };

  const [
    lojas,
    pendenteAgg,
    recebidoAgg,
    periodoAgg,
    periodoCount,
    pendentePorLojaBruto,
    historico,
  ] = await Promise.all([
    prisma.loja.findMany({ orderBy: { nome: "asc" } }),
    prisma.montagem.aggregate({
      _sum: { valorMontador: true },
      where: { ...concluidasBase, pagoAoMontador: false },
    }),
    prisma.montagem.aggregate({
      _sum: { valorMontador: true },
      where: { ...concluidasBase, pagoAoMontador: true },
    }),
    prisma.montagem.aggregate({
      _sum: { valorMontador: true },
      where: { ...concluidasBase, [campoData]: { gte: inicio, lt: fim } },
    }),
    prisma.montagem.count({
      where: { ...concluidasBase, [campoData]: { gte: inicio, lt: fim } },
    }),
    lojaId
      ? Promise.resolve([])
      : prisma.montagem.groupBy({
          by: ["lojaId"],
          where: { montadorId: session.sub, status: "CONCLUIDO", pagoAoMontador: false },
          _sum: { valorMontador: true },
        }),
    prisma.montagem.findMany({
      where: { ...concluidasBase, [campoData]: { gte: inicio, lt: fim } },
      orderBy: { concluidoEm: "desc" },
      select: {
        id: true,
        clienteNome: true,
        concluidoEm: true,
        valorServico: true,
        valorMontador: true,
        percentualMontador: true,
        pagoAoMontador: true,
        loja: { select: { nome: true } },
      },
    }),
  ]);

  const nomeLoja = new Map(lojas.map((l) => [l.id, l.nome]));
  const pendentePorLoja = pendentePorLojaBruto
    .map((item) => ({
      lojaId: item.lojaId,
      nome: nomeLoja.get(item.lojaId) ?? "Loja",
      valor: item._sum.valorMontador ?? 0,
    }))
    .filter((item) => item.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  return (
    <div>
      <PageHeader titulo="Financeiro" descricao="Seus ganhos com as montagens concluídas." />

      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Mês">
            <Input type="month" name="mes" defaultValue={mes} />
          </Field>
          <Field label="Contar pelo">
            <Select name="base" defaultValue={base}>
              <option value="conclusao">Conclusão do serviço</option>
              <option value="cadastro">Cadastro da montagem</option>
            </Select>
          </Field>
          <Field label="Loja">
            <Select name="lojaId" defaultValue={lojaId ?? ""}>
              <option value="">Todas</option>
              {lojas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-medium text-white hover:bg-navy-light"
            >
              Filtrar
            </button>
          </div>
        </form>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Situação atual{lojaId ? ` · ${nomeLoja.get(lojaId) ?? ""}` : ""}
      </h2>
      <div className="mb-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        <StatCard
          titulo="Pendente de receber"
          valor={formatarMoeda(pendenteAgg._sum.valorMontador)}
          sub="Concluídas, aguardando pagamento"
          cor="text-amber-600"
          icone="⏳"
        />
        <StatCard
          titulo="Já recebido"
          valor={formatarMoeda(recebidoAgg._sum.valorMontador)}
          sub="Total pago até hoje"
          cor="text-emerald-600"
          icone="✅"
        />
      </div>

      {pendentePorLoja.length > 0 ? (
        <Card className="mb-8">
          <p className="mb-3 text-sm font-medium text-gray-500">Quem te deve</p>
          <div className="space-y-2">
            {pendentePorLoja.map((item) => (
              <div key={item.lojaId} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{item.nome}</span>
                <span className="font-semibold text-amber-600">{formatarMoeda(item.valor)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        No mês selecionado ({base === "cadastro" ? "por cadastro" : "por conclusão"})
      </h2>
      <div className="mb-8 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        <StatCard
          titulo="Ganho no período"
          valor={formatarMoeda(periodoAgg._sum.valorMontador)}
          icone="📈"
        />
        <StatCard titulo="Montagens concluídas" valor={String(periodoCount)} icone="📋" />
      </div>

      <h2 className="mb-3 text-base font-semibold text-gray-900">
        Histórico do período
      </h2>

      {historico.length === 0 ? (
        <Vazio>Nenhuma montagem concluída nesse período.</Vazio>
      ) : (
        <div className="space-y-3">
          {historico.map((m) => (
            <Card key={m.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{m.clienteNome}</p>
                  <p className="text-sm text-gray-500">{m.loja.nome}</p>
                  <p className="text-xs text-gray-400">
                    Concluída em {formatarData(m.concluidoEm)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatarMoeda(m.valorMontador)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {m.percentualMontador}% de {formatarMoeda(m.valorServico)}
                  </p>
                  <Badge
                    className={
                      m.pagoAoMontador
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    {m.pagoAoMontador ? "Pago" : "Pendente"}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
