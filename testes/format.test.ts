import { describe, expect, it } from "vitest";
import {
  apenasDigitos,
  formatarCnpj,
  formatarData,
  formatarDataHora,
  linkTelefone,
  linkWhatsapp,
  paraInputDate,
  paraNumeroBr,
} from "@/lib/format";
import { normalizarCnpj } from "@/lib/cnpj";
import { pareceIdDoCentralSync } from "@/lib/centralsync";

describe("paraNumeroBr", () => {
  it("entende ponto de milhar com vírgula decimal", () => {
    // Só trocar vírgula por ponto lia "2.999,00" como 2,999.
    expect(paraNumeroBr("2.999,00")).toBe(2999);
    expect(paraNumeroBr("1.234.567,89")).toBe(1234567.89);
  });

  it("aceita decimal simples, sem vírgula", () => {
    expect(paraNumeroBr("250")).toBe(250);
    expect(paraNumeroBr("250.5")).toBe(250.5);
  });

  it("devolve NaN para vazio e passa número adiante", () => {
    expect(paraNumeroBr("")).toBeNaN();
    expect(paraNumeroBr(null)).toBeNaN();
    expect(paraNumeroBr(1234.5)).toBe(1234.5);
  });
});

describe("datas formatadas no fuso do negócio", () => {
  it("mostra o dia de Itabuna, não o do servidor", () => {
    // 25/08 00:30 UTC ainda é 24/08 às 21h30 em Itabuna.
    const instante = new Date("2026-08-25T00:30:00.000Z");
    expect(formatarData(instante)).toBe("24/08/2026");
    expect(formatarDataHora(instante)).toContain("24/08/2026");
  });

  it("devolve o mesmo dia para o campo de data do formulário", () => {
    expect(paraInputDate(new Date("2026-08-25T00:30:00.000Z"))).toBe("2026-08-24");
    // Meio-dia local, como paraData grava o agendamento.
    expect(paraInputDate(new Date("2026-08-24T15:00:00.000Z"))).toBe("2026-08-24");
  });

  it("não quebra com data ausente ou inválida", () => {
    expect(formatarData(null)).toBe("-");
    expect(formatarData("banana")).toBe("-");
    expect(formatarDataHora(undefined)).toBe("-");
    expect(paraInputDate(null)).toBe("");
    expect(paraInputDate("banana")).toBe("");
  });
});

describe("links de contato", () => {
  it("acrescenta o código do Brasil uma vez só", () => {
    expect(linkWhatsapp("73999912345")).toBe("https://wa.me/5573999912345");
    expect(linkWhatsapp("5573999912345")).toBe("https://wa.me/5573999912345");
    expect(linkWhatsapp("(73) 99991-2345")).toBe("https://wa.me/5573999912345");
  });

  it("codifica a mensagem pronta", () => {
    expect(linkWhatsapp("7399991234", "Olá, tudo bem?")).toBe(
      "https://wa.me/557399991234?text=Ol%C3%A1%2C%20tudo%20bem%3F"
    );
  });

  it("monta o link de ligação só com dígitos", () => {
    expect(linkTelefone("(73) 3333-4444")).toBe("tel:7333334444");
    expect(apenasDigitos("00.011.122/0001-99")).toBe("00011122000199");
  });
});

describe("CNPJ", () => {
  it("guarda só os dígitos e recusa o que não tem 14", () => {
    expect(normalizarCnpj("00.011.122/0001-99")).toBe("00011122000199");
    expect(normalizarCnpj("123")).toBeNull();
    expect(normalizarCnpj("")).toBeNull();
    expect(normalizarCnpj(null)).toBeNull();
  });

  it("formata para exibição e devolve como veio se não der", () => {
    expect(formatarCnpj("00011122000199")).toBe("00.011.122/0001-99");
    expect(formatarCnpj(null)).toBe("");
    expect(formatarCnpj("123")).toBe("123");
  });
});

describe("origem CentralSync", () => {
  it("reconhece pedido vindo da entrega do CentralSync", () => {
    expect(pareceIdDoCentralSync("del-1723480000000")).toBe(true);
  });

  it("não confunde desmontagem nem pedido de outra loja", () => {
    // Desmontagem usa prefixo DESM- de propósito: não pode receber a
    // comissão de montagem nem liberar o aviso de conclusão.
    expect(pareceIdDoCentralSync("DESM-1723480000000")).toBe(false);
    expect(pareceIdDoCentralSync("404")).toBe(false);
    expect(pareceIdDoCentralSync(null)).toBe(false);
  });
});
