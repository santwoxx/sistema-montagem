import { describe, expect, it } from "vitest";
import {
  ehMontagemEmLojaAvulsa,
  ehServicoAvulsoDoCentralSync,
  entraNaFilaDoPainel,
  filtroDaFilaDoPainel,
  idDaEntregaNoCentralSync,
  INICIO_REGRA_SERVICOS_AVULSOS,
  lancadaAMaoNaLojaDoCentralSync,
  nomeParaCentralSync,
  pareceIdDoCentralSync,
  podeEnviarAoCentralSync,
  rotuloDoServico,
} from "@/lib/centralsync";

// Quem responde por esta função é a fila "Prontas para enviar ao CentralSync"
// do painel e o botão de envio da tela da montagem: um "não" errado aqui faz
// a montagem sumir das duas telas sem nenhum aviso.
describe("pareceIdDoCentralSync", () => {
  it("reconhece o id de entrega que o CentralSync manda", () => {
    expect(pareceIdDoCentralSync("del-1755123456789")).toBe(true);
  });

  it("ignora maiúsculas e espaços nas pontas do número digitado à mão", () => {
    expect(pareceIdDoCentralSync("DEL-1755123456789")).toBe(true);
    expect(pareceIdDoCentralSync("Del-1755123456789")).toBe(true);
    expect(pareceIdDoCentralSync("  del-1755123456789  ")).toBe(true);
  });

  it("deixa a desmontagem de fora, mesmo ignorando a caixa", () => {
    // Desmontagem chega com prefixo "DESM-" de propósito: se casasse aqui,
    // receberia a comissão de montagem e liberaria o aviso de conclusão, que
    // marcaria a entrega original como montada de novo.
    expect(pareceIdDoCentralSync("DESM-1755123456789")).toBe(false);
    expect(pareceIdDoCentralSync("desm-1755123456789")).toBe(false);
  });

  it("recusa pedido de outra loja, número vazio e ausência de número", () => {
    expect(pareceIdDoCentralSync("12345")).toBe(false);
    expect(pareceIdDoCentralSync("NF-del-99")).toBe(false);
    expect(pareceIdDoCentralSync("")).toBe(false);
    expect(pareceIdDoCentralSync(null)).toBe(false);
  });
});

// Loja marcada como atendida pelo CentralSync (a Central Móveis).
const LOJA_CENTRALSYNC = { integraCentralSync: true };
const LOJA_QUALQUER = { integraCentralSync: false };

// Número que o CentralSync gera para a montagem em loja sem pedido vinculado
// (newDarioRequestId("MONTLOJA") em utils/ids.ts de lá).
const MONTAGEM_LOJA_AVULSA = "MONTLOJA-1788892226229-ar1jh";

// É esta função que decide se o botão "Enviar para a Central Móveis" aparece
// na tela da montagem e se ela entra na fila do painel. Um "sim" a mais aqui
// manda para a loja um serviço que não é dela; um "não" a mais deixa o
// Dário sem jeito nenhum de mandar a foto.
describe("podeEnviarAoCentralSync", () => {
  it("libera o pedido que veio da integração", () => {
    expect(podeEnviarAoCentralSync({ numeroPedido: "del-1755123456789" })).toBe(true);
  });

  it("não libera montagem lançada à mão", () => {
    // O que é digitado no painel é serviço particular da empresa: mandar o
    // comprovante para a Central Móveis punha na caixa deles um serviço que
    // não é da loja. Já foi liberado; não é mais.
    expect(podeEnviarAoCentralSync({ numeroPedido: "696228" })).toBe(false);
    // Nº do pedido é opcional no formulário -- sem ele também não vai.
    expect(podeEnviarAoCentralSync({ numeroPedido: null })).toBe(false);
    // Um número que só CONTÉM um prefixo em outro lugar não passa por algo
    // que veio da integração.
    expect(podeEnviarAoCentralSync({ numeroPedido: "NF-del-99" })).toBe(false);
    expect(podeEnviarAoCentralSync({ numeroPedido: "NF-MONTLOJA-99" })).toBe(false);
  });

  it("deixa enviar a montagem em loja sem pedido que o CentralSync mandou", () => {
    // O caso que quebrou: o Dário concluiu uma montagem em loja, e a tela
    // dizia "Lançada à mão: é tratada como serviço particular" -- o prefixo
    // MONTLOJA- não casava com nada aqui, então não havia botão de envio.
    expect(podeEnviarAoCentralSync({ numeroPedido: MONTAGEM_LOJA_AVULSA })).toBe(true);
    expect(podeEnviarAoCentralSync({ numeroPedido: "  montloja-1788892226229-ar1jh " })).toBe(true);
    expect(
      lancadaAMaoNaLojaDoCentralSync({ numeroPedido: MONTAGEM_LOJA_AVULSA, loja: LOJA_CENTRALSYNC })
    ).toBe(false);
  });

  it("deixa enviar assistência e desmontagem", () => {
    // Elas ficavam sem botão nenhum, e o comprovante do serviço não chegava
    // à loja. Vão como avulsas (idDaEntregaNoCentralSync devolve "mf-…", não
    // o id da entrega), então lá nada é marcado como montado -- o que impede
    // o acerto errado é o rótulo, testado logo abaixo.
    expect(
      podeEnviarAoCentralSync({ numeroPedido: "DESM-del-1755123456789-2026-08-27" })
    ).toBe(true);
    expect(
      podeEnviarAoCentralSync({ numeroPedido: "ASSIST-del-1755123456789-2026-08-27" })
    ).toBe(true);
    expect(podeEnviarAoCentralSync({ numeroPedido: "DESM-AVULSO-1788892226229-k2m9x" })).toBe(
      true
    );
  });

  it("devolve o que veio da integração seja qual for a loja escolhida aqui", () => {
    // Os serviços dependiam de a loja estar marcada como do CentralSync:
    // com a nota caindo numa loja sem a marcação, ou passada para
    // particular, o botão sumia e o serviço que a loja pediu nunca voltava
    // para ela. O pedido ("del-...") nunca dependeu da loja; os serviços
    // agora também não -- voltam "igual às montagens comuns".
    const numeros = [
      "del-1755123456789",
      "ASSIST-1755123456789",
      "DESM-AVULSO-1755123456789",
      MONTAGEM_LOJA_AVULSA,
    ];
    for (const loja of [LOJA_CENTRALSYNC, LOJA_QUALQUER, null]) {
      for (const numeroPedido of numeros) {
        const montagem = { numeroPedido, loja };
        expect(podeEnviarAoCentralSync(montagem)).toBe(true);
      }
    }
  });

  it("aponta a montagem manual na loja do CentralSync, que a tela precisa explicar", () => {
    expect(
      lancadaAMaoNaLojaDoCentralSync({ numeroPedido: "696228", loja: LOJA_CENTRALSYNC })
    ).toBe(true);
    // Nas outras combinações não há o que explicar: ou o envio existe, ou a
    // loja nem sugere que existiria.
    expect(
      lancadaAMaoNaLojaDoCentralSync({ numeroPedido: "del-1755123456789", loja: LOJA_CENTRALSYNC })
    ).toBe(false);
    expect(
      lancadaAMaoNaLojaDoCentralSync({
        numeroPedido: "ASSIST-del-1755123456789-2026-08-27",
        loja: LOJA_CENTRALSYNC,
      })
    ).toBe(false);
    expect(
      lancadaAMaoNaLojaDoCentralSync({ numeroPedido: "696228", loja: LOJA_QUALQUER })
    ).toBe(false);
    expect(lancadaAMaoNaLojaDoCentralSync({ numeroPedido: "696228", loja: null })).toBe(false);
  });
});

// A fila "Prontas para enviar ao CentralSync" do painel. Quando a regra de
// 15/10/2026 passou a reconhecer a montagem em loja (MONTLOJA-), todas as do
// mês passado -- que nunca tiveram botão e já tinham sido resolvidas por
// fora -- caíram de uma vez nesta fila.
describe("entraNaFilaDoPainel", () => {
  const SETEMBRO = new Date("2026-09-22T19:26:49.000Z");
  const ANTES_DA_REGRA = new Date("2026-10-15T02:59:59.000Z");
  const HOJE = new Date("2026-10-15T20:00:00.000Z");

  it("deixa de fora a montagem em loja concluída antes da regra", () => {
    // O caso da tela do Dário: "Entrega MONTLOJA-17900…", concluídas em setembro.
    for (const loja of [LOJA_CENTRALSYNC, LOJA_QUALQUER, null]) {
      expect(
        entraNaFilaDoPainel({ numeroPedido: "MONTLOJA-1790105209600-ab12c", concluidoEm: SETEMBRO, loja })
      ).toBe(false);
    }
    expect(
      entraNaFilaDoPainel({ numeroPedido: MONTAGEM_LOJA_AVULSA, concluidoEm: ANTES_DA_REGRA, loja: LOJA_CENTRALSYNC })
    ).toBe(false);
    expect(
      entraNaFilaDoPainel({ numeroPedido: MONTAGEM_LOJA_AVULSA, concluidoEm: null, loja: LOJA_CENTRALSYNC })
    ).toBe(false);
    // Fora da fila não quer dizer sem envio: o botão da tela continua.
    expect(podeEnviarAoCentralSync({ numeroPedido: "MONTLOJA-1790105209600-ab12c" })).toBe(true);
  });

  it("põe na fila a montagem em loja concluída a partir da regra", () => {
    expect(
      entraNaFilaDoPainel({ numeroPedido: MONTAGEM_LOJA_AVULSA, concluidoEm: HOJE, loja: LOJA_CENTRALSYNC })
    ).toBe(true);
    expect(
      entraNaFilaDoPainel({
        numeroPedido: MONTAGEM_LOJA_AVULSA,
        concluidoEm: INICIO_REGRA_SERVICOS_AVULSOS,
        loja: null,
      })
    ).toBe(true);
  });

  it("mantém na fila o que já ia antes da regra, de qualquer data", () => {
    // Pedido da integração: sempre foi para a fila.
    expect(
      entraNaFilaDoPainel({ numeroPedido: "del-1755123456789", concluidoEm: SETEMBRO, loja: null })
    ).toBe(true);
    // Assistência e desmontagem da loja do CentralSync: também já iam.
    expect(
      entraNaFilaDoPainel({ numeroPedido: "ASSIST-1755123456789", concluidoEm: SETEMBRO, loja: LOJA_CENTRALSYNC })
    ).toBe(true);
    expect(
      entraNaFilaDoPainel({ numeroPedido: "DESM-AVULSO-1755", concluidoEm: SETEMBRO, loja: LOJA_CENTRALSYNC })
    ).toBe(true);
  });

  it("trata assistência de loja sem a marcação como a montagem em loja", () => {
    // Antes da regra ela não tinha botão; antiga não entra, nova entra.
    expect(
      entraNaFilaDoPainel({ numeroPedido: "ASSIST-1755123456789", concluidoEm: SETEMBRO, loja: LOJA_QUALQUER })
    ).toBe(false);
    expect(
      entraNaFilaDoPainel({ numeroPedido: "ASSIST-1755123456789", concluidoEm: HOJE, loja: LOJA_QUALQUER })
    ).toBe(true);
  });

  it("nunca põe na fila a montagem lançada à mão", () => {
    expect(entraNaFilaDoPainel({ numeroPedido: "696228", concluidoEm: HOJE, loja: LOJA_CENTRALSYNC })).toBe(false);
    expect(entraNaFilaDoPainel({ numeroPedido: null, concluidoEm: HOJE, loja: LOJA_CENTRALSYNC })).toBe(false);
  });

  it("a consulta do painel corta pela mesma data", () => {
    // O `where` da fila (app/admin/page.tsx) e a função acima precisam
    // concordar: os serviços liberados pela regra nova só entram concluídos
    // a partir do corte.
    const filtro = filtroDaFilaDoPainel();
    const ramos = filtro.OR as Array<Record<string, unknown>>;
    const comCorte = ramos.filter((r) => "concluidoEm" in r);
    expect(comCorte.length).toBeGreaterThan(0);
    for (const ramo of comCorte) {
      expect(ramo.concluidoEm).toEqual({ gte: INICIO_REGRA_SERVICOS_AVULSOS });
    }
    const montloja = ramos.filter(
      (r) => (r.numeroPedido as { startsWith: string }).startsWith === "montloja-"
    );
    expect(montloja).toHaveLength(1);
    expect(montloja[0]).toHaveProperty("concluidoEm");
  });
});

describe("serviços avulsos do CentralSync", () => {
  it("reconhece assistência, desmontagem e montagem em loja, e só elas", () => {
    expect(ehServicoAvulsoDoCentralSync("desm-1755123456789")).toBe(true);
    expect(ehServicoAvulsoDoCentralSync("assist-1755123456789")).toBe(true);
    expect(ehServicoAvulsoDoCentralSync(MONTAGEM_LOJA_AVULSA)).toBe(true);
    // O pedido da integração não é avulso: volta com o id da entrega.
    expect(ehServicoAvulsoDoCentralSync("del-1755123456789")).toBe(false);
    expect(ehServicoAvulsoDoCentralSync("696228")).toBe(false);
    expect(ehServicoAvulsoDoCentralSync(null)).toBe(false);
  });

  it("separa a montagem em loja, que é montagem, das outras duas", () => {
    expect(ehMontagemEmLojaAvulsa(MONTAGEM_LOJA_AVULSA)).toBe(true);
    expect(ehMontagemEmLojaAvulsa("ASSIST-1755123456789")).toBe(false);
    expect(ehMontagemEmLojaAvulsa("del-1755123456789")).toBe(false);
    expect(ehMontagemEmLojaAvulsa(null)).toBe(false);
  });
});

describe("rótulo do serviço enviado à loja", () => {
  it("nomeia assistência, desmontagem e montagem em loja, e nada mais", () => {
    expect(rotuloDoServico("ASSIST-del-1755123456789-2026-08-27")).toBe("ASSISTÊNCIA");
    expect(rotuloDoServico("assist-1755123456789")).toBe("ASSISTÊNCIA");
    expect(rotuloDoServico("DESM-1755123456789")).toBe("DESMONTAGEM");
    expect(rotuloDoServico(MONTAGEM_LOJA_AVULSA)).toBe("MONTAGEM EM LOJA");
    expect(rotuloDoServico("del-1755123456789")).toBeNull();
    expect(rotuloDoServico("696228")).toBeNull();
    expect(rotuloDoServico(null)).toBeNull();
  });

  it("manda a etiqueta na frente, onde o corte de 190 não alcança", () => {
    // O campo é cortado em 190 caracteres do outro lado. Se a etiqueta
    // ficasse no fim, um cliente de nome longo a empurraria para fora e a
    // linha chegaria lá parecendo uma montagem comum.
    const nome = nomeParaCentralSync({
      numeroPedido: "ASSIST-del-1755123456789-2026-08-27",
      clienteNome: "K".repeat(300),
      montador: { nome: "DÁRIO Montador1" },
    });
    expect(nome?.startsWith("[ASSISTÊNCIA]")).toBe(true);
    expect(nome!.length).toBeLessThanOrEqual(190);
  });

  it("não rotula a montagem lançada à mão", () => {
    const nome = nomeParaCentralSync({
      numeroPedido: "696228",
      clienteNome: "Maria Souza",
      montador: { nome: "DÁRIO Montador1" },
    });
    expect(nome).toContain("nota lançada à mão no MontaFácil");
    expect(nome).not.toContain("[");
  });
});

// O id é a chave do documento gravado do lado do CentralSync: precisa ser o
// da entrega quando existe uma (é o que permite marcá-la como montada) e
// precisa ser estável entre reenvios, senão cada clique cria um aviso novo.
describe("idDaEntregaNoCentralSync", () => {
  it("usa o id da entrega quando o pedido veio da integração", () => {
    expect(
      idDaEntregaNoCentralSync({ id: "cmtj9k75", numeroPedido: "del-1755123456789" })
    ).toBe("del-1755123456789");
  });

  it("deriva um id próprio para a montagem lançada à mão", () => {
    expect(idDaEntregaNoCentralSync({ id: "cmtj9k75", numeroPedido: "696228" })).toBe(
      "mf-cmtj9k75"
    );
    expect(idDaEntregaNoCentralSync({ id: "cmtj9k75", numeroPedido: null })).toBe(
      "mf-cmtj9k75"
    );
  });

  it("manda os serviços avulsos com o id daqui, nunca como uma entrega", () => {
    // Não existe entrega MONTLOJA-… nem ASSIST-… do outro lado: com o número
    // cru no lugar do id, a confirmação ficaria procurando uma entrega que
    // não existe.
    expect(
      idDaEntregaNoCentralSync({ id: "cmtj9k75", numeroPedido: MONTAGEM_LOJA_AVULSA })
    ).toBe("mf-cmtj9k75");
    expect(
      idDaEntregaNoCentralSync({
        id: "cmtj9k75",
        numeroPedido: "ASSIST-del-1755123456789-2026-08-27",
      })
    ).toBe("mf-cmtj9k75");
  });
});

// A caixa "Montagens Feitas" do CentralSync mostra este texto em "Montado
// por". Num serviço avulso não existe entrega do outro lado, então é por aqui
// (e pelo id) que o pessoal da loja reconhece o serviço.
describe("nomeParaCentralSync", () => {
  it("manda só o nome de quem montou no pedido vindo da integração", () => {
    expect(
      nomeParaCentralSync({
        numeroPedido: "del-1755123456789",
        clienteNome: "EDSON MENDES DE OLIVEIRA",
        montador: { nome: "DÁRIO Montador1" },
      })
    ).toBe("DÁRIO Montador1");
  });

  it("mantém o nulo quando ninguém foi designado no pedido da integração", () => {
    expect(
      nomeParaCentralSync({
        numeroPedido: "del-1755123456789",
        clienteNome: "EDSON MENDES DE OLIVEIRA",
        montador: null,
      })
    ).toBeNull();
  });

  it("manda a montagem em loja no formato que o CentralSync lê", () => {
    // Do outro lado, parseServiceConfirmation acha a solicitação pelo
    // "Pedido <número>", pega quem fez no pedaço antes dele e o cliente no
    // pedaço logo depois. O aviso do fim começa com "não é montagem" para
    // não ser confundido com o cliente. O mesmo texto está nos testes de lá
    // (utils/darioServiceConfirmation.test.ts) -- mudou aqui, muda lá.
    expect(
      nomeParaCentralSync({
        numeroPedido: MONTAGEM_LOJA_AVULSA,
        clienteNome: "CENTRAL MÓVEIS",
        montador: { nome: "DÁRIO Montador1" },
      })
    ).toBe(
      "[MONTAGEM EM LOJA] · DÁRIO Montador1 · Pedido MONTLOJA-1788892226229-ar1jh · CENTRAL MÓVEIS · não é montagem de entrega — só registrar a conclusão"
    );
  });

  it("identifica a montagem lançada à mão com pedido e cliente", () => {
    expect(
      nomeParaCentralSync({
        numeroPedido: "696228",
        clienteNome: "EDSON MENDES DE OLIVEIRA",
        montador: { nome: "DÁRIO Montador1" },
      })
    ).toBe(
      "DÁRIO Montador1 · Pedido 696228 · EDSON MENDES DE OLIVEIRA · nota lançada à mão no MontaFácil"
    );
  });

  it("diz quem montou quando o serviço foi feito pela própria empresa", () => {
    expect(
      nomeParaCentralSync({
        numeroPedido: null,
        clienteNome: "EDSON MENDES DE OLIVEIRA",
        feitoPorAdm: true,
        montador: null,
      })
    ).toBe("Equipe da empresa · EDSON MENDES DE OLIVEIRA · nota lançada à mão no MontaFácil");
  });
});
