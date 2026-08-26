import { describe, expect, it } from "vitest";
import { ipDoPedido, limparTentativas, registrarTentativa } from "@/lib/limite";
import {
  OrigemEnvioSchema,
  STATUS_PERMITIDOS_MONTADOR,
  StatusMontagemSchema,
  TipoOcorrenciaSchema,
} from "@/lib/validacao";

describe("limite de tentativas", () => {
  const opcoes = { limite: 3, janelaMs: 60_000 };

  it("libera até o limite e bloqueia depois", () => {
    const chave = `teste-${Math.random()}`;
    expect(registrarTentativa(chave, opcoes).permitido).toBe(true);
    expect(registrarTentativa(chave, opcoes).permitido).toBe(true);
    expect(registrarTentativa(chave, opcoes).permitido).toBe(true);

    const bloqueado = registrarTentativa(chave, opcoes);
    expect(bloqueado.permitido).toBe(false);
    expect(bloqueado.esperarSegundos).toBeGreaterThan(0);
  });

  it("conta cada chave separadamente", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 4; i++) registrarTentativa(a, opcoes);
    expect(registrarTentativa(a, opcoes).permitido).toBe(false);
    expect(registrarTentativa(b, opcoes).permitido).toBe(true);
  });

  it("zera o contador quando a tentativa dá certo", () => {
    const chave = `login-${Math.random()}`;
    for (let i = 0; i < 4; i++) registrarTentativa(chave, opcoes);
    expect(registrarTentativa(chave, opcoes).permitido).toBe(false);

    limparTentativas(chave);
    expect(registrarTentativa(chave, opcoes).permitido).toBe(true);
  });

  it("insistir durante o bloqueio mantém o bloqueio", () => {
    const chave = `insistente-${Math.random()}`;
    for (let i = 0; i < 5; i++) registrarTentativa(chave, opcoes);
    const primeiro = registrarTentativa(chave, opcoes);
    const segundo = registrarTentativa(chave, opcoes);
    expect(primeiro.permitido).toBe(false);
    expect(segundo.permitido).toBe(false);
    expect(segundo.esperarSegundos).toBeGreaterThanOrEqual(
      primeiro.esperarSegundos - 1
    );
  });

  it("lê o IP do cabeçalho da Vercel e tem valor de reserva", () => {
    expect(ipDoPedido(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7"
    );
    expect(ipDoPedido(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(ipDoPedido(new Headers())).toBe("desconhecido");
  });
});

describe("validação do que chega de fora", () => {
  it("aceita só os status previstos", () => {
    expect(StatusMontagemSchema.safeParse("CONCLUIDO").success).toBe(true);
    expect(StatusMontagemSchema.safeParse("concluido").success).toBe(false);
    expect(StatusMontagemSchema.safeParse("DELETADO").success).toBe(false);
    expect(StatusMontagemSchema.safeParse("").success).toBe(false);
  });

  it("não deixa o montador concluir nem cancelar pela ação de status", () => {
    // Concluir exige foto e as duas assinaturas (concluirComProvaAction);
    // cancelar é decisão do admin.
    expect(STATUS_PERMITIDOS_MONTADOR).toContain("EM_ANDAMENTO");
    expect(STATUS_PERMITIDOS_MONTADOR).toContain("PENDENTE");
    expect(STATUS_PERMITIDOS_MONTADOR).not.toContain("CONCLUIDO");
    expect(STATUS_PERMITIDOS_MONTADOR).not.toContain("CANCELADO");
  });

  it("aceita só os tipos de ocorrência previstos", () => {
    expect(TipoOcorrenciaSchema.safeParse("PECA_DANIFICADA").success).toBe(true);
    expect(TipoOcorrenciaSchema.safeParse("QUALQUER_COISA").success).toBe(false);
  });

  it("aceita só os dois destinos de volta do envio ao CentralSync", () => {
    expect(OrigemEnvioSchema.safeParse("painel").success).toBe(true);
    expect(OrigemEnvioSchema.safeParse("montagem").success).toBe(true);
    expect(OrigemEnvioSchema.safeParse("https://site-de-fora.com").success).toBe(false);
  });
});
