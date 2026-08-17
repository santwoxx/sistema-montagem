import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Select, StatCard, Vazio } from "@/components/ui";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { Prisma } from "@prisma/client";

function mesAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; lojaId?: string; montadorId?: string }>;
}) {
  const params = await searchParams;
  const mes = params.mes ?? mesAtual();
  const lojaId = params.lojaId ?? "";
  const montadorId = params.montadorId ?? "";

  const [ano, mesNumero] = mes.split("-").map(Number);
  const inicio = new Date(ano, (mesNumero || 1) - 1, 1);
  const fim = new Date(ano, mesNumero || 1, 1);

  const [lojas, montadores] = await Promise.all([
    prisma.loja.findMany({ orderBy: { nome: "asc" } }),
    prisma.user.findMany({ where: { role: "MONTADOR" }, orderBy: { nome: "asc" } }),
  ]);

  const where: Prisma.MontagemWhereInput = {
    status: { not: "CANCELADO" },
    createdAt: { gte: inicio, lt: fim },
  };
  if (lojaId) where.lojaId = lojaId;
  if (montadorId) where.montadorId = montadorId;

  const montagens = await prisma.montagem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { loja: true, montador: true },
  });

  const totalServico = montagens.reduce((soma, m) => soma + (m.valorServico * 0.08) + (m.valorAssistencia || 0), 0);
  const totalMontador = montagens.reduce((soma, m) => soma + m.valorMontador, 0);
  const totalEmpresa = totalServico - totalMontador;
  const totalPendenteLoja = montagens
    .filter((m) => !m.pagoPelaLoja)
    .reduce((soma, m) => soma + (m.valorServico * 0.08) + (m.valorAssistencia || 0), 0);
  const totalPendenteMontador = montagens
    .filter((m) => !m.pagoAoMontador)
    .reduce((soma, m) => soma + m.valorMontador, 0);

  return (
    <div>
      <PageHeader
        titulo="Financeiro"
        descricao="Resumo de valores por período, loja e montador."
      />

      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Mês</label>
            <input
              type="month"
              name="mes"
              defaultValue={mes}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Loja</label>
            <Select name="lojaId" defaultValue={lojaId}>
              <option value="">Todas</option>
              {lojas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Montador
            </label>
            <Select name="montadorId" defaultValue={montadorId}>
              <option value="">Todos</option>
              {montadores.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Filtrar
            </button>
          </div>
        </form>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
        <StatCard titulo="Faturamento (serviços)" valor={formatarMoeda(totalServico)} icone="🧾" />
        <StatCard
          titulo="Comissões dos montadores"
          valor={formatarMoeda(totalMontador)}
          cor="text-blue-600"
          icone="👷"
        />
        <StatCard
          titulo="Lucro da empresa"
          valor={formatarMoeda(totalEmpresa)}
          cor="text-emerald-600"
          icone="📈"
        />
        <StatCard
          titulo="A receber das lojas"
          valor={formatarMoeda(totalPendenteLoja)}
          cor="text-amber-600"
          icone="🏬"
        />
        <StatCard
          titulo="A pagar aos montadores"
          valor={formatarMoeda(totalPendenteMontador)}
          cor="text-amber-600"
          icone="⏳"
        />
        <StatCard titulo="Montagens no período" valor={String(montagens.length)} icone="📋" />
      </div>

      {montagens.length === 0 ? (
        <Vazio>Nenhuma montagem encontrada nesse período.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-blue-100/80 bg-white shadow-sm shadow-blue-900/3">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3">Montador</th>
                <th className="px-4 py-3 text-right">Valor total</th>
                <th className="px-4 py-3 text-right">Comissão</th>
                <th className="px-4 py-3">Loja pagou?</th>
                <th className="px-4 py-3">Montador recebeu?</th>
              </tr>
            </thead>
            <tbody>
              {montagens.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{formatarData(m.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link href={`/admin/montagens/${m.id}`} className="hover:underline">
                      {m.clienteNome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.loja.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{m.montador?.nome ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatarMoeda(m.valorServico)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatarMoeda(m.valorMontador)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        m.pagoPelaLoja
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {m.pagoPelaLoja ? "Pago" : "Pendente"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        m.pagoAoMontador
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {m.pagoAoMontador ? "Pago" : "Pendente"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
