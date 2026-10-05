import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge, Card, LinkButton, PageHeader, StatCard, Vazio } from "@/components/ui";
import { buscarLinhasDoRelatorio } from "@/lib/consultar-relatorio";
import { somarReceitaDaEmpresa } from "@/lib/financeiro";
import {
  formatarCnpj,
  formatarData,
  formatarMoeda,
  formatarTelefone,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/format";
import { filtrosParaUrl, lerFiltrosRelatorio, resumoPorTipo, responsavel, totalizar } from "@/lib/relatorio";
import { TIPO_SERVICO_COLOR, TIPO_SERVICO_LABEL, TIPO_SERVICO_PLURAL } from "@/lib/tipo-servico";

// A pasta da loja: quem ela é, como os serviços dela chegam, o que ela deve,
// o que está em aberto e o que já foi feito -- com o relatório e a lista
// completa a um clique. Antes a loja era só um cadastro em Lojas, e ver "o
// que fizemos para a Simonetti" exigia montar os filtros à mão em três
// telas diferentes.

const SELECAO_MONTAGEM = {
  id: true,
  clienteNome: true,
  descricaoServico: true,
  numeroPedido: true,
  tipoServico: true,
  status: true,
  dataAgendada: true,
  concluidoEm: true,
  valorServico: true,
  pagoPelaLoja: true,
  fotoProdutoUrl: true,
  feitoPorAdm: true,
  montador: { select: { nome: true } },
} as const;

export default async function PastaDaLojaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // O mês corrente, como o relatório abre por padrão.
  const filtrosDoMes = lerFiltrosRelatorio({ lojaId: id });

  const [loja, totalMontagens, aReceber, emAberto, concluidas, { linhas: doMes }] =
    await Promise.all([
      prisma.loja.findUnique({ where: { id } }),
      prisma.montagem.count({ where: { lojaId: id } }),
      prisma.montagem.findMany({
        where: { lojaId: id, pagoPelaLoja: false, status: { not: "CANCELADO" } },
        select: {
          valorServico: true,
          valorAssistencia: true,
          percentualAcerto: true,
          lojaId: true,
        },
      }),
      prisma.montagem.findMany({
        where: { lojaId: id, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
        orderBy: [{ dataAgendada: "asc" }, { createdAt: "asc" }],
        take: 50,
        select: SELECAO_MONTAGEM,
      }),
      prisma.montagem.findMany({
        where: { lojaId: id, status: "CONCLUIDO" },
        orderBy: { concluidoEm: "desc" },
        take: 15,
        select: SELECAO_MONTAGEM,
      }),
      buscarLinhasDoRelatorio(filtrosDoMes),
    ]);

  if (!loja) notFound();

  const totalDoMes = totalizar(doMes);
  const porTipoNoMes = resumoPorTipo(doMes);
  const valorAReceber = somarReceitaDaEmpresa(aReceber);

  const comoChegam = [
    loja.integraCentralSync ? "Pelo CentralSync (Pedidos pendentes)" : null,
    loja.lancamentoManual ? "Lançados à mão (loja parceira)" : null,
  ].filter(Boolean);

  return (
    <div>
      <p className="mb-2">
        <Link href="/admin/lojas" className="text-sm text-blue-600 hover:underline">
          ← Voltar para lojas
        </Link>
      </p>
      <PageHeader
        titulo={loja.nome}
        descricao="Pasta da loja: tudo o que foi feito para ela."
        acoes={
          <>
            <LinkButton href={`/admin/financeiro/relatorio?${filtrosParaUrl(filtrosDoMes)}`}>
              Relatório da loja
            </LinkButton>
            <LinkButton href={`/admin/montagens?lojaId=${loja.id}`} variante="secundario">
              Todas as montagens
            </LinkButton>
          </>
        }
      />

      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Badge
            className={loja.ativo ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}
          >
            {loja.ativo ? "Ativa" : "Inativa"}
          </Badge>
          {loja.integraCentralSync ? (
            <Badge className="bg-indigo-100 text-indigo-800">CentralSync</Badge>
          ) : null}
          {loja.lancamentoManual ? (
            <Badge className="bg-amber-100 text-amber-800">Parceira · lançamento manual</Badge>
          ) : null}
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-slate-500">CNPJ</dt>
            <dd className="font-medium text-gray-900">{formatarCnpj(loja.cnpj) || "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Telefone</dt>
            <dd className="font-medium text-gray-900">
              {loja.telefone ? formatarTelefone(loja.telefone) : "Não informado"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Endereço</dt>
            <dd className="font-medium text-gray-900">{loja.endereco || "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Como os serviços chegam</dt>
            <dd className="font-medium text-gray-900">
              {comoChegam.length > 0 ? comoChegam.join(" · ") : "Só montagem em loja"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Acerto da empresa</dt>
            <dd className="font-medium text-gray-900">{loja.percentualAcerto}% da nota</dd>
          </div>
          <div>
            <dt className="text-slate-500">Assistência</dt>
            <dd className="font-medium text-gray-900">{loja.percentualAssistencia}%</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Para mudar estes dados, edite a loja em{" "}
          <Link href="/admin/lojas" className="text-navy underline">
            Lojas
          </Link>
          .
        </p>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard
          titulo="Falta receber da loja"
          valor={formatarMoeda(valorAReceber)}
          sub={`${aReceber.length} serviço(s) sem pagamento, de todas as datas`}
          cor={valorAReceber > 0 ? "text-amber-600" : "text-gray-900"}
          icone="🏬"
        />
        <StatCard
          titulo="Serviços neste mês"
          valor={String(totalDoMes.quantidade)}
          sub={`${totalDoMes.concluidas} concluído(s) · ${totalMontagens} desde o início`}
          icone="📋"
        />
        <StatCard
          titulo="Notas neste mês"
          valor={formatarMoeda(totalDoMes.valorNotas)}
          icone="🧾"
        />
        <StatCard
          titulo="Devido à empresa no mês"
          valor={formatarMoeda(totalDoMes.receitaEmpresa)}
          sub="Acerto + assistência"
          cor="text-emerald-600"
          icone="🏢"
        />
      </div>

      <h2 className="mb-3 text-base font-semibold text-gray-900">Este mês, por tipo de serviço</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {porTipoNoMes.map((r) => (
          <Card key={r.tipo}>
            <Badge className={TIPO_SERVICO_COLOR[r.tipo]}>{TIPO_SERVICO_PLURAL[r.tipo]}</Badge>
            <p className="mt-2 text-2xl font-bold text-gray-900">{r.quantidade}</p>
            <p className="text-xs text-slate-500">{formatarMoeda(r.valorNotas)} em notas</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-base font-semibold text-gray-900">Em aberto ({emAberto.length})</h2>
      {emAberto.length === 0 ? (
        <Vazio>Nenhum serviço em aberto para esta loja.</Vazio>
      ) : (
        <div className="mb-8 space-y-3">
          {emAberto.map((m) => (
            <CartaoMontagem
              key={m.id}
              m={m}
              data={m.dataAgendada ? `Agendada para ${formatarData(m.dataAgendada)}` : "Sem data agendada"}
            />
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-base font-semibold text-gray-900">Concluídas recentemente</h2>
      {concluidas.length === 0 ? (
        <Vazio>Nenhum serviço concluído para esta loja ainda.</Vazio>
      ) : (
        <div className="space-y-3">
          {concluidas.map((m) => (
            <CartaoMontagem key={m.id} m={m} data={`Concluída em ${formatarData(m.concluidoEm)}`} />
          ))}
        </div>
      )}
      <p className="mt-4 text-sm">
        <Link href={`/admin/montagens?lojaId=${loja.id}`} className="font-medium text-navy hover:underline">
          Ver todas as {totalMontagens} montagens da loja →
        </Link>
      </p>
    </div>
  );
}

function CartaoMontagem({
  m,
  data,
}: {
  m: {
    id: string;
    clienteNome: string;
    descricaoServico: string;
    numeroPedido: string | null;
    tipoServico: keyof typeof TIPO_SERVICO_LABEL;
    status: string;
    valorServico: number;
    pagoPelaLoja: boolean;
    fotoProdutoUrl: string | null;
    feitoPorAdm: boolean;
    montador: { nome: string } | null;
  };
  data: string;
}) {
  return (
    <Link href={`/admin/montagens/${m.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{m.clienteNome}</p>
            <p className="line-clamp-1 text-sm text-gray-600">{m.descricaoServico}</p>
            <p className="mt-1 text-xs text-gray-500">
              {data} · Montador: {responsavel(m)}
              {m.numeroPedido ? ` · Pedido ${m.numeroPedido}` : ""} · {formatarMoeda(m.valorServico)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={STATUS_COLOR[m.status]}>{STATUS_LABEL[m.status]}</Badge>
            {m.tipoServico !== "MONTAGEM" ? (
              <Badge className={TIPO_SERVICO_COLOR[m.tipoServico]}>
                {TIPO_SERVICO_LABEL[m.tipoServico]}
              </Badge>
            ) : null}
            {m.status === "CONCLUIDO" ? (
              <span className="text-xs text-slate-500">
                {m.fotoProdutoUrl ? "Comprovante ✓" : "Sem comprovante"} ·{" "}
                {m.pagoPelaLoja ? "Pago" : "A receber"}
              </span>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
