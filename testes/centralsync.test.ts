import { describe, expect, it } from "vitest";
import {
  ehDesmontagemOuAssistencia,
  idDaEntregaNoCentralSync,
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

// É esta função que decide se o botão "Enviar para a Central Móveis" aparece
// na tela da montagem e se ela entra na fila do painel. Um "sim" a mais aqui
// manda para a loja um serviço que não é montagem; um "não" a mais deixa o
// Dário sem jeito nenhum de mandar a foto.
describe("podeEnviarAoCentralSync", () => {
  it("libera o pedido que veio da integração, seja qual for a loja", () => {
    expect(
      podeEnviarAoCentralSync({ numeroPedido: "del-1755123456789", loja: LOJA_QUALQUER })
    ).toBe(true);
  });

  it("libera a montagem lançada à mão quando a loja é a do CentralSync", () => {
    expect(
      podeEnviarAoCentralSync({ numeroPedido: "696228", loja: LOJA_CENTRALSYNC })
    ).toBe(true);
    // Nº do pedido é opcional no formulário -- sem ele o envio continua valendo.
    expect(
      podeEnviarAoCentralSync({ numeroPedido: null, loja: LOJA_CENTRALSYNC })
    ).toBe(true);
  });

  it("não libera montagem à mão de outra loja parceira", () => {
    expect(
      podeEnviarAoCentralSync({ numeroPedido: "696228", loja: LOJA_QUALQUER })
    ).toBe(false);
    expect(podeEnviarAoCentralSync({ numeroPedido: "696228", loja: null })).toBe(false);
  });

  it("deixa enviar desmontagem e assistência da loja do CentralSync", () => {
    // Elas ficavam sem botão nenhum, e o comprovante do serviço não chegava
    // à loja. Vão como avulsas (idDaEntregaNoCentralSync devolve "mf-…", não
    // o id da entrega), então lá nada é marcado como montado -- o que impede
    // o acerto errado é o rótulo, testado logo abaixo.
    expect(
      podeEnviarAoCentralSync({
        numeroPedido: "DESM-del-1755123456789-2026-08-27",
        loja: LOJA_CENTRALSYNC,
      })
    ).toBe(true);
    expect(
      podeEnviarAoCentralSync({
        numeroPedido: "ASSIST-del-1755123456789-2026-08-27",
        loja: LOJA_CENTRALSYNC,
      })
    ).toBe(true);
    // Continuam reconhecidas como "não é montagem".
    expect(ehDesmontagemOuAssistencia("desm-1755123456789")).toBe(true);
    expect(ehDesmontagemOuAssistencia("assist-1755123456789")).toBe(true);
    expect(ehDesmontagemOuAssistencia("696228")).toBe(false);
    expect(ehDesmontagemOuAssistencia(null)).toBe(false);
  });

  it("não envia assistência de loja que não é do CentralSync", () => {
    expect(
      podeEnviarAoCentralSync({
        numeroPedido: "ASSIST-1755123456789",
        loja: LOJA_QUALQUER,
      })
    ).toBe(false);
    // Serviço particular não tem loja nenhuma do outro lado.
    expect(
      podeEnviarAoCentralSync({ numeroPedido: "ASSIST-1755123456789", loja: null })
    ).toBe(false);
  });
});

describe("rótulo do serviço enviado à loja", () => {
  it("nomeia assistência e desmontagem, e nada mais", () => {
    expect(rotuloDoServico("ASSIST-del-1755123456789-2026-08-27")).toBe("ASSISTÊNCIA");
    expect(rotuloDoServico("assist-1755123456789")).toBe("ASSISTÊNCIA");
    expect(rotuloDoServico("DESM-1755123456789")).toBe("DESMONTAGEM");
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
});

// A caixa "Montagens Feitas" do CentralSync mostra este texto em "Montado
// por". Numa montagem lançada à mão não existe entrega do outro lado, então
// é por aqui (e pelo id) que o pessoal da loja reconhece o serviço.
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
