import Link from "next/link";
import { requireMontador } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Vazio } from "@/components/ui";
import { FormularioBusca, TituloSecao } from "@/components/Busca";
import { agruparClientes, descreverData, lerTermo, palavrasDaBusca } from "@/lib/busca";
import { buscarIdsDeMontagens } from "@/lib/buscar-montagens";
import { formatarMoeda, formatarTelefone, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import { nomeDaOrigem } from "@/lib/servico";

/** Lidas do banco: é daqui que sai também a lista de clientes. */
const MONTAGENS_LIDAS = 200;
const MONTAGENS_NA_TELA = 30;
const CLIENTES_NA_TELA = 8;

// A mesma busca do admin, mas só nas montagens do próprio montador: o painel
// dele mostra as 5 últimas concluídas, e o cliente que liga meses depois
// ("foi você que montou meu guarda-roupa?") não tinha como ser achado.
export default async function BuscaMontadorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await requireMontador();
  const { q } = await searchParams;
  const termo = lerTermo(q);
  const palavras = palavrasDaBusca(termo);

  if (palavras.length === 0) {
    return (
      <div>
        <PageHeader titulo="Buscar" descricao="Encontre uma montagem sua ou um cliente que você já atendeu." />
        <FormularioBusca
          action="/montador/busca"
          termo={termo}
          placeholder="Cliente, telefone, endereço, nº do pedido ou produto"
        />
        <Vazio>Digite o nome do cliente, telefone, endereço, nº do pedido ou o produto.</Vazio>
      </div>
    );
  }

  const { ids, total } = await buscarIdsDeMontagens(termo, {
    limite: MONTAGENS_LIDAS,
    montadorId: session.sub,
  });

  const montagens =
    ids.length === 0
      ? []
      : await prisma.montagem.findMany({
          // O montadorId de novo aqui não é por acaso: garante que só saem
          // montagens dele mesmo que a lista de ids venha errada.
          where: { id: { in: ids }, montadorId: session.sub },
          // Mesma ordem do SQL da busca.
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            numeroPedido: true,
            clienteNome: true,
            clienteTelefone: true,
            clienteEndereco: true,
            descricaoServico: true,
            valorMontador: true,
            status: true,
            dataAgendada: true,
            concluidoEm: true,
            createdAt: true,
            loja: { select: { nome: true } },
          },
        });

  const clientes = agruparClientes(
    montagens.map((m) => ({ ...m, responsavel: null })),
    palavras
  );

  return (
    <div>
      <PageHeader titulo="Buscar" descricao="Encontre uma montagem sua ou um cliente que você já atendeu." />
      <FormularioBusca
          action="/montador/busca"
          termo={termo}
          placeholder="Cliente, telefone, endereço, nº do pedido ou produto"
        />

      {montagens.length === 0 ? (
        <Vazio>
          Nenhuma montagem sua encontrada para &ldquo;{termo}&rdquo;. Confira a grafia ou
          tente só uma parte do nome, do telefone ou do endereço.
        </Vazio>
      ) : null}

      {clientes.length > 0 ? (
        <section className="mb-8">
          <TituloSecao titulo="Clientes" quantidade={clientes.length} />
          <div className="space-y-3">
            {clientes.slice(0, CLIENTES_NA_TELA).map((c) => (
              <Card key={c.nome}>
                <p className="font-semibold text-gray-900">{c.nome}</p>
                {c.telefone ? (
                  <p className="text-sm text-gray-600">{formatarTelefone(c.telefone)}</p>
                ) : null}
                <p className="mt-1 text-sm text-gray-500">{c.endereco}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {c.montagens} montagem{c.montagens > 1 ? "s" : ""} com você
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {montagens.length > 0 ? (
        <section>
          <TituloSecao titulo="Montagens" quantidade={total} />
          <div className="space-y-3">
            {montagens.slice(0, MONTAGENS_NA_TELA).map((m) => (
              <Link key={m.id} href={`/montador/montagens/${m.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{m.clienteNome}</p>
                      <p className="line-clamp-1 text-sm text-gray-600">
                        {m.descricaoServico}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">{nomeDaOrigem(m.loja)}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {descreverData(m)}
                        {m.numeroPedido ? ` · Pedido ${m.numeroPedido}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Você recebe:{" "}
                        <span className="font-medium text-emerald-600">
                          {formatarMoeda(m.valorMontador)}
                        </span>
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
              Mostrando as {MONTAGENS_NA_TELA} mais recentes de {total}. Refine a busca para
              encontrar as demais.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
