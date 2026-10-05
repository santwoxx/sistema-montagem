// Relatório detalhado (Financeiro -> Relatório detalhado): montagens,
// assistências, desmontagens e montagens em loja de um período, com resumo
// por tipo, por montador e por loja, e a lista completa.
//
// Só regras e contas -- a consulta ao banco mora em
// lib/consultar-relatorio.ts, para isto ser testado sem banco. O dinheiro
// segue exatamente as contas do Financeiro (lib/financeiro.ts): o relatório
// não pode dar um número diferente da tela ao lado para o mesmo período.

import type { Prisma, StatusMontagem, TipoServico } from "@prisma/client";
import { intervaloDoDia, partesNoFuso } from "@/lib/datas";
import { emCentavos, receitaDaEmpresa, somarDinheiro } from "@/lib/financeiro";
import { formatarData, STATUS_LABEL } from "@/lib/format";
import { nomeDaOrigem, VALOR_PARTICULAR_FORM } from "@/lib/servico";
import { lerTipoServico, TIPO_SERVICO_LABEL, TIPOS_SERVICO } from "@/lib/tipo-servico";

/** Valor do filtro de loja para "só serviços de loja" (o oposto de particular). */
export const VALOR_SO_LOJAS = "LOJAS";
/** Valores do filtro de montador que não são um montador. */
export const MONTADOR_NENHUM = "nenhum";
export const MONTADOR_ADM = "ADM";
export const NOME_ADM = "A própria empresa (ADM)";
export const NOME_SEM_MONTADOR = "Sem montador";

export const SITUACOES = ["ativas", "concluidas", "abertas", "canceladas", "todas"] as const;
export type Situacao = (typeof SITUACOES)[number];
export const SITUACAO_LABEL: Record<Situacao, string> = {
  ativas: "Todas, menos as canceladas",
  concluidas: "Só concluídas",
  abertas: "Só em aberto (pendentes e em andamento)",
  canceladas: "Só canceladas",
  todas: "Todas, inclusive canceladas",
};

export type FiltrosRelatorio = {
  /** "AAAA-MM-DD", inclusive nas duas pontas. */
  de: string;
  ate: string;
  base: "cadastro" | "conclusao";
  tipo: TipoServico | null;
  situacao: Situacao;
  /** "", VALOR_SO_LOJAS, VALOR_PARTICULAR_FORM ou o id de uma loja. */
  lojaId: string;
  /** "", MONTADOR_NENHUM, MONTADOR_ADM ou o id de um montador. */
  montadorId: string;
};

type Parametros = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

function diaComoTexto(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Os filtros que vieram da URL, já validados. Sem período escolhido (ou com
 * um inválido), vale o mês corrente inteiro no fuso do negócio.
 */
export function lerFiltrosRelatorio(params: Parametros, agora = new Date()): FiltrosRelatorio {
  const hoje = partesNoFuso(agora);
  const ultimoDiaDoMes = new Date(Date.UTC(hoje.ano, hoje.mes, 0)).getUTCDate();
  const padraoDe = diaComoTexto(hoje.ano, hoje.mes, 1);
  const padraoAte = diaComoTexto(hoje.ano, hoje.mes, ultimoDiaDoMes);

  let de = intervaloDoDia(primeiro(params.de)) ? primeiro(params.de) : padraoDe;
  let ate = intervaloDoDia(primeiro(params.ate)) ? primeiro(params.ate) : padraoAte;
  // Datas invertidas viram o mesmo período, em vez de um relatório vazio.
  if (de > ate) [de, ate] = [ate, de];

  const situacao = primeiro(params.situacao) as Situacao;

  return {
    de,
    ate,
    base: primeiro(params.base) === "conclusao" ? "conclusao" : "cadastro",
    tipo: lerTipoServico(primeiro(params.tipo)),
    situacao: SITUACOES.includes(situacao) ? situacao : "ativas",
    lojaId: primeiro(params.lojaId),
    montadorId: primeiro(params.montadorId),
  };
}

/** Os filtros de volta em parâmetros de URL (para o link da planilha). */
export function filtrosParaUrl(f: FiltrosRelatorio): string {
  const p = new URLSearchParams({ de: f.de, ate: f.ate, base: f.base, situacao: f.situacao });
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.lojaId) p.set("lojaId", f.lojaId);
  if (f.montadorId) p.set("montadorId", f.montadorId);
  return p.toString();
}

const STATUS_DA_SITUACAO: Record<Situacao, Prisma.MontagemWhereInput> = {
  ativas: { status: { not: "CANCELADO" } },
  concluidas: { status: "CONCLUIDO" },
  abertas: { status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
  canceladas: { status: "CANCELADO" },
  todas: {},
};

/** O `where` da consulta. Mesma régua de datas do Financeiro. */
export function whereDoRelatorio(f: FiltrosRelatorio): Prisma.MontagemWhereInput {
  const inicio = intervaloDoDia(f.de)!.inicio;
  const fim = intervaloDoDia(f.ate)!.fim;
  const campoData = f.base === "conclusao" ? "concluidoEm" : "createdAt";

  const where: Prisma.MontagemWhereInput = {
    [campoData]: { gte: inicio, lt: fim },
    ...STATUS_DA_SITUACAO[f.situacao],
  };
  if (f.tipo) where.tipoServico = f.tipo;

  if (f.lojaId === VALOR_PARTICULAR_FORM) where.lojaId = null;
  else if (f.lojaId === VALOR_SO_LOJAS) where.lojaId = { not: null };
  else if (f.lojaId) where.lojaId = f.lojaId;

  if (f.montadorId === MONTADOR_ADM) where.feitoPorAdm = true;
  else if (f.montadorId === MONTADOR_NENHUM) {
    where.montadorId = null;
    where.feitoPorAdm = false;
  } else if (f.montadorId) where.montadorId = f.montadorId;

  return where;
}

/** O que cada montagem precisa trazer do banco para o relatório. */
export type LinhaRelatorio = {
  id: string;
  tipoServico: TipoServico;
  status: StatusMontagem;
  createdAt: Date;
  dataAgendada: Date | null;
  concluidoEm: Date | null;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEndereco: string;
  numeroPedido: string | null;
  descricaoServico: string;
  valorServico: number;
  valorMontador: number;
  valorAssistencia: number;
  lojaId: string | null;
  montadorId: string | null;
  pagoPelaLoja: boolean;
  pagoAoMontador: boolean;
  feitoPorAdm: boolean;
  loja: { nome: string } | null;
  montador: { nome: string } | null;
};

/** A data que define o período de cada montagem, conforme a base escolhida. */
export function dataDeReferencia(m: LinhaRelatorio, base: FiltrosRelatorio["base"]) {
  return base === "conclusao" ? m.concluidoEm : m.createdAt;
}

/** Quem fez o serviço, como aparece no relatório. */
export function responsavel(m: Pick<LinhaRelatorio, "feitoPorAdm" | "montador">): string {
  if (m.feitoPorAdm) return NOME_ADM;
  return m.montador?.nome ?? NOME_SEM_MONTADOR;
}

export type Totais = {
  quantidade: number;
  concluidas: number;
  valorNotas: number;
  comissaoMontadores: number;
  receitaEmpresa: number;
  lucroEmpresa: number;
};

export function totalizar(linhas: LinhaRelatorio[]): Totais {
  const valorNotas = somarDinheiro(linhas.map((m) => m.valorServico));
  const comissaoMontadores = somarDinheiro(linhas.map((m) => m.valorMontador));
  const receitaEmpresa = somarDinheiro(linhas.map((m) => receitaDaEmpresa(m)));
  return {
    quantidade: linhas.length,
    concluidas: linhas.filter((m) => m.status === "CONCLUIDO").length,
    valorNotas,
    comissaoMontadores,
    receitaEmpresa,
    lucroEmpresa: emCentavos(receitaEmpresa - comissaoMontadores),
  };
}

/** Os quatro tipos sempre, na mesma ordem, mesmo os que ficaram zerados. */
export function resumoPorTipo(linhas: LinhaRelatorio[]) {
  return TIPOS_SERVICO.map((tipo) => ({
    tipo,
    ...totalizar(linhas.filter((m) => m.tipoServico === tipo)),
  }));
}

export type ContagemPorTipo = Record<TipoServico, number>;

function contarPorTipo(linhas: LinhaRelatorio[]): ContagemPorTipo {
  const contagem = Object.fromEntries(TIPOS_SERVICO.map((t) => [t, 0])) as ContagemPorTipo;
  for (const m of linhas) contagem[m.tipoServico] += 1;
  return contagem;
}

// Agrupa pelo id, não pelo nome: duas lojas (ou dois montadores) com o
// mesmo nome não podem virar uma linha só.
function agrupar(linhas: LinhaRelatorio[], chave: (m: LinhaRelatorio) => string) {
  const grupos = new Map<string, LinhaRelatorio[]>();
  for (const m of linhas) {
    const k = chave(m);
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }
  return grupos;
}

function porQuantidadeENome<T extends { nome: string; quantidade: number }>(a: T, b: T) {
  return b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR");
}

/** Quanto cada montador fez de cada tipo, quanto ganhou e quanto falta pagar. */
export function resumoPorMontador(linhas: LinhaRelatorio[]) {
  const chave = (m: LinhaRelatorio) =>
    m.feitoPorAdm ? MONTADOR_ADM : (m.montadorId ?? MONTADOR_NENHUM);
  return [...agrupar(linhas, chave)]
    .map(([chave, doMontador]) => ({
      chave,
      nome: responsavel(doMontador[0]!),
      porTipo: contarPorTipo(doMontador),
      quantidade: doMontador.length,
      comissao: somarDinheiro(doMontador.map((m) => m.valorMontador)),
      aPagar: somarDinheiro(
        doMontador.filter((m) => !m.pagoAoMontador).map((m) => m.valorMontador)
      ),
    }))
    .sort(porQuantidadeENome);
}

/** Quanto cada loja (e os particulares) gerou de cada tipo e o que deve. */
export function resumoPorLoja(linhas: LinhaRelatorio[]) {
  return [...agrupar(linhas, (m) => m.lojaId ?? VALOR_PARTICULAR_FORM)]
    .map(([chave, daLoja]) => ({
      chave,
      nome: nomeDaOrigem(daLoja[0]!.loja),
      particular: daLoja[0]!.lojaId === null,
      porTipo: contarPorTipo(daLoja),
      quantidade: daLoja.length,
      valorNotas: somarDinheiro(daLoja.map((m) => m.valorServico)),
      devidoAEmpresa: somarDinheiro(daLoja.map((m) => receitaDaEmpresa(m))),
      aReceber: somarDinheiro(
        daLoja.filter((m) => !m.pagoPelaLoja).map((m) => receitaDaEmpresa(m))
      ),
    }))
    .sort(porQuantidadeENome);
}

/**
 * A lista completa, separada por tipo (na ordem de TIPOS_SERVICO) e, dentro
 * de cada tipo, em ordem de data. Tipos sem nenhuma montagem ficam de fora.
 */
export function listaPorTipo(linhas: LinhaRelatorio[], base: FiltrosRelatorio["base"]) {
  const tempo = (m: LinhaRelatorio) => dataDeReferencia(m, base)?.getTime() ?? 0;
  return TIPOS_SERVICO.map((tipo) => {
    const doTipo = linhas
      .filter((m) => m.tipoServico === tipo)
      .sort((a, b) => tempo(a) - tempo(b) || a.clienteNome.localeCompare(b.clienteNome, "pt-BR"));
    return { tipo, linhas: doTipo, totais: totalizar(doTipo) };
  }).filter((grupo) => grupo.linhas.length > 0);
}

// ---------------------------------------------------------------- planilha

/** Número no formato que o Excel em português lê como número: "1234,50". */
function numeroPlanilha(valor: number) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

/**
 * Uma célula de texto pronta para o CSV.
 *
 * Nome, endereço e descrição chegam de fora (nota fiscal, CentralSync e o
 * link público de agendamento, que qualquer pessoa preenche). Texto que
 * começa com "=", "+", "-" ou "@" o Excel executa como fórmula ao abrir --
 * o apóstrofo na frente faz ele mostrar o texto, sem executar.
 */
export function celulaTexto(valor: string | null | undefined) {
  let texto = String(valor ?? "");
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const SIM_NAO = (valor: boolean) => (valor ? "Sim" : "Não");

/**
 * O relatório como planilha (CSV no padrão do Excel em português: ";" entre
 * colunas, vírgula decimal e BOM para os acentos abrirem certos).
 */
export function gerarPlanilha(linhas: LinhaRelatorio[], base: FiltrosRelatorio["base"]): string {
  const cabecalho = [
    "Tipo",
    "Situação",
    "Cadastrada em",
    "Agendada para",
    "Concluída em",
    "Cliente",
    "Telefone",
    "Endereço",
    "Loja",
    "Montador",
    "Nº do pedido",
    "Serviço",
    "Valor da nota",
    "Comissão do montador",
    "Assistência",
    "Receita da empresa",
    "Pago pela loja/cliente",
    "Pago ao montador",
  ];

  const corpo = listaPorTipo(linhas, base).flatMap((grupo) =>
    grupo.linhas.map((m) =>
      [
        celulaTexto(TIPO_SERVICO_LABEL[m.tipoServico]),
        celulaTexto(STATUS_LABEL[m.status]),
        formatarData(m.createdAt),
        m.dataAgendada ? formatarData(m.dataAgendada) : "",
        m.concluidoEm ? formatarData(m.concluidoEm) : "",
        celulaTexto(m.clienteNome),
        celulaTexto(m.clienteTelefone),
        celulaTexto(m.clienteEndereco),
        celulaTexto(nomeDaOrigem(m.loja)),
        celulaTexto(responsavel(m)),
        celulaTexto(m.numeroPedido),
        celulaTexto(m.descricaoServico),
        numeroPlanilha(m.valorServico),
        numeroPlanilha(m.valorMontador),
        numeroPlanilha(m.valorAssistencia),
        numeroPlanilha(receitaDaEmpresa(m)),
        SIM_NAO(m.pagoPelaLoja),
        SIM_NAO(m.pagoAoMontador),
      ].join(";")
    )
  );

  return "﻿" + [cabecalho.map(celulaTexto).join(";"), ...corpo].join("\r\n") + "\r\n";
}
