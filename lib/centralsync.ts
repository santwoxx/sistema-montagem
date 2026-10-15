// Reconhece se uma montagem veio do CentralSync pelo formato do id que a
// Delivery usa (`del-<timestamp>`), gravado como numeroPedido no momento em
// que a nota pendente vira montagem. Sem essa checagem, montagens de outras
// lojas parceiras (que não têm nada a ver com o CentralSync) também
// apareceriam nessa integração à toa.
//
// Fica num arquivo à parte (em vez de lib/actions/montagens.ts) porque esse
// é um arquivo "use server" -- só pode exportar Server Actions (funções
// async), e estas são só funções utilitárias síncronas.
export const PREFIXO_PEDIDO_CENTRALSYNC = "del-";

// Prefixo dos ids inventados aqui para os envios avulsos (assistência,
// desmontagem e montagem em loja sem pedido -- ver PREFIXOS_SERVICO_AVULSO;
// montagem lançada à mão não é enviada, ver podeEnviarAoCentralSync). Do
// lado do CentralSync não existe entrega com esse id, então a confirmação
// chega lá como avulsa: aparece na caixa "Montagens Feitas" com os dados do
// serviço, e o admin de lá registra a conclusão na solicitação que a loja
// fez (achada pelo nº do pedido que vai no nome, ver nomeParaCentralSync).
// Precisa ser estável -- é o id do documento do outro lado, e é ele que faz
// o reenvio sobrescrever o aviso anterior em vez de criar um segundo.
export const PREFIXO_ENTREGA_AVULSA = "mf-";

// Montagem em loja que o CentralSync pede SEM pedido vinculado
// (`MONTLOJA-<n>`). É montagem de verdade -- só não tem entrega do lado de
// lá. A montagem em loja COM pedido vinculado não usa este prefixo: ela
// chega com o `del-…` da própria entrega e volta como qualquer pedido.
export const PREFIXO_MONTAGEM_LOJA_AVULSA = "montloja-";

// Serviços que o CentralSync manda para cá mas que NÃO são a montagem de uma
// entrega de lá. Todos chegam como montagem comum -- é o único tipo de
// registro que este sistema tem --, e nascem em DeliveriesView.tsx do
// CentralSync:
//
//   "assist-"   assistência   ASSIST-<entrega>-<dia>, ou ASSIST-<n> avulsa
//   "desm-"     desmontagem   DESM-<entrega>-<dia>, ou DESM-AVULSO-<n>
//   "montloja-" montagem em loja sem pedido vinculado, MONTLOJA-<n>
//
// Eles ficavam sem nenhum botão de envio, então o comprovante (foto +
// assinaturas) não tinha como chegar à loja: o serviço era feito e do outro
// lado ninguém via. A montagem em loja avulsa ficou de fora desta lista
// depois que assistência e desmontagem entraram, e caía em "lançada à mão":
// o Dário concluía o serviço e não tinha como mandar para a loja.
//
// O medo era marcar a entrega original como MONTADA e pagar a comissão cheia
// de montagem -- mas quem escolhe o id enviado é idDaEntregaNoCentralSync, e
// para estes ele devolve `mf-...` (avulso), não o id da entrega. Do lado de
// lá, `completeAssembly` recusa um id que não existe em `deliveries`, então a
// confirmação entra na caixa "Montagens Feitas" só para registrar a
// conclusão da solicitação: nenhuma entrega muda de status e nenhum acerto de
// montagem é gravado.
//
// O que sustenta isso é o rótulo -- ver nomeParaCentralSync, que manda
// "[ASSISTÊNCIA]"/"[DESMONTAGEM]"/"[MONTAGEM EM LOJA]" na frente do nome. Sem
// ele a linha chega lá parecendo uma montagem comum, e aí o risco de acerto
// errado volta pela mão de quem confere.
//
// Prefixo novo criado lá precisa entrar aqui (e em TIPO_PELO_PREFIXO, em
// lib/tipo-servico.ts): senão o serviço é tratado como lançado à mão e nunca
// volta para a loja -- foi o que aconteceu com a montagem em loja.
export const PREFIXOS_SERVICO_AVULSO = ["desm-", "assist-", PREFIXO_MONTAGEM_LOJA_AVULSA];

/** Como cada prefixo se chama na tela da loja. */
const ROTULO_SERVICO: Record<string, string> = {
  "desm-": "DESMONTAGEM",
  "assist-": "ASSISTÊNCIA",
  [PREFIXO_MONTAGEM_LOJA_AVULSA]: "MONTAGEM EM LOJA",
};

function comecaCom(numeroPedido: string | null, prefixo: string) {
  return (
    typeof numeroPedido === "string" &&
    numeroPedido.trim().toLowerCase().startsWith(prefixo)
  );
}

// A comparação ignora maiúsculas/minúsculas e espaços nas pontas: o número
// fica num campo de texto que o admin enxerga como "Nº do pedido" e pode
// reescrever (ver components/NovaMontagemForm.tsx). Um "DEL-1755…" colado de
// outro lugar, ou com um espaço grudado, deixava de casar aqui -- e a
// montagem sumia da fila de envio e perdia o botão na tela, sem aviso
// nenhum. Desmontagens continuam de fora: elas chegam com prefixo "DESM-",
// que não bate com "del-" nem ignorando a caixa.
export function pareceIdDoCentralSync(numeroPedido: string | null): numeroPedido is string {
  return comecaCom(numeroPedido, PREFIXO_PEDIDO_CENTRALSYNC);
}

// Assistência, desmontagem ou montagem em loja avulsa: serviço do CentralSync
// que não é a montagem de uma entrega de lá (ver PREFIXOS_SERVICO_AVULSO).
export function ehServicoAvulsoDoCentralSync(numeroPedido: string | null): boolean {
  return PREFIXOS_SERVICO_AVULSO.some((prefixo) => comecaCom(numeroPedido, prefixo));
}

/** Montagem em loja sem pedido vinculado (ver PREFIXO_MONTAGEM_LOJA_AVULSA). */
export function ehMontagemEmLojaAvulsa(numeroPedido: string | null): boolean {
  return comecaCom(numeroPedido, PREFIXO_MONTAGEM_LOJA_AVULSA);
}

/**
 * Se o nº do pedido é de algo que chegou pela integração: o pedido
 * ("del-...") ou um dos serviços avulsos que a loja pediu junto
 * (assistência, desmontagem, montagem em loja).
 */
export function veioDoCentralSync(numeroPedido: string | null): boolean {
  return pareceIdDoCentralSync(numeroPedido) || ehServicoAvulsoDoCentralSync(numeroPedido);
}

/**
 * "ASSISTÊNCIA", "DESMONTAGEM", "MONTAGEM EM LOJA" ou null se for montagem
 * de pedido (ou lançada à mão). É o que vai na frente do nome enviado à
 * loja, para a linha não ser lida como a montagem de uma entrega.
 */
export function rotuloDoServico(numeroPedido: string | null): string | null {
  const prefixo = PREFIXOS_SERVICO_AVULSO.find((p) => comecaCom(numeroPedido, p));
  return prefixo ? ROTULO_SERVICO[prefixo] ?? null : null;
}

// Se dá para mandar a conclusão desta montagem para a Central Móveis.
//
// Tudo o que chegou pela integração volta para lá, do mesmo jeito: o pedido
// ("del-...") e os serviços que o CentralSync mandou junto -- assistência,
// desmontagem e montagem em loja (ver PREFIXOS_SERVICO_AVULSO). Quem decide
// é o nº do pedido, e só ele: é um número que só o CentralSync gera, e do
// lado de lá sempre existe quem o receba (a entrega, ou a solicitação que a
// loja registrou com esse mesmo número).
//
// Os serviços dependiam também de a loja da montagem estar marcada como do
// CentralSync (Loja.integraCentralSync). Era uma condição a mais para algo
// que a loja pediu voltar para ela: com a nota caindo numa loja sem a
// marcação, ou passada para particular, o botão de envio simplesmente não
// aparecia -- e o serviço feito sumia para a loja, sem aviso dos dois lados.
// O pedido ("del-...") nunca dependeu da loja.
//
// Montagem lançada à mão NÃO vai, nem quando a loja escolhida é a do
// CentralSync. Durante um tempo ia, como avulsa -- mas o que é digitado no
// painel é serviço particular da empresa, fechado por fora da Central
// Móveis, e mandar o comprovante para lá punha na caixa da loja um serviço
// que não é dela.
export function podeEnviarAoCentralSync(montagem: { numeroPedido: string | null }): boolean {
  return veioDoCentralSync(montagem.numeroPedido);
}

/**
 * Lançada à mão numa loja do CentralSync: é justamente o caso que a tela
 * precisa explicar, porque a loja escolhida sugere que o envio existiria e
 * o botão não aparece.
 */
export function lancadaAMaoNaLojaDoCentralSync(montagem: {
  numeroPedido: string | null;
  loja?: { integraCentralSync: boolean } | null;
}): boolean {
  return Boolean(montagem.loja?.integraCentralSync) && !podeEnviarAoCentralSync(montagem);
}

// Sob qual id a confirmação é gravada do lado do CentralSync.
//
// Pedido vindo de lá vai com o próprio id da entrega, que é o que permite
// marcar a entrega como montada. Os serviços avulsos (assistência,
// desmontagem, montagem em loja sem pedido) não têm entrega correspondente,
// então vão com um id derivado do id daqui -- estável entre reenvios e
// impossível de confundir com uma entrega de verdade.
export function idDaEntregaNoCentralSync(montagem: {
  id: string;
  numeroPedido: string | null;
}): string {
  return pareceIdDoCentralSync(montagem.numeroPedido)
    ? montagem.numeroPedido
    : `${PREFIXO_ENTREGA_AVULSA}${montagem.id}`;
}

// Quanto texto cabe em `montadorNome` do outro lado: a Cloud Function do
// CentralSync corta esse campo em 200 caracteres.
const LIMITE_NOME_CENTRALSYNC = 190;

// O que vai no campo "Montado por" da caixa "Montagens Feitas" do CentralSync.
//
// Pedido vindo da integração manda só o nome de quem montou, como sempre --
// lá a entrega é achada pelo id e a tela já mostra cliente, pedido e itens.
//
// O envio avulso (assistência, desmontagem, montagem em loja sem pedido) não
// tem entrega correspondente lá, então a caixa não consegue mostrar nada além
// do que este campo e o id trouxerem. Por isso aqui vai também o número do
// pedido e o nome do cliente: sem eles a confirmação chega numa linha que o
// pessoal da loja não tem como reconhecer, e o comprovante (foto +
// assinaturas) fica sem dono na tela. É pelo "Pedido <número>" que o
// CentralSync acha a solicitação (parseServiceConfirmation, lá em
// utils/darioServiceConfirmation.ts) -- a ordem dos pedaços e o separador
// " · " fazem parte do contrato.
export function nomeParaCentralSync(montagem: {
  numeroPedido: string | null;
  clienteNome: string;
  feitoPorAdm?: boolean;
  montador?: { nome: string } | null;
}): string | null {
  // Lido antes da checagem: `pareceIdDoCentralSync` é um type guard, e no
  // ramo negativo o TypeScript passa a enxergar numeroPedido como `null` --
  // o que não é verdade (pode ser um número comum, digitado pelo admin).
  const numeroPedido = montagem.numeroPedido?.trim();

  if (pareceIdDoCentralSync(montagem.numeroPedido)) {
    return montagem.montador?.nome ?? null;
  }

  const quemMontou =
    montagem.montador?.nome?.trim() || (montagem.feitoPorAdm ? "Equipe da empresa" : "");

  // O rótulo vai na frente de tudo, e não no fim: o campo é cortado em 190
  // caracteres do outro lado, e é justamente esta palavra que impede a linha
  // de ser acertada como montagem de entrega. Cortada, ela vira uma montagem
  // comum aos olhos de quem confere.
  const rotulo = rotuloDoServico(montagem.numeroPedido);

  // A montagem em loja é montagem -- só não tem entrega para dar baixa. O
  // "não é montagem" da assistência e da desmontagem seria mentira nela.
  // As duas frases começam igual de propósito: é por esse começo que o
  // CentralSync separa o aviso do nome do cliente.
  const aviso = !rotulo
    ? "nota lançada à mão no MontaFácil"
    : ehMontagemEmLojaAvulsa(montagem.numeroPedido)
      ? "não é montagem de entrega — só registrar a conclusão"
      : "não é montagem — só comprovante, não lançar acerto de montagem";

  return [
    rotulo ? `[${rotulo}]` : "",
    quemMontou,
    numeroPedido ? `Pedido ${numeroPedido}` : "",
    montagem.clienteNome.trim(),
    aviso,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, LIMITE_NOME_CENTRALSYNC);
}
