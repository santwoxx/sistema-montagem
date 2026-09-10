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
// acerto de 8% nem assistência, então o valor da nota é receita cheia da
// empresa.

import type { Prisma } from "@prisma/client";

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
