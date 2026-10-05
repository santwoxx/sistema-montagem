// De onde veio o serviço: de uma loja parceira ou fechado direto com o
// cliente ("particular").
//
// Uma montagem particular é simplesmente uma montagem sem loja
// (`lojaId === null`). Guardar isso como a ausência da loja, em vez de um
// campo "ehParticular" ao lado do `lojaId`, evita o estado impossível de
// uma montagem marcada como particular e ainda apontando para uma loja --
// que o banco aceitaria e cada tela interpretaria de um jeito.
//
// O que muda no dinheiro está em lib/financeiro.ts: sem loja não existe
// acerto nem assistência, então o valor da nota é receita cheia da
// empresa.

import type { Prisma, TipoServico } from "@prisma/client";

export const ORIGENS = ["todas", "loja", "particular"] as const;
export type Origem = (typeof ORIGENS)[number];

/** Nome para mostrar na tela no lugar da loja. */
export const NOME_PARTICULAR = "Particular";

/** Lê o filtro de origem que veio da URL, caindo em "todas" se vier lixo. */
export function lerOrigem(valor: string | undefined | null): Origem {
  return ORIGENS.includes(valor as Origem) ? (valor as Origem) : "todas";
}

/** Uma montagem é particular quando não tem loja. */
export function ehParticular(montagem: { lojaId?: string | null }): boolean {
  return !montagem.lojaId;
}

/** O que mostrar na linha "loja" de uma montagem. */
export function nomeDaOrigem(loja: { nome: string } | null | undefined): string {
  return loja?.nome ?? NOME_PARTICULAR;
}

/**
 * Recorte de `where` para o filtro de origem. Devolve `{}` para "todas",
 * para poder ser espalhado num where existente sem apagar nada.
 */
export function filtroDeOrigem(origem: Origem): Prisma.MontagemWhereInput {
  if (origem === "particular") return { lojaId: null };
  if (origem === "loja") return { lojaId: { not: null } };
  return {};
}

/**
 * Rótulo de quem deve o dinheiro da montagem. Numa montagem de loja quem
 * paga a empresa é a loja; num particular é o próprio cliente -- e a tela
 * dizer "Loja pagou?" num serviço particular confunde na hora de acertar.
 */
export function quemPaga(montagem: { lojaId?: string | null }): string {
  return ehParticular(montagem) ? "Cliente" : "Loja";
}

/**
 * Valor que o `<select>` de loja usa para "serviço particular".
 *
 * O campo é o mesmo `lojaId` do formulário de montagem: um valor reservado
 * evita um segundo controle (um checkbox "é particular") que poderia
 * discordar da loja escolhida. O servidor troca isto por `null` ao gravar
 * (ver lib/actions/montagens.ts).
 */
export const VALOR_PARTICULAR_FORM = "PARTICULAR";

/** Traduz o que veio do formulário para o que vai no banco. */
export function lojaIdDoFormulario(valor: string): string | null {
  const limpo = valor.trim();
  return !limpo || limpo === VALOR_PARTICULAR_FORM ? null : limpo;
}

/**
 * Se uma montagem NOVA nasce particular, independentemente da loja escolhida.
 *
 * Só o que chega pela integração do CentralSync é serviço de loja. O que é
 * lançado no painel -- digitado ou importado por foto/XML da nota fiscal --
 * é serviço fechado direto pela empresa: a nota inteira é dela e não há
 * assistência a cobrar de ninguém. Antes a importação escolhia sozinha a
 * loja que aparece na nota fiscal, e a montagem entrava no financeiro como
 * 8% + assistência de uma loja que não tinha nada a ver com o serviço.
 *
 * As exceções: a montagem em loja (mostruário), em que a loja é a
 * cliente; e a loja parceira sem integração (Loja.lancamentoManual, ex.:
 * Simonetti), cujos serviços só chegam lançados à mão e precisam continuar
 * na pasta dela.
 *
 * Vale só para montagem nova -- as antigas ficam como foram lançadas, e
 * editar uma montagem continua deixando escolher a loja.
 */
export function lancadaComoParticular(montagem: {
  daIntegracao: boolean;
  tipoServico: TipoServico | string;
  /** Se a loja escolhida é parceira com lançamento manual. */
  lojaLancamentoManual?: boolean;
}): boolean {
  return (
    !montagem.daIntegracao &&
    montagem.tipoServico !== "MONTAGEM_LOJA" &&
    !montagem.lojaLancamentoManual
  );
}

function normalizarNome(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * A loja parceira (lançamento manual) que emitiu a nota fiscal importada,
 * se houver: pelo CNPJ, ou pelo nome da loja aparecendo no nome do emitente
 * ("Simonetti" em "SIMONETTI COMERCIO DE MOVEIS LTDA"). Só procura entre as
 * parceiras -- nota de qualquer outra loja continua sendo particular.
 */
export function acharLojaParceira<
  L extends { nome: string; cnpj?: string | null; lancamentoManual?: boolean },
>(lojas: L[], emitente: { nome?: string | null; cnpj?: string | null }): L | null {
  const parceiras = lojas.filter((l) => l.lancamentoManual);
  const cnpj = String(emitente.cnpj ?? "").replace(/\D/g, "");
  if (cnpj.length === 14) {
    const peloCnpj = parceiras.find((l) => String(l.cnpj ?? "").replace(/\D/g, "") === cnpj);
    if (peloCnpj) return peloCnpj;
  }
  const nome = ` ${normalizarNome(emitente.nome ?? "")} `;
  if (!nome.trim()) return null;
  return (
    parceiras.find((l) => {
      const palavras = palavrasQueIdentificam(l.nome);
      return palavras.length > 0 && palavras.every((p) => nome.includes(` ${p} `));
    }) ?? null
  );
}

// Palavras que aparecem no nome de qualquer loja e não dizem qual é: o
// cadastro diz "Simonetti Móveis" e a nota diz "SIMONETTI COMERCIO DE
// MOVEIS LTDA" -- o que precisa bater é o "simonetti".
const PALAVRAS_GENERICAS = new Set([
  "moveis", "movel", "loja", "lojas", "comercio", "comercial", "ltda", "eireli",
  "me", "epp", "sa", "de", "da", "do", "das", "dos", "e", "filial", "matriz",
]);

function palavrasQueIdentificam(nomeDaLoja: string) {
  return normalizarNome(nomeDaLoja)
    .split(" ")
    .filter((p) => p.length >= 3 && !PALAVRAS_GENERICAS.has(p));
}
