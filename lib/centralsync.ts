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

// Prefixo dos ids inventados aqui para as montagens lançadas à mão. Do lado
// do CentralSync não existe entrega com esse id (ela nunca passou pela
// integração), então a confirmação chega lá como montagem avulsa: aparece na
// caixa "Montagens Feitas" com os dados do serviço e o admin de lá decide se
// vincula a uma entrega ou só arquiva. Precisa ser estável -- é o id do
// documento do outro lado, e é ele que faz o reenvio sobrescrever o aviso
// anterior em vez de criar um segundo.
export const PREFIXO_ENTREGA_AVULSA = "mf-";

// Serviços que o CentralSync manda para cá mas que NÃO são a montagem da
// entrega: desmontagem (`DESM-`) e assistência (`ASSIST-`). Os dois chegam
// como montagem comum -- é o único tipo que este sistema tem --, mas mandar
// uma confirmação de montagem deles marca a entrega original como MONTADA lá
// e paga a comissão cheia de montagem, que não é o combinado.
//
// Até agora quem os segurava era só o fato de não começarem com "del-".
// Agora que a loja integrada também libera o envio (montagem lançada à mão,
// ver podeEnviarAoCentralSync), a exclusão precisa ser explícita: eles vêm
// da Central Móveis como qualquer outro pedido dela. Ver
// DeliveriesView.tsx/darioMontagem.ts do CentralSync, onde os dois nascem.
export const PREFIXOS_FORA_DA_CONFIRMACAO = ["desm-", "assist-"];

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

// Desmontagem ou assistência: serviço do CentralSync que não pode virar
// confirmação de montagem lá (ver PREFIXOS_FORA_DA_CONFIRMACAO).
export function ehDesmontagemOuAssistencia(numeroPedido: string | null): boolean {
  return PREFIXOS_FORA_DA_CONFIRMACAO.some((prefixo) => comecaCom(numeroPedido, prefixo));
}

// Se dá para mandar a conclusão desta montagem para a Central Móveis.
//
// Dois caminhos, e o segundo é o que não existia: além do pedido que chegou
// pela integração ("del-..."), também vale a montagem lançada à mão no
// painel, desde que a loja dela seja a que o CentralSync atende (marcada em
// Lojas). Sem isso, uma nota que o Dário digitava na mão ficava sem nenhum
// botão de envio -- a loja nunca via a foto e as assinaturas.
export function podeEnviarAoCentralSync(montagem: {
  numeroPedido: string | null;
  loja?: { integraCentralSync: boolean } | null;
}): boolean {
  if (pareceIdDoCentralSync(montagem.numeroPedido)) return true;
  if (!montagem.loja?.integraCentralSync) return false;
  return !ehDesmontagemOuAssistencia(montagem.numeroPedido);
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
// A montagem lançada à mão não tem entrega correspondente lá, então a caixa
// não consegue mostrar nada além do que este campo e o id trouxerem. Por
// isso aqui vai também o número do pedido e o nome do cliente: sem eles a
// confirmação chega numa linha que o pessoal da loja não tem como
// reconhecer, e o comprovante (foto + assinaturas) fica sem dono na tela.
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

  return [
    quemMontou,
    numeroPedido ? `Pedido ${numeroPedido}` : "",
    montagem.clienteNome.trim(),
    "nota lançada à mão no MontaFácil",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, LIMITE_NOME_CENTRALSYNC);
}
