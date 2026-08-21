// Regras de dinheiro que valem no sistema inteiro. Antes o percentual da
// empresa estava escrito como "0.08" solto em quatro contas diferentes
// (painel e financeiro do admin) — mudar o acerto exigia caçar cada uma, e
// nada dizia o que aquele número significava.

/**
 * Percentual que a empresa cobra da loja sobre o valor da nota (o "acerto
 * padrão" combinado). A assistência da loja (Loja.percentualAssistencia,
 * gravada em cada montagem) entra por fora disso e também fica com a
 * empresa.
 */
export const PERCENTUAL_EMPRESA = 0.08;

type ValoresMontagem = { valorServico: number; valorAssistencia?: number | null };

/** O que a loja deve à empresa por uma montagem: acerto padrão + assistência. */
export function valorDevidoPelaLoja(montagem: ValoresMontagem) {
  return montagem.valorServico * PERCENTUAL_EMPRESA + (montagem.valorAssistencia || 0);
}

/** Mesma conta, mas somando uma lista de montagens. */
export function somarValorDevidoPelaLoja(montagens: ValoresMontagem[]) {
  return montagens.reduce((soma, m) => soma + valorDevidoPelaLoja(m), 0);
}
