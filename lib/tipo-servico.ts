// O que foi feito numa montagem: montagem na casa do cliente, assistência,
// desmontagem ou montagem em loja (mostruário, peça de exposição).
//
// É classificação para os relatórios -- não mexe em comissão, assistência
// nem na integração. O envio ao CentralSync continua decidido pelo nº do
// pedido (lib/centralsync.ts), porque é o id que o outro sistema reconhece.

import type { TipoServico } from "@prisma/client";

export const TIPOS_SERVICO = [
  "MONTAGEM",
  "ASSISTENCIA",
  "DESMONTAGEM",
  "MONTAGEM_LOJA",
] as const satisfies readonly TipoServico[];

export const TIPO_SERVICO_LABEL: Record<TipoServico, string> = {
  MONTAGEM: "Montagem",
  ASSISTENCIA: "Assistência",
  DESMONTAGEM: "Desmontagem",
  MONTAGEM_LOJA: "Montagem em loja",
};

export const TIPO_SERVICO_PLURAL: Record<TipoServico, string> = {
  MONTAGEM: "Montagens",
  ASSISTENCIA: "Assistências",
  DESMONTAGEM: "Desmontagens",
  MONTAGEM_LOJA: "Montagens em loja",
};

export const TIPO_SERVICO_COLOR: Record<TipoServico, string> = {
  MONTAGEM: "bg-slate-100 text-slate-700 border border-slate-200",
  ASSISTENCIA: "bg-violet-100 text-violet-800 border border-violet-200",
  DESMONTAGEM: "bg-orange-100 text-orange-800 border border-orange-200",
  MONTAGEM_LOJA: "bg-sky-100 text-sky-800 border border-sky-200",
};

// Os prefixos que o CentralSync põe no nº do pedido de assistência e de
// desmontagem (os mesmos de PREFIXOS_SERVICO_SEM_MONTAGEM em
// lib/centralsync.ts -- o teste confere que os dois concordam).
const TIPO_PELO_PREFIXO: Array<[prefixo: string, tipo: TipoServico]> = [
  ["assist-", "ASSISTENCIA"],
  ["desm-", "DESMONTAGEM"],
];

/**
 * O tipo que o nº do pedido indica. É o que preenche o campo quando uma nota
 * do CentralSync vira montagem, e o que a migração usou para classificar as
 * montagens antigas.
 */
export function tipoPeloPedido(numeroPedido: string | null | undefined): TipoServico {
  const normalizado = String(numeroPedido ?? "").trim().toLowerCase();
  const achado = TIPO_PELO_PREFIXO.find(([prefixo]) => normalizado.startsWith(prefixo));
  return achado ? achado[1] : "MONTAGEM";
}

/** Lê o tipo vindo de formulário ou URL; null se não for um tipo conhecido. */
export function lerTipoServico(valor: unknown): TipoServico | null {
  return TIPOS_SERVICO.includes(valor as TipoServico) ? (valor as TipoServico) : null;
}
