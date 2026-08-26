import { requireMontador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { atualizarPerfilAction } from "@/lib/actions/perfil";
import { Alerta, Card, LinkButton, PageHeader, Vazio } from "@/components/ui";
import { PerfilMontadorForm } from "@/components/PerfilMontadorForm";
import { Estrelas } from "@/components/Estrelas";
import { formatarData, formatarMoeda } from "@/lib/format";
import { inicioDoMesLocal } from "@/lib/datas";

export default async function PerfilMontadorPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const session = await requireMontador();
  const { erro, sucesso } = await searchParams;

  const inicioMes = inicioDoMesLocal();

  const [usuario, lojas, comissoes, ganhoMesAgg, avaliacaoAgg, avaliacoesRecentes] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: session.sub } }),
      prisma.loja.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      prisma.comissaoLoja.findMany({ where: { montadorId: session.sub } }),
      prisma.montagem.aggregate({
        _sum: { valorMontador: true },
        where: {
          montadorId: session.sub,
          status: "CONCLUIDO",
          concluidoEm: { gte: inicioMes },
        },
      }),
      prisma.avaliacao.aggregate({
        _avg: { estrelas: true },
        _count: { _all: true },
        where: { montadorId: session.sub },
      }),
      prisma.avaliacao.findMany({
        where: { montadorId: session.sub },
        orderBy: { criadoEm: "desc" },
        take: 10,
        include: { montagem: { select: { clienteNome: true } } },
      }),
    ]);

  if (!usuario) return null;

  const comissaoPorLoja = new Map(comissoes.map((c) => [c.lojaId, c.percentual]));
  const mediaAvaliacao = avaliacaoAgg._avg.estrelas ?? 0;
  const totalAvaliacoes = avaliacaoAgg._count._all;

  return (
    <div>
      <PageHeader titulo="Meu perfil" descricao="Seus dados, sua nota e seus ganhos." />

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {sucesso ? <Alerta tipo="sucesso">{sucesso}</Alerta> : null}

      <Card className="mb-6">
        <PerfilMontadorForm
          action={atualizarPerfilAction}
          nomeAtual={usuario.nome}
          telefoneAtual={usuario.telefone ?? ""}
          fotoAtualUrl={usuario.fotoUrl}
        />
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
          E-mail de acesso: {usuario.email}
        </p>
      </Card>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-500">Ganho este mês</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatarMoeda(ganhoMesAgg._sum.valorMontador)}
            </p>
          </div>
          <LinkButton href="/montador/financeiro" variante="secundario">
            Ver financeiro completo →
          </LinkButton>
        </div>
      </Card>

      <Card className="mb-6">
        <p className="mb-1 text-sm font-medium text-gray-500">Sua avaliação</p>
        {totalAvaliacoes === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Você ainda não recebeu avaliações de clientes.
          </p>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <Estrelas valor={mediaAvaliacao} tamanho="text-xl" />
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              {mediaAvaliacao.toFixed(1)}
            </span>
            <span className="text-sm text-gray-500">
              ({totalAvaliacoes} avaliação{totalAvaliacoes > 1 ? "ões" : ""})
            </span>
          </div>
        )}

        {avaliacoesRecentes.length > 0 ? (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
            {avaliacoesRecentes.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Estrelas valor={a.estrelas} tamanho="text-sm" />
                    <span className="text-sm font-medium text-slate-700">
                      {a.montagem.clienteNome}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{formatarData(a.criadoEm)}</span>
                </div>
                {a.comentario ? (
                  <p className="mt-2 text-sm text-slate-600">&ldquo;{a.comentario}&rdquo;</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <p className="mb-1 text-base font-semibold text-gray-900">Sua comissão por loja</p>
        <p className="mb-4 text-sm text-gray-500">
          Percentual que você recebe sobre o valor de cada montagem, conforme a loja.
        </p>
        {lojas.length === 0 ? (
          <Vazio>Nenhuma loja cadastrada ainda.</Vazio>
        ) : (
          <div className="space-y-2">
            {lojas.map((loja) => (
              <div
                key={loja.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <span className="text-sm text-gray-700">{loja.nome}</span>
                <span className="text-sm font-semibold text-gray-900">
                  {comissaoPorLoja.get(loja.id) ?? 0}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
