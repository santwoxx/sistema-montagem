import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, Input, LinkButton, PageHeader, Select, Vazio } from "@/components/ui";
import { formatarData, formatarMoeda, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import type { Prisma, StatusMontagem } from "@prisma/client";

export default async function MontagensPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    lojaId?: string;
    montadorId?: string;
    busca?: string;
  }>;
}) {
  const { status, lojaId, montadorId, busca } = await searchParams;
  const termo = (busca ?? "").trim();

  const [lojas, montadores] = await Promise.all([
    prisma.loja.findMany({ orderBy: { nome: "asc" } }),
    prisma.user.findMany({ where: { role: "MONTADOR" }, orderBy: { nome: "asc" } }),
  ]);

  const where: Prisma.MontagemWhereInput = {};
  if (status) where.status = status as StatusMontagem;
  if (lojaId) where.lojaId = lojaId;
  if (montadorId) where.montadorId = montadorId === "nenhum" ? null : montadorId;
  // A lista corta nas 100 mais recentes: sem uma busca, uma montagem antiga
  // só era encontrada garimpando os filtros de loja/montador um a um.
  if (termo) {
    where.OR = [
      { clienteNome: { contains: termo, mode: "insensitive" } },
      { numeroPedido: { contains: termo, mode: "insensitive" } },
      { clienteEndereco: { contains: termo, mode: "insensitive" } },
      { descricaoServico: { contains: termo, mode: "insensitive" } },
    ];
  }

  const LIMITE = 100;
  const [montagens, totalMontagens] = await Promise.all([
    prisma.montagem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { loja: true, montador: true, _count: { select: { ocorrencias: true } } },
      take: LIMITE,
    }),
    prisma.montagem.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Montagens"
        descricao="Todos os pedidos de montagem cadastrados."
        acoes={<LinkButton href="/admin/montagens/nova">+ Nova montagem</LinkButton>}
      />

      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Input
              name="busca"
              defaultValue={termo}
              placeholder="Buscar por cliente, endereço, nº do pedido ou serviço"
            />
          </div>
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">Todos os status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="CANCELADO">Cancelado</option>
          </Select>
          <Select name="lojaId" defaultValue={lojaId ?? ""}>
            <option value="">Todas as lojas</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </Select>
          <Select name="montadorId" defaultValue={montadorId ?? ""}>
            <option value="">Todos os montadores</option>
            <option value="nenhum">Sem montador</option>
            {montadores.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-3">
            <Button type="submit">Filtrar</Button>
            <Link
              href="/admin/montagens"
              className="ml-3 text-sm text-gray-500 hover:underline"
            >
              Limpar filtros
            </Link>
          </div>
        </form>
      </Card>

      {montagens.length === 0 ? (
        <Vazio>Nenhuma montagem encontrada com esses filtros.</Vazio>
      ) : (
        <div className="space-y-3">
          {totalMontagens > LIMITE ? (
            <p className="text-sm text-amber-700">
              Mostrando as {LIMITE} mais recentes de {totalMontagens} montagens. Use os filtros acima para encontrar as demais.
            </p>
          ) : null}
          {montagens.map((m) => (
            <Link key={m.id} href={`/admin/montagens/${m.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{m.clienteNome}</p>
                    <p className="text-sm text-gray-500">
                      {m.loja.nome} · {m.feitoPorAdm ? <span className="font-medium text-navy">A própria empresa (ADM)</span> : (m.montador ? m.montador.nome : "Sem montador")}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatarData(m.dataAgendada)} · {formatarMoeda(m.valorServico)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={STATUS_COLOR[m.status]}>
                      {STATUS_LABEL[m.status]}
                    </Badge>
                    {!m.pagoPelaLoja && m.status !== "CANCELADO" ? (
                      <span className="text-xs text-amber-600">Loja não pagou</span>
                    ) : null}
                    {m._count.ocorrencias > 0 ? (
                      <span className="text-xs font-medium text-red-600">
                        ⚠ {m._count.ocorrencias} ocorrência
                        {m._count.ocorrencias > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
