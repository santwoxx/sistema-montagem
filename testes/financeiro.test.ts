import { describe, expect, it } from "vitest";
import {
  emCentavos,
  PERCENTUAL_EMPRESA,
  receitaDaEmpresa,
  somarDinheiro,
  somarReceitaDaEmpresa,
  somarValorDevidoPelaLoja,
  valorDevidoPelaLoja,
} from "@/lib/financeiro";

describe("regras de dinheiro", () => {
  it("cobra da loja o acerto padrão mais a assistência", () => {
    // 1000 * 8% = 80, mais 20 de assistência.
    expect(valorDevidoPelaLoja({ valorServico: 1000, valorAssistencia: 20 })).toBe(100);
  });

  it("trata assistência ausente como zero", () => {
    expect(valorDevidoPelaLoja({ valorServico: 250, valorAssistencia: null })).toBe(20);
    expect(valorDevidoPelaLoja({ valorServico: 250 })).toBe(20);
  });

  it("mantém o percentual da empresa num lugar só", () => {
    expect(PERCENTUAL_EMPRESA).toBe(0.08);
  });

  it("não deixa sobra de ponto flutuante aparecer no total", () => {
    // 0.07 + 0.01 dá 0.08000000000000002 em ponto flutuante.
    expect(somarDinheiro([0.07, 0.01])).toBe(0.08);
    // Cem montagens de R$ 0,10 têm que dar exatamente R$ 10,00.
    expect(somarDinheiro(Array.from({ length: 100 }, () => 0.1))).toBe(10);
  });

  it("ignora valores nulos ao somar", () => {
    expect(somarDinheiro([10, null, undefined, 5])).toBe(15);
    expect(somarDinheiro([])).toBe(0);
  });

  it("arredonda montagem por montagem, e o total é a soma das parcelas", () => {
    // Cada linha é fechada em centavos antes de entrar no total -- é o que
    // a loja vê cobrado em cada montagem, então o total tem que ser
    // exatamente a soma do que foi cobrado, e não a conta refeita sobre o
    // valor cheio. Aqui isso dá 33,34 + 33,34 + 33,33 = 100,01 (e não
    // 100,00): a diferença de um centavo é o arredondamento das parcelas,
    // e é ela que faz a cobrança bater com o extrato item a item.
    const linhas = [
      { valorServico: 333.33, valorAssistencia: 6.67 },
      { valorServico: 333.33, valorAssistencia: 6.67 },
      { valorServico: 333.34, valorAssistencia: 6.66 },
    ];

    expect(linhas.map(valorDevidoPelaLoja)).toEqual([33.34, 33.34, 33.33]);
    expect(somarValorDevidoPelaLoja(linhas)).toBe(100.01);
  });

  it("devolve sempre um valor já fechado em centavos", () => {
    const total = somarValorDevidoPelaLoja([
      { valorServico: 1234.56, valorAssistencia: 7.89 },
      { valorServico: 99.99, valorAssistencia: null },
    ]);
    expect(total).toBe(emCentavos(total));
  });
});

describe("receita de serviço particular", () => {
  it("fica com a nota inteira quando não há loja", () => {
    // Sem loja não existe acerto de 8%: quem paga é o cliente, direto.
    expect(receitaDaEmpresa({ valorServico: 400, lojaId: null })).toBe(400);
  });

  it("continua cobrando só o acerto quando há loja", () => {
    expect(
      receitaDaEmpresa({ valorServico: 1000, valorAssistencia: 20, lojaId: "loja-1" })
    ).toBe(100);
  });

  it("soma os dois tipos com a regra de cada um", () => {
    // 8% de 1000 = 80, mais o particular cheio de 400.
    expect(
      somarReceitaDaEmpresa([
        { valorServico: 1000, lojaId: "loja-1" },
        { valorServico: 400, lojaId: null },
      ])
    ).toBe(480);
  });

  it("não confunde assistência com receita no particular", () => {
    // Um particular não deveria ter assistência gravada (a ação zera), mas
    // se tiver, ela não pode ser somada por fora do valor: o cliente pagou
    // a nota, e só.
    expect(
      receitaDaEmpresa({ valorServico: 400, valorAssistencia: 50, lojaId: null })
    ).toBe(400);
  });
});
