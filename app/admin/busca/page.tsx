import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/Avatar";
import { Badge, Card, PageHeader, Vazio } from "@/components/ui";
import { FormularioBusca, TituloSecao } from "@/components/Busca";
import {
  agruparClientes,
  correspondeABusca,
  descreverData,
  lerTermo,
  palavrasDaBusca,
} from "@/lib/busca";
import { buscarIdsDeMontagens } from "@/lib/buscar-montagens";
import {
  formatarData,
  formatarMoeda,
  formatarTelefone,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/format";
import { nomeDaOrigem } from "@/lib/servico";

/** Lidas do banco: é daqui que sai também a lista de clientes. */
const MONTAGENS_LIDAS = 200;
const MONTAGENS_NA_TELA = 30;
const CLIENTES_NA_TELA = 12;

export default async function BuscaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const termo = lerTermo(q);
  const palavras = palavrasDaBusca(termo);

  if (palavras.length === 0) {
    return (
      <div>
        <PageHeader
          titulo="Buscar"
          descricao="Encontre montagens antigas, clientes e o montador responsável."
        />
        <FormularioBusca
          action="/admin/busca"
          termo={termo}
          placeholder="Cliente, telefone, endereço, nº do pedido, produto ou montador"
        />
        <Vazio>
          Digite o nome do cliente, telefone, endereço, nº do pedido, o produto ou o nome
          do montador.
        </Vazio>
      </div>
    );
  }

  const [todosMontadores, { ids, total }] = await Promise.all([
    // A equipe é pequena: filtrar aqui, com as mesmas regras da busca de
    // montagens (sem acento, telefone por dígitos), sai mais simples que
    // repetir o SQL para outra tabela.
    prisma.user.findMany({
      where: { role: "MONTADOR" },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        fotoUrl: true,
        ativo: true,
        _count: { select: { montagens: true } },
      },
    }),
    buscarIdsDeMontagens(termo, { limite: MONTAGENS_LIDAS }),
  ]);

  const montadores = todosMontadores.filter((m) =>
    correspondeABusca(palavras, {
      textos: [m.nome, m.email, m.telefone],
      telefones: [m.telefone],
    })
  );

  const montagens =
    ids.length === 0
      ? []
      : await prisma.montagem.findMany({
          where: { id: { in: ids } },
          // Mesma ordem do SQL da busca.
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            numeroPedido: true,
            clienteNome: true,
            clienteTelefone: true,
            clienteEndereco: true,
            descricaoServico: true,
            valorServico: true,
            status: true,
            dataAgendada: true,
            concluidoEm: true,
            createdAt: true,
            feitoPorAdm: true,
            loja: { select: { nome: true } },
            montador: { select: { nome: true } },
          },
        });

  const comResponsavel = montagens.map((m) => ({
    ...m,
    responsavel: m.feitoPorAdm ? "A própria empresa (ADM)" : (m.montador?.nome ?? null),
  }));

  const clientes = agruparClientes(comResponsavel, palavras);
  const nadaEncontrado = montadores.length === 0 && montagens.length === 0;

  return (
    <div>
      <PageHeader
        titulo="Buscar"
        descricao="Encontre montagens antigas, clientes e o montador responsável."
      />
      <FormularioBusca
          action="/admin/busca"
          termo={termo}
          placeholder="Cliente, telefone, endereço, nº do pedido, produto ou montador"
        />

      {nadaEncontrado ? (
        <Vazio>
          Nada encontrado para &ldquo;{termo}&rdquo;. Confira a grafia ou tente só uma parte
          do nome, do telefone ou do endereço.
        </Vazio>
      ) : null}

      {montadores.length > 0 ? (
        <section className="mb-8">
          <TituloSecao titulo="Montadores" quantidade={montadores.length} />
          <div className="space-y-3">
            {montadores.map((m) => (
              <Link key={m.id} href={`/admin/montadores/${m.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar nome={m.nome} fotoUrl={m.fotoUrl} className="shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{m.nome}</p>
                        <p className="truncate text-sm text-gray-500">
                          {m.email}
                          {m.telefone ? ` · ${formatarTelefone(m.telefone)}` : ""}
                        </p>
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
            ))}
          </div>
        </section>
      ) : null}

      {clientes.length > 0 ? (
        <section className="mb-8">
          <TituloSecao titulo="Clientes" quantidade={clientes.length} />
          <div className="grid gap-3 sm:grid-cols-2">
            {clientes.slice(0, CLIENTES_NA_TELA).map((c) => (
              <Link
                key={c.nome}
                href={`/admin/montagens?busca=${encodeURIComponent(c.nome)}`}
                className="block"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <p className="font-semibold text-gray-900">{c.nome}</p>
                  {c.telefone ? (
                    <p className="text-sm text-gray-600">{formatarTelefone(c.telefone)}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-gray-500">{c.endereco}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {c.montagens} montagem{c.montagens > 1 ? "s" : ""} · última cadastrada em{" "}
                    {formatarData(c.ultimaEm)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Último montador:{" "}
                    <span className="font-medium text-navy">
                      {c.ultimoResponsavel ?? "nenhum designado"}
                    </span>
                  </p>
                </Card>
              </Link>
            ))}
          </div>
          {clientes.length > CLIENTES_NA_TELA ? (
            <p className="mt-2 text-sm text-slate-500">
              Mostrando {CLIENTES_NA_TELA} de {clientes.length} clientes. Refine a busca
              para ver os demais.
            </p>
          ) : null}
        </section>
      ) : null}

      {montagens.length > 0 ? (
        <section>
          <TituloSecao titulo="Montagens" quantidade={total} />
          <div className="space-y-3">
            {comResponsavel.slice(0, MONTAGENS_NA_TELA).map((m) => (
              <Link key={m.id} href={`/admin/montagens/${m.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{m.clienteNome}</p>
                      <p className="line-clamp-1 text-sm text-gray-600">
                        {m.descricaoServico}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {nomeDaOrigem(m.loja)} · Montador:{" "}
                        <span className="font-medium text-navy">
                          {m.responsavel ?? "nenhum designado"}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {descreverData(m)}
                        {m.numeroPedido ? ` · Pedido ${m.numeroPedido}` : ""} ·{" "}
                        {formatarMoeda(m.valorServico)}
                      </p>
                    </div>
                    <Badge className={STATUS_COLOR[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {total > MONTAGENS_NA_TELA ? (
            <p className="mt-3 text-sm text-slate-600">
              Mostrando as {MONTAGENS_NA_TELA} mais recentes de {total}.{" "}
              <Link
                href={`/admin/montagens?busca=${encodeURIComponent(termo)}`}
                className="font-medium text-navy hover:underline"
              >
                Ver todas em Montagens, com filtros →
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
