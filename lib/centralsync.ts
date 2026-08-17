// Reconhece se uma montagem veio do CentralSync pelo formato do id que a
// Delivery usa (`del-<timestamp>`), gravado como numeroPedido no momento em
// que a nota pendente vira montagem. Sem essa checagem, montagens de outras
// lojas parceiras (que não têm nada a ver com o CentralSync) também
// apareceriam nessa integração à toa.
//
// Fica num arquivo à parte (em vez de lib/actions/montagens.ts) porque esse
// é um arquivo "use server" -- só pode exportar Server Actions (funções
// async), e esta é só uma função utilitária síncrona.
export function pareceIdDoCentralSync(numeroPedido: string | null): numeroPedido is string {
  return typeof numeroPedido === "string" && numeroPedido.startsWith("del-");
}
