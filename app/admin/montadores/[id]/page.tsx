import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  atualizarMontadorAction,
  salvarComissoesAction,
  excluirMontadorAction,
} from "@/lib/actions/montadores";
import {
  Alerta,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  StatCard,
  Vazio,
} from "@/components/ui";
import { FormConfirmar } from "@/components/FormConfirmar";
import { Estrelas } from "@/components/Estrelas";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/SubmitButton";
import { formatarData, formatarMoeda, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";

export default async function MontadorDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { id } = await params;
  const { erro, sucesso } = await searchParams;

  const [
    montador,
    lojas,
    comissoes,
    montagensRecentes,
    ganhos,
    totalMontagens,
    avaliacaoAgg,
    avaliacoesRecentes,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id, role: "MONTADOR" } }),
    prisma.loja.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.comissaoLoja.findMany({ where: { montadorId: id } }),
    prisma.montagem.findMany({
      where: { montadorId: id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { loja: true },
    }),
    prisma.montagem.aggregate({
      _sum: { valorMontador: true },
      where: { montadorId: id, status: "CONCLUIDO", pagoAoMontador: false },
    }),
    prisma.montagem.count({ where: { montadorId: id } }),
    prisma.avaliacao.aggregate({
      _avg: { estrelas: true },
      _count: { _all: true },
      where: { montadorId: id },
    }),
    prisma.avaliacao.findMany({
      where: { montadorId: id },
      orderBy: { criadoEm: "desc" },
      take: 10,
      include: { montagem: { select: { clienteNome: true } } },
    }),
  ]);

  if (!montador) notFound();

  const mediaAvaliacao = avaliacaoAgg._avg.estrelas ?? 0;
  const totalAvaliacoes = avaliacaoAgg._count._all;

  const comissaoPorLoja = new Map(comissoes.map((c) => [c.lojaId, c.percentual]));

  return (
    <div>
      <p className="mb-2">
        <Link href="/admin/montadores" className="text-sm text-blue-600 hover:underline">
          ← Voltar para montadores
        </Link>
      </p>
      <div className="flex items-center gap-4">
        <Avatar
          nome={montador.nome}
          fotoUrl={montador.fotoUrl}
          tamanho="h-14 w-14 text-lg"
          className="shrink-0"
        />
        <div className="flex-1">
          <PageHeader
            titulo={montador.nome}
            descricao={montador.email}
            acoes={
              <Badge
                className={
                  montador.ativo
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-200 text-gray-600"
                }
              >
                {montador.ativo ? "Ativo" : "Inativo"}
              </Badge>
            }
          />
        </div>
      </div>

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {sucesso ? <Alerta tipo="sucesso">{sucesso}</Alerta> : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard
          titulo="Comissão pendente de pagamento"
          valor={formatarMoeda(ganhos._sum.valorMontador)}
          cor="text-amber-600"
          sub="Referente a montagens já concluídas"
        />
        <Card>
          <p className="text-sm font-medium text-slate-500">Avaliação dos clientes</p>
          {totalAvaliacoes === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Ainda sem avaliações.</p>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <Estrelas valor={mediaAvaliacao} tamanho="text-xl" />
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {mediaAvaliacao.toFixed(1)}
              </span>
              <span className="text-sm text-slate-500">
                ({totalAvaliacoes} avaliação{totalAvaliacoes > 1 ? "ões" : ""})
              </span>
            </div>
          )}
        </Card>
      </div>

      {avaliacoesRecentes.length > 0 ? (
        <Card className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Avaliações recentes
          </h2>
          <div className="space-y-3">
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
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Dados do montador
          </h2>
          <form
            action={atualizarMontadorAction.bind(null, montador.id)}
            className="space-y-4"
          >
            <Field label="Nome completo">
              <Input name="nome" defaultValue={montador.nome} required />
            </Field>
            <Field label="Telefone (WhatsApp)">
              <Input name="telefone" defaultValue={montador.telefone ?? ""} />
            </Field>
            <Field label="E-mail de acesso">
              <Input type="email" name="email" defaultValue={montador.email} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nova senha"
                hint="Deixe em branco para manter a senha atual."
              >
                <Input type="text" name="senha" minLength={6} placeholder="••••••••" />
              </Field>
              <Field
                label="Comissão Padrão (%)"
                hint="Aplicada quando não há comissão por loja."
              >
                <Input type="number" name="comissaoPadrao" min={0} max={100} step="0.5" defaultValue={montador.comissaoPadrao ?? 0} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="ativo"
                defaultChecked={montador.ativo}
                className="h-4 w-4 rounded border-gray-300"
              />
              Montador ativo (pode fazer login e receber montagens)
            </label>
            <SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton>
          </form>
        </Card>

        <Card>
          <h2 className="mb-1 text-base font-semibold text-gray-900">
            Comissão por loja
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Percentual (%) que este montador recebe sobre o valor de cada
            montagem, de acordo com a loja.
          </p>
          {lojas.length === 0 ? (
            <Vazio>Cadastre uma loja primeiro para definir comissões.</Vazio>
          ) : (
            <form
              action={salvarComissoesAction.bind(null, montador.id)}
              className="space-y-3"
            >
              {lojas.map((loja) => (
                <div key={loja.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">{loja.nome}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      name={`percentual_${loja.id}`}
                      defaultValue={comissaoPorLoja.get(loja.id) ?? 0}
                      min={0}
                      max={100}
                      step="0.5"
                      className="w-24 text-right"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              ))}
              <SubmitButton pendingText="Salvando…" className="mt-2">
                Salvar comissões
              </SubmitButton>
            </form>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Últimas montagens
        </h2>
        {montagensRecentes.length === 0 ? (
          <Vazio>Nenhuma montagem atribuída a este montador ainda.</Vazio>
        ) : (
          <div className="space-y-3">
            {montagensRecentes.map((m) => (
              <Link key={m.id} href={`/admin/montagens/${m.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{m.clienteNome}</p>
                      <p className="text-sm text-gray-500">
                        {m.loja.nome} · {formatarMoeda(m.valorMontador)} de comissão
                      </p>
                      <p className="text-xs text-gray-400">{formatarData(m.createdAt)}</p>
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

      <Card className="mt-8 border-red-100">
        <p className="text-sm font-medium text-slate-500">Zona de risco</p>
        <p className="mt-1 text-sm text-slate-500">
          {totalMontagens > 0
            ? `Este montador tem ${totalMontagens} montagem(ns) no histórico. Excluir o cadastro remove o login dele, mas as montagens continuam existindo (ficam sem montador). Se é só um afastamento temporário, prefira desativar em vez de excluir.`
            : 'Excluir remove o login deste montador permanentemente. Se é só um afastamento temporário, prefira desmarcar "Montador ativo" acima em vez de excluir.'}
        </p>
        <FormConfirmar
          action={excluirMontadorAction.bind(null, montador.id)}
          mensagem={`Excluir o montador "${montador.nome}"? Essa ação não pode ser desfeita.`}
          className="mt-3"
        >
          <Button type="submit" variante="perigo">
            Excluir montador
          </Button>
        </FormConfirmar>
      </Card>
    </div>
  );
}
