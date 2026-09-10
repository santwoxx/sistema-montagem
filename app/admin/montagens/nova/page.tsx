import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { criarMontagemAction } from "@/lib/actions/montagens";
import { Alerta, Card, PageHeader } from "@/components/ui";
import { NovaMontagemForm } from "@/components/NovaMontagemForm";

export default async function NovaMontagemPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  const [lojas, montadores, comissoes, notasPendentesBrutas, solicitacoesBrutas] = await Promise.all([
    prisma.loja.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.user.findMany({
      where: { role: "MONTADOR", ativo: true },
      orderBy: { nome: "asc" },
    }),
    prisma.comissaoLoja.findMany(),
    prisma.notaPendente.findMany({
      orderBy: { criadaEm: "asc" },
      include: { montadorSugerido: { select: { nome: true } } },
    }),
    // Só o que ainda está na fila: atendido virou montagem, recusado o
    // admin já resolveu.
    prisma.solicitacaoAgendamento.findMany({
      where: { atendidaEm: null, recusadaEm: null },
      orderBy: { criadaEm: "asc" },
    }),
  ]);

  const notasPendentes = notasPendentesBrutas.map((n) => ({
    id: n.id,
    numeroPedido: n.numeroPedido,
    clienteNome: n.clienteNome,
    clienteTelefone: n.clienteTelefone,
    clienteEndereco: n.clienteEndereco,
    descricaoServico: n.descricaoServico,
    valorServico: n.valorServico,
    dataAgendada: n.dataAgendada ? n.dataAgendada.toISOString() : null,
    observacoes: n.observacoes,
    fotoReferenciaUrl: n.fotoReferenciaUrl,
    notaUrl: n.notaUrl,
    montadorSugeridoId: n.montadorSugeridoId,
    montadorSugeridoNome: n.montadorSugerido?.nome ?? null,
    lojaNomeSugerida: n.lojaNomeSugerida,
    lojaCnpjSugerido: n.lojaCnpjSugerido,
  }));

  // Datas viram texto aqui porque o formulário é um componente de cliente:
  // objeto Date não atravessa essa fronteira.
  const solicitacoes = solicitacoesBrutas.map((s) => ({
    id: s.id,
    clienteNome: s.clienteNome,
    clienteTelefone: s.clienteTelefone,
    clienteEndereco: s.clienteEndereco,
    produto: s.produto,
    observacoes: s.observacoes,
    dataPreferida: s.dataPreferida ? s.dataPreferida.toISOString() : null,
    periodo: s.periodo,
    criadaEm: s.criadaEm.toISOString(),
  }));

  return (
    <div>
      <p className="mb-2">
        <Link href="/admin/montagens" className="text-sm text-blue-600 hover:underline">
          ← Voltar para montagens
        </Link>
      </p>
      <PageHeader
        titulo="Nova montagem"
        descricao="Cadastre um novo pedido e, se quiser, já designe o montador."
      />

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

      <Card>
        <NovaMontagemForm
          action={criarMontagemAction}
          lojas={lojas}
          montadores={montadores}
          comissoes={comissoes}
          notasPendentes={notasPendentes}
          solicitacoes={solicitacoes}
        />
      </Card>
    </div>
  );
}
