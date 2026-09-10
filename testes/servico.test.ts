import { describe, expect, it } from "vitest";
import {
  ehParticular,
  filtroDeOrigem,
  lerOrigem,
  lojaIdDoFormulario,
  NOME_PARTICULAR,
  nomeDaOrigem,
  quemPaga,
  VALOR_PARTICULAR_FORM,
} from "@/lib/servico";

describe("origem do serviço (loja x particular)", () => {
  it("trata montagem sem loja como particular", () => {
    expect(ehParticular({ lojaId: null })).toBe(true);
    expect(ehParticular({})).toBe(true);
    expect(ehParticular({ lojaId: "loja-1" })).toBe(false);
  });

  it("mostra o rótulo de particular no lugar do nome da loja", () => {
    expect(nomeDaOrigem({ nome: "Central Móveis" })).toBe("Central Móveis");
    expect(nomeDaOrigem(null)).toBe(NOME_PARTICULAR);
    expect(nomeDaOrigem(undefined)).toBe(NOME_PARTICULAR);
  });

  it("diz quem paga cada tipo de serviço", () => {
    expect(quemPaga({ lojaId: "loja-1" })).toBe("Loja");
    expect(quemPaga({ lojaId: null })).toBe("Cliente");
  });
});

describe("filtro de origem", () => {
  it("não restringe nada em “todas”", () => {
    expect(filtroDeOrigem("todas")).toEqual({});
  });

  it("separa particular de loja", () => {
    expect(filtroDeOrigem("particular")).toEqual({ lojaId: null });
    expect(filtroDeOrigem("loja")).toEqual({ lojaId: { not: null } });
  });

  it("cai em “todas” quando vem lixo pela URL", () => {
    // A origem chega por query string, então é texto de fora.
    expect(lerOrigem("particular")).toBe("particular");
    expect(lerOrigem("banana")).toBe("todas");
    expect(lerOrigem(undefined)).toBe("todas");
    expect(lerOrigem(null)).toBe("todas");
  });
});

describe("loja escolhida no formulário", () => {
  it("converte o valor reservado de particular em ausência de loja", () => {
    expect(lojaIdDoFormulario(VALOR_PARTICULAR_FORM)).toBeNull();
  });

  it("trata campo vazio como sem loja", () => {
    expect(lojaIdDoFormulario("")).toBeNull();
    expect(lojaIdDoFormulario("   ")).toBeNull();
  });

  it("preserva o id de uma loja de verdade", () => {
    expect(lojaIdDoFormulario("cltm123")).toBe("cltm123");
    // Espaço grudado no id (colado de outro lugar) não pode virar particular.
    expect(lojaIdDoFormulario(" cltm123 ")).toBe("cltm123");
  });
});
