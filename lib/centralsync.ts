// Reconhece se uma montagem veio do CentralSync pelo formato do id que a
// Delivery usa (`del-<timestamp>`), gravado como numeroPedido no momento em
// que a nota pendente vira montagem. Sem essa checagem, montagens de outras
// lojas parceiras (que não têm nada a ver com o CentralSync) também
// apareceriam nessa integração à toa.
//
// Fica num arquivo à parte (em vez de lib/actions/montagens.ts) porque esse
// é um arquivo "use server" -- só pode exportar Server Actions (funções
// async), e esta é só uma função utilitária síncrona.
export const PREFIXO_PEDIDO_CENTRALSYNC = "del-";

// A comparação ignora maiúsculas/minúsculas e espaços nas pontas: o número
// fica num campo de texto que o admin enxerga como "Nº do pedido" e pode
// reescrever (ver components/NovaMontagemForm.tsx). Um "DEL-1755…" colado de
// outro lugar, ou com um espaço grudado, deixava de casar aqui -- e a
// montagem sumia da fila de envio e perdia o botão na tela, sem aviso
// nenhum. Desmontagens continuam de fora: elas chegam com prefixo "DESM-",
// que não bate com "del-" nem ignorando a caixa.
export function pareceIdDoCentralSync(numeroPedido: string | null): numeroPedido is string {
  return (
    typeof numeroPedido === "string" &&
    numeroPedido.trim().toLowerCase().startsWith(PREFIXO_PEDIDO_CENTRALSYNC)
  );
}
