import Form from "next/form";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, Field, Input, PageHeader, Select, StatCard, Vazio } from "@/components/ui";
import { emCentavos, somarDinheiro, somarValorDevidoPelaLoja } from "@/lib/financeiro";
import { formatarData, formatarMoeda } from "@/lib/format";
import { intervaloDoMes, mesAtual } from "@/lib/datas";
import type { Prisma } from "@prisma/client";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    lojaId?: string;
    montadorId?: string;
    base?: string;
  }>;
}) {
  const params = await searchParams;
  const mes = params.mes ?? mesAtual();
  const lojaId = params.lojaId ?? "";
  const montadorId = params.montadorId ?? "";

  // Qual data define "o mês" de uma montagem. Esta tela sempre contou pela
  // data de cadastro e a do montador sempre contou pela data de conclusão --
  // então os dois olhavam "agosto" e viam números diferentes, sem nada na
  // tela explicando por quê. O padrão de cada tela continua o mesmo; o que
  // mudou é que agora dá para alinhar as duas e está escrito qual é a base.
  const base = params.base === "conclusao" ? "conclusao" : "cadastro";
  const campoData = base === "conclusao" ? "concluidoEm" : "createdAt";

  // Limites do mês no fuso do negócio (ver lib/datas.ts): com o servidor em
  // UTC, o mês começava e terminava três horas cedo demais.
  const { inicio, fim } = intervaloDoMes(mes);

  const [lojas, montadores] = await Promise.all([
    prisma.loja.findMany({ orderBy: { nome: "asc" } }),
    prisma.user.findMany({ where: { role: "MONTADOR" }, orderBy: { nome: "asc" } }),
  ]);

  const where: Prisma.MontagemWhereInput = {
    status: { not: "CANCELADO" },
    // Por conclusão, `concluidoEm` é nulo em tudo que não foi concluído --
    // o próprio filtro de intervalo já deixa essas montagens de fora.
    [campoData]: { gte: inicio, lt: fim },
  };
  if (lojaId) where.lojaId = lojaId;
  if (montadorId) where.montadorId = montadorId;

  const montagens = await prisma.montagem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    // Só o que a tabela e os totais usam -- sem isso as assinaturas em
    // base64 de todas as montagens do mês vinham junto.
    select: {
      id: true,
      clienteNome: true,
      createdAt: true,
      concluidoEm: true,
      valorServico: true,
      valorMontador: true,
      valorAssistencia: true,
      pagoPelaLoja: true,
      pagoAoMontador: true,
      loja: { select: { nome: true } },
      montador: { select: { nome: true } },
    },
  });

  // Receita da empresa != valor das notas: a empresa fica com o acerto
  // padrão sobre a nota mais a assistência da loja (ver lib/financeiro.ts),
  // enquanto a comissão do montador sai sobre o valor cheio da nota.
  const totalNotas = somarDinheiro(montagens.map((m) => m.valorServico));
  const receitaEmpresa = somarValorDevidoPelaLoja(montagens);
  const totalMontador = somarDinheiro(montagens.map((m) => m.valorMontador));
  const totalEmpresa = emCentavos(receitaEmpresa - totalMontador);
  const totalPendenteLoja = somarValorDevidoPelaLoja(
    montagens.filter((m) => !m.pagoPelaLoja)
  );
  const totalPendenteMontador = somarDinheiro(
    montagens.filter((m) => !m.pagoAoMontador).map((m) => m.valorMontador)
  );

  return (
    <div>
      <PageHeader
        titulo="Financeiro"
        descricao={
          base === "conclusao"
            ? "Resumo por período, loja e montador — contando pela data de conclusão."
            : "Resumo por período, loja e montador — contando pela data de cadastro."
        }
      />

      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Mês">
            <Input type="month" name="mes" defaultValue={mes} />
          </Field>
          <Field
            label="Contar pelo"
            hint="Use “conclusão” para bater com o financeiro dos montadores."
          >
            <Select name="base" defaultValue={base}>
              <option value="cadastro">Cadastro da montagem</option>
              <option value="conclusao">Conclusão do serviço</option>
            </Select>
          </Field>
          <Field label="Loja">
            <Select name="lojaId" defaultValue={lojaId}>
              <option value="">Todas</option>
              {lojas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Montador">
            <Select name="montadorId" defaultValue={montadorId}>
              <option value="">Todos</option>
              {montadores.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
        <StatCard
          titulo="Valor das notas"
          valor={formatarMoeda(totalNotas)}
          sub="Soma cheia dos serviços no período"
          icone="🧾"
        />
        <StatCard
          titulo="Receita da empresa"
          valor={formatarMoeda(receitaEmpresa)}
          sub="8% das notas + assistências"
          icone="🏢"
        />
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
                <th className="px-4 py-3">
                  {base === "conclusao" ? "Concluída em" : "Cadastrada em"}
                </th>
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
                  <td className="px-4 py-3 text-gray-500">
                    {formatarData(base === "conclusao" ? m.concluidoEm : m.createdAt)}
                  </td>
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
