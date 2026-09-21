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

// Prefixo dos ids inventados aqui para os envios avulsos (hoje, desmontagem
// e assistência -- montagem lançada à mão não é mais enviada, ver
// podeEnviarAoCentralSync). Do lado do CentralSync não existe entrega com
// esse id, então a confirmação chega lá como avulsa: aparece na caixa
// "Montagens Feitas" com os dados do serviço e o admin de lá decide se
// vincula a uma entrega ou só arquiva. Precisa ser estável -- é o id do
// documento do outro lado, e é ele que faz o reenvio sobrescrever o aviso
// anterior em vez de criar um segundo.
export const PREFIXO_ENTREGA_AVULSA = "mf-";

// Serviços que o CentralSync manda para cá mas que NÃO são a montagem da
// entrega: desmontagem (`DESM-`) e assistência (`ASSIST-`). Os dois chegam
// como montagem comum -- é o único tipo que este sistema tem. Ver
// DeliveriesView.tsx/darioMontagem.ts do CentralSync, onde os dois nascem.
//
// Eles ficavam sem nenhum botão de envio, então o comprovante (foto +
// assinaturas) de uma assistência não tinha como chegar à loja: o serviço era
// feito e do outro lado ninguém via. O medo era marcar a entrega original
// como MONTADA e pagar a comissão cheia de montagem -- mas quem escolhe o id
// enviado é idDaEntregaNoCentralSync, e para estes ele devolve `mf-...`
// (avulso), não o id da entrega. Do lado de lá, `completeAssembly` recusa um
// id que não existe em `deliveries`, então a confirmação entra na caixa
// "Montagens Feitas" só como comprovante para conferência: nenhuma entrega
// muda de status e nenhum acerto de montagem é gravado.
//
// O que sustenta isso é o rótulo -- ver nomeParaCentralSync, que manda
// "[ASSISTÊNCIA]"/"[DESMONTAGEM]" na frente do nome. Sem ele a linha chega
// lá parecendo uma montagem comum, e aí o risco de acerto errado volta pela
// mão de quem confere.
export const PREFIXOS_SERVICO_SEM_MONTAGEM = ["desm-", "assist-"];

/** Como cada prefixo se chama na tela da loja. */
const ROTULO_SERVICO: Record<string, string> = {
  "desm-": "DESMONTAGEM",
  "assist-": "ASSISTÊNCIA",
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

// Desmontagem ou assistência: serviço do CentralSync que não é a montagem da
// entrega (ver PREFIXOS_SERVICO_SEM_MONTAGEM).
export function ehDesmontagemOuAssistencia(numeroPedido: string | null): boolean {
  return PREFIXOS_SERVICO_SEM_MONTAGEM.some((prefixo) => comecaCom(numeroPedido, prefixo));
}

/**
 * "ASSISTÊNCIA", "DESMONTAGEM" ou null se for montagem mesmo. É o que vai na
 * frente do nome enviado à loja, para a linha não ser lida como montagem.
 */
export function rotuloDoServico(numeroPedido: string | null): string | null {
  const prefixo = PREFIXOS_SERVICO_SEM_MONTAGEM.find((p) => comecaCom(numeroPedido, p));
  return prefixo ? ROTULO_SERVICO[prefixo] ?? null : null;
}

// Se dá para mandar a conclusão desta montagem para a Central Móveis.
//
// Só o que chegou pela integração volta para lá: o pedido ("del-...") e a
// desmontagem/assistência que o CentralSync mandou junto ("DESM-"/"ASSIST-",
// ver PREFIXOS_SERVICO_SEM_MONTAGEM).
//
// Montagem lançada à mão NÃO vai, nem quando a loja escolhida é a do
// CentralSync. Durante um tempo ia, como avulsa -- mas o que é digitado no
// painel é serviço particular da empresa, fechado por fora da Central
// Móveis, e mandar o comprovante para lá punha na caixa da loja um serviço
// que não é dela.
export function podeEnviarAoCentralSync(montagem: {
  numeroPedido: string | null;
  loja?: { integraCentralSync: boolean } | null;
}): boolean {
  if (pareceIdDoCentralSync(montagem.numeroPedido)) return true;
  // Desmontagem e assistência vão como avulsas (o que diz o que cada uma é
  // fica no rótulo), e só para a loja marcada como do CentralSync: um
  // serviço desses que o admin passou para particular, ou para outra loja,
  // não tem destinatário do outro lado.
  if (ehDesmontagemOuAssistencia(montagem.numeroPedido)) {
    return Boolean(montagem.loja?.integraCentralSync);
  }
  return false;
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
// marcar a entrega como montada. Montagem lançada à mão não tem entrega
// correspondente, então vai com um id derivado do id daqui -- estável entre
// reenvios e impossível de confundir com uma entrega de verdade.
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
// O envio avulso (desmontagem, assistência) não tem entrega correspondente
// lá, então a caixa não consegue mostrar nada além do que este campo e o id
// trouxerem. Por isso aqui vai também o número do pedido e o nome do
// cliente: sem eles a confirmação chega numa linha que o pessoal da loja não
// tem como reconhecer, e o comprovante (foto + assinaturas) fica sem dono na
// tela.
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

  // Assistência e desmontagem vão com a etiqueta na frente de tudo, e não no
  // fim: o campo é cortado em 190 caracteres do outro lado, e é justamente
  // esta palavra que impede a linha de ser acertada como montagem. Cortada,
  // ela vira uma montagem comum aos olhos de quem confere.
  const rotulo = rotuloDoServico(montagem.numeroPedido);

  return [
    rotulo ? `[${rotulo}]` : "",
    quemMontou,
    numeroPedido ? `Pedido ${numeroPedido}` : "",
    montagem.clienteNome.trim(),
    rotulo
      ? "não é montagem — só comprovante, não lançar acerto de montagem"
      : "nota lançada à mão no MontaFácil",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, LIMITE_NOME_CENTRALSYNC);
}
