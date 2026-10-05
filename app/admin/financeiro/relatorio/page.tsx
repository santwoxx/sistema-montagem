import Link from "next/link";
import type { TipoServico } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  Alerta,
  Badge,
  Button,
  Card,
  classesDeBotao,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  Vazio,
} from "@/components/ui";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { buscarLinhasDoRelatorio, LIMITE_RELATORIO } from "@/lib/consultar-relatorio";
import { formatarData, formatarMoeda, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import {
  dataDeReferencia,
  type FiltrosRelatorio,
  filtrosParaUrl,
  lerFiltrosRelatorio,
  listaPorTipo,
  MONTADOR_ADM,
  MONTADOR_NENHUM,
  NOME_ADM,
  responsavel,
  resumoPorLoja,
  resumoPorMontador,
  resumoPorTipo,
  SITUACAO_LABEL,
  SITUACOES,
  totalizar,
  VALOR_SO_LOJAS,
} from "@/lib/relatorio";
import { receitaDaEmpresa } from "@/lib/financeiro";
import { nomeDaOrigem, VALOR_PARTICULAR_FORM } from "@/lib/servico";
import { TIPO_SERVICO_COLOR, TIPO_SERVICO_PLURAL, TIPOS_SERVICO } from "@/lib/tipo-servico";

/** Cabeçalho curto das colunas por tipo (as tabelas ficam largas no celular). */
const COLUNA_TIPO: Record<TipoServico, string> = {
  MONTAGEM: "Montagens",
  ASSISTENCIA: "Assist.",
  DESMONTAGEM: "Desmont.",
  MONTAGEM_LOJA: "Em loja",
};

/** "2026-10-01" -> "01/10/2026", sem passar por Date (e por fuso). */
function diaBr(texto: string) {
  const [ano, mes, dia] = texto.split("-");
  return `${dia}/${mes}/${ano}`;
}

function descreverFiltros(
  f: FiltrosRelatorio,
  lojas: Array<{ id: string; nome: string }>,
  montadores: Array<{ id: string; nome: string }>
) {
  const loja =
    f.lojaId === VALOR_PARTICULAR_FORM
      ? "só particulares"
      : f.lojaId === VALOR_SO_LOJAS
        ? "só serviços de loja"
        : (lojas.find((l) => l.id === f.lojaId)?.nome ?? "todas as lojas");
  const montador =
    f.montadorId === MONTADOR_ADM
      ? NOME_ADM
      : f.montadorId === MONTADOR_NENHUM
        ? "sem montador"
        : (montadores.find((m) => m.id === f.montadorId)?.nome ?? "todos os montadores");

  return [
    `${diaBr(f.de)} a ${diaBr(f.ate)}`,
    f.base === "conclusao" ? "pela data de conclusão" : "pela data de cadastro",
    f.tipo ? TIPO_SERVICO_PLURAL[f.tipo].toLowerCase() : "todos os tipos",
    loja,
    montador,
    SITUACAO_LABEL[f.situacao].toLowerCase(),
  ].join(" · ");
}

// As tabelas rolam de lado no celular; na impressão, cabem na folha.
const CAIXA_TABELA =
  "overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none";
const TH =
  "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 print:px-1.5";
const TD = "px-3 py-2.5 align-top print:px-1.5";

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = lerFiltrosRelatorio(await searchParams);

  const [lojas, montadores, { linhas, cortado }] = await Promise.all([
    prisma.loja.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.user.findMany({
      where: { role: "MONTADOR" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    buscarLinhasDoRelatorio(filtros),
  ]);

  const tiposVisiveis = filtros.tipo ? [filtros.tipo] : [...TIPOS_SERVICO];
  const porTipo = resumoPorTipo(linhas).filter((r) => tiposVisiveis.includes(r.tipo));
  const total = totalizar(linhas);
  const porMontador = resumoPorMontador(linhas);
  const porLoja = resumoPorLoja(linhas);
  const lista = listaPorTipo(linhas, filtros.base);
  const descricao = descreverFiltros(filtros, lojas, montadores);
  const rotuloData = filtros.base === "conclusao" ? "Concluída em" : "Cadastrada em";

  return (
    <div>
      <p className="mb-2 print:hidden">
        <Link href="/admin/financeiro" className="text-sm text-blue-600 hover:underline">
          ← Voltar ao Financeiro
        </Link>
      </p>
      <PageHeader
        titulo="Relatório detalhado"
        descricao={descricao}
        acoes={
          <div className="flex flex-wrap gap-2 print:hidden">
            <BotaoImprimir>Imprimir / PDF</BotaoImprimir>
            <a
              href={`/admin/financeiro/relatorio/planilha?${filtrosParaUrl(filtros)}`}
              download
              className={classesDeBotao("secundario")}
            >
              Baixar planilha
            </a>
          </div>
        }
      />

      <Card className="mb-6 print:hidden">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="De">
            <Input type="date" name="de" defaultValue={filtros.de} required />
          </Field>
          <Field label="Até">
            <Input type="date" name="ate" defaultValue={filtros.ate} required />
          </Field>
          <Field label="Contar pelo" hint="Use “conclusão” para ver o que foi feito no período.">
            <Select name="base" defaultValue={filtros.base}>
              <option value="cadastro">Cadastro da montagem</option>
              <option value="conclusao">Conclusão do serviço</option>
            </Select>
          </Field>
          <Field label="Tipo de serviço">
            <Select name="tipo" defaultValue={filtros.tipo ?? ""}>
              <option value="">Todos os tipos</option>
              {TIPOS_SERVICO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_SERVICO_PLURAL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Situação">
            <Select name="situacao" defaultValue={filtros.situacao}>
              {SITUACOES.map((s) => (
                <option key={s} value={s}>
                  {SITUACAO_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Loja">
            <Select name="lojaId" defaultValue={filtros.lojaId}>
              <option value="">Todas</option>
              <option value={VALOR_SO_LOJAS}>Só serviços de loja</option>
              <option value={VALOR_PARTICULAR_FORM}>Só particulares</option>
              {lojas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Montador">
            <Select name="montadorId" defaultValue={filtros.montadorId}>
              <option value="">Todos</option>
              <option value={MONTADOR_ADM}>{NOME_ADM}</option>
              <option value={MONTADOR_NENHUM}>Sem montador</option>
              {montadores.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Gerar relatório
            </Button>
          </div>
        </form>
      </Card>

      {cortado ? (
        <Alerta tipo="erro">
          O período tem mais de {LIMITE_RELATORIO} serviços e o relatório foi cortado nesse
          número. Escolha um período menor para ver os totais completos.
        </Alerta>
      ) : null}

      {linhas.length === 0 ? (
        <Vazio>Nenhum serviço encontrado com esses filtros.</Vazio>
      ) : (
        <>
          <h2 className="mb-3 text-base font-semibold text-gray-900 break-after-avoid">Resumo por tipo</h2>
          <div
            className={
              "mb-4 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 print:grid-cols-4 " +
              (tiposVisiveis.length > 1 ? "lg:grid-cols-4" : "")
            }
          >
            {porTipo.map((r) => (
              <Card key={r.tipo} className="break-inside-avoid">
                <Badge className={TIPO_SERVICO_COLOR[r.tipo]}>{TIPO_SERVICO_PLURAL[r.tipo]}</Badge>
                <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                  {r.quantidade}
                </p>
                <p className="text-xs text-slate-500">
                  {r.concluidas} concluída{r.concluidas === 1 ? "" : "s"}
                </p>
                <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Notas</dt>
                    <dd className="font-medium text-gray-900">{formatarMoeda(r.valorNotas)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Montadores</dt>
                    <dd className="font-medium text-blue-700">
                      {formatarMoeda(r.comissaoMontadores)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Empresa</dt>
                    <dd className="font-medium text-emerald-700">
                      {formatarMoeda(r.receitaEmpresa)}
                    </dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-5 print:grid-cols-5">
            <StatCard
              titulo="Total de serviços"
              valor={String(total.quantidade)}
              sub={`${total.concluidas} concluídos`}
              icone="📋"
            />
            <StatCard titulo="Valor das notas" valor={formatarMoeda(total.valorNotas)} icone="🧾" />
            <StatCard
              titulo="Receita da empresa"
              valor={formatarMoeda(total.receitaEmpresa)}
              icone="🏢"
            />
            <StatCard
              titulo="Comissões"
              valor={formatarMoeda(total.comissaoMontadores)}
              cor="text-blue-600"
              icone="👷"
            />
            <StatCard
              titulo="Lucro da empresa"
              valor={formatarMoeda(total.lucroEmpresa)}
              cor="text-emerald-600"
              icone="📈"
            />
          </div>

          <h2 className="mb-3 text-base font-semibold text-gray-900 break-after-avoid">Por montador</h2>
          <div className={`mb-8 ${CAIXA_TABELA}`}>
            <table className="w-full min-w-[640px] text-sm print:min-w-0">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={TH}>Montador</th>
                  {tiposVisiveis.map((t) => (
                    <th key={t} className={`${TH} text-right`}>
                      {COLUNA_TIPO[t]}
                    </th>
                  ))}
                  {tiposVisiveis.length > 1 ? <th className={`${TH} text-right`}>Total</th> : null}
                  <th className={`${TH} text-right`}>Comissão</th>
                  <th className={`${TH} text-right`}>Falta pagar</th>
                </tr>
              </thead>
              <tbody>
                {porMontador.map((m) => (
                  <tr key={m.chave} className="border-b border-slate-100 last:border-0">
                    <td className={`${TD} font-medium text-gray-900`}>{m.nome}</td>
                    {tiposVisiveis.map((t) => (
                      <td key={t} className={`${TD} text-right text-slate-700`}>
                        {m.porTipo[t] || "–"}
                      </td>
                    ))}
                    {tiposVisiveis.length > 1 ? (
                      <td className={`${TD} text-right font-semibold`}>{m.quantidade}</td>
                    ) : null}
                    <td className={`${TD} text-right`}>{formatarMoeda(m.comissao)}</td>
                    <td
                      className={`${TD} text-right ${m.aPagar > 0 ? "text-amber-700" : "text-slate-400"}`}
                    >
                      {formatarMoeda(m.aPagar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-3 text-base font-semibold text-gray-900 break-after-avoid">Por loja</h2>
          <div className={`mb-8 ${CAIXA_TABELA}`}>
            <table className="w-full min-w-[720px] text-sm print:min-w-0">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={TH}>Loja</th>
                  {tiposVisiveis.map((t) => (
                    <th key={t} className={`${TH} text-right`}>
                      {COLUNA_TIPO[t]}
                    </th>
                  ))}
                  {tiposVisiveis.length > 1 ? <th className={`${TH} text-right`}>Total</th> : null}
                  <th className={`${TH} text-right`}>Notas</th>
                  <th className={`${TH} text-right`}>Devido à empresa</th>
                  <th className={`${TH} text-right`}>Falta receber</th>
                </tr>
              </thead>
              <tbody>
                {porLoja.map((l) => (
                  <tr key={l.chave} className="border-b border-slate-100 last:border-0">
                    <td className={`${TD} font-medium text-gray-900`}>{l.nome}</td>
                    {tiposVisiveis.map((t) => (
                      <td key={t} className={`${TD} text-right text-slate-700`}>
                        {l.porTipo[t] || "–"}
                      </td>
                    ))}
                    {tiposVisiveis.length > 1 ? (
                      <td className={`${TD} text-right font-semibold`}>{l.quantidade}</td>
                    ) : null}
                    <td className={`${TD} text-right`}>{formatarMoeda(l.valorNotas)}</td>
                    <td className={`${TD} text-right`}>{formatarMoeda(l.devidoAEmpresa)}</td>
                    <td
                      className={`${TD} text-right ${l.aReceber > 0 ? "text-amber-700" : "text-slate-400"}`}
                    >
                      {formatarMoeda(l.aReceber)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-3 text-base font-semibold text-gray-900 break-after-avoid">Lista completa</h2>
          {lista.map((grupo) => (
            <section key={grupo.tipo} className="mb-8">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 break-after-avoid">
                <Badge className={TIPO_SERVICO_COLOR[grupo.tipo]}>
                  {TIPO_SERVICO_PLURAL[grupo.tipo]}
                </Badge>
                <span>
                  {grupo.linhas.length} serviço{grupo.linhas.length === 1 ? "" : "s"}
                </span>
              </h3>
              <div className={CAIXA_TABELA}>
                <table className="w-full min-w-[960px] text-sm print:min-w-0 print:text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className={TH}>{rotuloData}</th>
                      <th className={TH}>Cliente</th>
                      <th className={TH}>Loja</th>
                      <th className={TH}>Montador</th>
                      <th className={TH}>Pedido</th>
                      <th className={TH}>Serviço</th>
                      <th className={TH}>Situação</th>
                      <th className={`${TH} text-right`}>Nota</th>
                      <th className={`${TH} text-right`}>Montador</th>
                      <th className={`${TH} text-right`}>Empresa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.linhas.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-slate-100 last:border-0 break-inside-avoid"
                      >
                        <td className={`${TD} whitespace-nowrap text-slate-600`}>
                          {formatarData(dataDeReferencia(m, filtros.base))}
                        </td>
                        <td className={`${TD} font-medium text-gray-900`}>
                          <Link href={`/admin/montagens/${m.id}`} className="hover:underline">
                            {m.clienteNome}
                          </Link>
                        </td>
                        <td className={`${TD} text-slate-600`}>{nomeDaOrigem(m.loja)}</td>
                        <td className={`${TD} text-slate-600`}>{responsavel(m)}</td>
                        <td className={`${TD} whitespace-nowrap text-slate-600`}>
                          {m.numeroPedido ?? "–"}
                        </td>
                        <td className={`${TD} max-w-[16rem] text-slate-600 print:max-w-none`}>
                          <span className="line-clamp-2 print:line-clamp-none">
                            {m.descricaoServico}
                          </span>
                        </td>
                        <td className={TD}>
                          <Badge className={STATUS_COLOR[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                        </td>
                        <td className={`${TD} whitespace-nowrap text-right`}>
                          {formatarMoeda(m.valorServico)}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-right`}>
                          {formatarMoeda(m.valorMontador)}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-right`}>
                          {formatarMoeda(receitaDaEmpresa(m))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
                    <tr>
                      <td className={TD} colSpan={7}>
                        Total de {TIPO_SERVICO_PLURAL[grupo.tipo].toLowerCase()}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        {formatarMoeda(grupo.totais.valorNotas)}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        {formatarMoeda(grupo.totais.comissaoMontadores)}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        {formatarMoeda(grupo.totais.receitaEmpresa)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ))}

          <p className="text-xs text-slate-500">
            “Empresa” é a receita da empresa em cada serviço, com as mesmas contas do Financeiro:
            8% da nota mais a assistência nos serviços de loja, e a nota inteira nos particulares.
            Gerado em {formatarData(new Date())}.
          </p>
        </>
      )}
    </div>
  );
}
