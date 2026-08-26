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

/**
 * Arredonda para centavos.
 *
 * Os valores são gravados como `Float` (double precision no Postgres), que
 * não representa exatamente valores decimais: 0,07 + 0,01 dá
 * 0,08000000000000002, e somar centenas de montagens vai empilhando sobras
 * dessas. O erro é pequeno demais para virar um centavo na tela, mas passa
 * a existir em comparações (`total === outroTotal` dando falso sem motivo) e
 * em contas encadeadas. Fechar cada resultado em centavos aqui corta o
 * assunto antes que ele chegue a qualquer lugar.
 *
 * A correção de raiz é a coluna virar `Decimal` no banco -- mudança que
 * atravessa o schema, as agregações e o que é passado aos componentes de
 * cliente, e por isso merece um passo próprio.
 */
export function emCentavos(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

type ValoresMontagem = { valorServico: number; valorAssistencia?: number | null };

/** O que a loja deve à empresa por uma montagem: acerto padrão + assistência. */
export function valorDevidoPelaLoja(montagem: ValoresMontagem) {
  return emCentavos(
    montagem.valorServico * PERCENTUAL_EMPRESA + (montagem.valorAssistencia || 0)
  );
}

/** Mesma conta, mas somando uma lista de montagens. */
export function somarValorDevidoPelaLoja(montagens: ValoresMontagem[]) {
  return emCentavos(
    montagens.reduce((soma, m) => soma + valorDevidoPelaLoja(m), 0)
  );
}

/** Soma uma lista de valores em dinheiro, fechando o total em centavos. */
export function somarDinheiro(valores: Array<number | null | undefined>) {
  return emCentavos(valores.reduce<number>((soma, v) => soma + (v ?? 0), 0));
}
