import { describe, expect, it } from "vitest";
import { pareceIdDoCentralSync } from "@/lib/centralsync";

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
