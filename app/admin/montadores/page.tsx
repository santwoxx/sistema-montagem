import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { criarMontadorAction } from "@/lib/actions/montadores";
import { Alerta, Badge, Card, Field, Input, PageHeader, Vazio } from "@/components/ui";
import { Estrelas } from "@/components/Estrelas";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/SubmitButton";

export default async function MontadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { erro, sucesso } = await searchParams;

  const [montadores, avaliacoesAgrupadas] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MONTADOR" },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { montagens: true } },
      },
    }),
    prisma.avaliacao.groupBy({
      by: ["montadorId"],
      _avg: { estrelas: true },
      _count: { _all: true },
    }),
  ]);

  const avaliacaoPorMontador = new Map(
    avaliacoesAgrupadas.map((a) => [
      a.montadorId,
      { media: a._avg.estrelas ?? 0, total: a._count._all },
    ])
  );

  return (
    <div>
      <PageHeader
        titulo="Montadores"
        descricao="Cadastre os montadores da sua equipe e gerencie seus acessos."
      />

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {sucesso ? <Alerta tipo="sucesso">{sucesso}</Alerta> : null}

      <Card className="mb-8">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Novo montador</h2>
        <form action={criarMontadorAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo">
            <Input name="nome" required placeholder="Ex: João da Silva" />
          </Field>
          <Field label="Telefone (WhatsApp)">
            <Input name="telefone" placeholder="(11) 91234-5678" />
          </Field>
          <Field label="E-mail de acesso">
            <Input type="email" name="email" required placeholder="joao@exemplo.com" />
          </Field>
          <Field label="Senha provisória" hint="Mínimo de 6 caracteres.">
            <Input type="text" name="senha" required minLength={6} placeholder="Ex: monta123" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Comissão Padrão (%)" hint="Usada caso não haja comissão definida para uma loja específica.">
              <Input type="number" name="comissao" min={0} max={100} step="0.5" defaultValue={0} placeholder="Ex: 10" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Cadastrando…">Cadastrar montador</SubmitButton>
          </div>
        </form>
      </Card>

      <h2 className="mb-4 text-base font-semibold text-gray-900">
        Equipe ({montadores.length})
      </h2>

      {montadores.length === 0 ? (
        <Vazio>Nenhum montador cadastrado ainda.</Vazio>
      ) : (
        <div className="space-y-3">
          {montadores.map((m) => {
            const avaliacao = avaliacaoPorMontador.get(m.id);
            return (
              <Link key={m.id} href={`/admin/montadores/${m.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar nome={m.nome} fotoUrl={m.fotoUrl} className="shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-900">{m.nome}</p>
                        <p className="text-sm text-gray-500">
                          {m.email}
                          {m.telefone ? ` · ${m.telefone}` : ""}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {avaliacao ? (
                            <>
                              <Estrelas valor={avaliacao.media} tamanho="text-sm" />
                              <span className="text-xs text-gray-500">
                                {avaliacao.media.toFixed(1)} ({avaliacao.total})
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">Sem avaliações ainda</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {m._count.montagens} montagem(ns)
                      </span>
                      <Badge
                        className={
                          m.ativo
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-200 text-gray-600"
                        }
                      >
                        {m.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
