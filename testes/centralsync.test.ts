import { describe, expect, it } from "vitest";
import {
  ehDesmontagemOuAssistencia,
  idDaEntregaNoCentralSync,
  nomeParaCentralSync,
  pareceIdDoCentralSync,
  podeEnviarAoCentralSync,
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

  it("segura desmontagem e assistência mesmo vindas da loja do CentralSync", () => {
    // Elas chegam aqui como montagem comum, mas confirmá-las do outro lado
    // marcaria a entrega original como montada de novo e pagaria a comissão
    // cheia de montagem. Antes quem as segurava era só o prefixo diferente de
    // "del-"; agora a loja também libera o envio, então a exclusão é explícita.
    expect(
      podeEnviarAoCentralSync({
        numeroPedido: "DESM-del-1755123456789-2026-08-27",
        loja: LOJA_CENTRALSYNC,
      })
    ).toBe(false);
    expect(
      podeEnviarAoCentralSync({
        numeroPedido: "ASSIST-del-1755123456789-2026-08-27",
        loja: LOJA_CENTRALSYNC,
      })
    ).toBe(false);
    expect(ehDesmontagemOuAssistencia("desm-1755123456789")).toBe(true);
    expect(ehDesmontagemOuAssistencia("assist-1755123456789")).toBe(true);
    expect(ehDesmontagemOuAssistencia("696228")).toBe(false);
    expect(ehDesmontagemOuAssistencia(null)).toBe(false);
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
