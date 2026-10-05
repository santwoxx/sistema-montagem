import { describe, expect, it } from "vitest";
import { PREFIXOS_SERVICO_SEM_MONTAGEM, rotuloDoServico } from "@/lib/centralsync";
import {
  celulaTexto,
  gerarPlanilha,
  lerFiltrosRelatorio,
  type LinhaRelatorio,
  listaPorTipo,
  MONTADOR_ADM,
  MONTADOR_NENHUM,
  NOME_ADM,
  resumoPorLoja,
  resumoPorMontador,
  resumoPorOrigem,
  resumoPorTipo,
  totalizar,
  VALOR_SO_LOJAS,
  whereDoRelatorio,
} from "@/lib/relatorio";
import { VALOR_PARTICULAR_FORM } from "@/lib/servico";
import { lerTipoServico, TIPO_SERVICO_LABEL, tipoPeloPedido } from "@/lib/tipo-servico";

describe("tipo de serviço pelo nº do pedido", () => {
  it("reconhece assistência e desmontagem do CentralSync", () => {
    expect(tipoPeloPedido("ASSIST-123")).toBe("ASSISTENCIA");
    expect(tipoPeloPedido("  desm-9 ")).toBe("DESMONTAGEM");
    expect(tipoPeloPedido("del-1755")).toBe("MONTAGEM");
    expect(tipoPeloPedido("12345")).toBe("MONTAGEM");
    expect(tipoPeloPedido(null)).toBe("MONTAGEM");
  });

  it("concorda com os prefixos que lib/centralsync.ts usa", () => {
    for (const prefixo of PREFIXOS_SERVICO_SEM_MONTAGEM) {
      const numero = `${prefixo.toUpperCase()}1`;
      const tipo = tipoPeloPedido(numero);
      expect(tipo).not.toBe("MONTAGEM");
      expect(TIPO_SERVICO_LABEL[tipo].toUpperCase()).toBe(rotuloDoServico(numero));
    }
  });

  it("só aceita tipos conhecidos vindos de fora", () => {
    expect(lerTipoServico("MONTAGEM_LOJA")).toBe("MONTAGEM_LOJA");
    expect(lerTipoServico("montagem")).toBeNull();
    expect(lerTipoServico(null)).toBeNull();
  });
});

describe("filtros do relatório", () => {
  const agora = new Date("2026-10-15T15:00:00.000Z");

  it("sem período, usa o mês corrente inteiro", () => {
    const f = lerFiltrosRelatorio({}, agora);
    expect(f).toMatchObject({ de: "2026-10-01", ate: "2026-10-31", base: "cadastro", situacao: "ativas" });
    expect(f.tipo).toBeNull();
    expect(lerFiltrosRelatorio({}, new Date("2026-02-10T15:00:00.000Z")).ate).toBe("2026-02-28");
  });

  it("desinverte datas trocadas e ignora valores inválidos", () => {
    const f = lerFiltrosRelatorio(
      { de: "2026-09-30", ate: "2026-09-01", situacao: "qualquer", tipo: "OUTRO", base: "x" },
      agora
    );
    expect(f).toMatchObject({ de: "2026-09-01", ate: "2026-09-30", situacao: "ativas", base: "cadastro" });
    expect(f.tipo).toBeNull();
    expect(lerFiltrosRelatorio({ de: "lixo" }, agora).de).toBe("2026-10-01");
  });

  it("monta o where com o período no fuso do negócio", () => {
    const where = whereDoRelatorio(
      lerFiltrosRelatorio({ de: "2026-10-01", ate: "2026-10-31", base: "conclusao" }, agora)
    );
    // 01/10 00:00 em São Paulo é 03:00 UTC; o fim é 01/11 00:00 (exclusivo).
    expect(where.concluidoEm).toEqual({
      gte: new Date("2026-10-01T03:00:00.000Z"),
      lt: new Date("2026-11-01T03:00:00.000Z"),
    });
    expect(where.createdAt).toBeUndefined();
    expect(where.status).toEqual({ not: "CANCELADO" });
  });

  it("traduz loja, montador, tipo e situação", () => {
    const base = lerFiltrosRelatorio({}, agora);
    expect(whereDoRelatorio({ ...base, lojaId: VALOR_PARTICULAR_FORM }).lojaId).toBeNull();
    expect(whereDoRelatorio({ ...base, lojaId: VALOR_SO_LOJAS }).lojaId).toEqual({ not: null });
    expect(whereDoRelatorio({ ...base, lojaId: "loja-1" }).lojaId).toBe("loja-1");
    expect(whereDoRelatorio({ ...base, montadorId: MONTADOR_ADM })).toMatchObject({ feitoPorAdm: true });
    expect(whereDoRelatorio({ ...base, montadorId: MONTADOR_NENHUM })).toMatchObject({
      montadorId: null,
      feitoPorAdm: false,
    });
    expect(whereDoRelatorio({ ...base, tipo: "DESMONTAGEM" }).tipoServico).toBe("DESMONTAGEM");
    expect(whereDoRelatorio({ ...base, situacao: "abertas" }).status).toEqual({
      in: ["PENDENTE", "EM_ANDAMENTO"],
    });
    expect(whereDoRelatorio({ ...base, situacao: "todas" }).status).toBeUndefined();
  });
});

function linha(dados: Partial<LinhaRelatorio>): LinhaRelatorio {
  return {
    id: Math.random().toString(36).slice(2),
    tipoServico: "MONTAGEM",
    status: "CONCLUIDO",
    createdAt: new Date("2026-10-05T15:00:00.000Z"),
    dataAgendada: null,
    concluidoEm: new Date("2026-10-06T15:00:00.000Z"),
    clienteNome: "Maria Souza",
    clienteTelefone: null,
    clienteEndereco: "Rua A, 1",
    numeroPedido: null,
    descricaoServico: "Guarda-roupa",
    valorServico: 100,
    valorMontador: 40,
    valorAssistencia: 2,
    lojaId: "loja-1",
    montadorId: "m-1",
    pagoPelaLoja: false,
    pagoAoMontador: false,
    feitoPorAdm: false,
    loja: { nome: "Central Móveis" },
    montador: { nome: "Carlos" },
    ...dados,
  };
}

describe("contas do relatório", () => {
  it("usa a mesma receita do Financeiro: 8% + assistência na loja, nota inteira no particular", () => {
    const t = totalizar([
      linha({}),
      linha({ lojaId: null, loja: null, valorServico: 200, valorAssistencia: 0, valorMontador: 50 }),
    ]);
    expect(t).toEqual({
      quantidade: 2,
      concluidas: 2,
      valorNotas: 300,
      comissaoMontadores: 90,
      receitaEmpresa: 210, // 8 + 2 (loja) + 200 (particular)
      lucroEmpresa: 120,
    });
  });

  it("mostra os quatro tipos sempre, na mesma ordem", () => {
    const r = resumoPorTipo([linha({ tipoServico: "ASSISTENCIA", status: "PENDENTE" })]);
    expect(r.map((x) => [x.tipo, x.quantidade, x.concluidas])).toEqual([
      ["MONTAGEM", 0, 0],
      ["ASSISTENCIA", 1, 0],
      ["DESMONTAGEM", 0, 0],
      ["MONTAGEM_LOJA", 0, 0],
    ]);
  });

  it("separa montadores pelo cadastro, mesmo com nome igual", () => {
    const r = resumoPorMontador([
      linha({ montadorId: "m-1" }),
      linha({ montadorId: "m-1", tipoServico: "DESMONTAGEM", pagoAoMontador: true }),
      linha({ montadorId: "m-2" }),
      linha({ montadorId: null, montador: null, feitoPorAdm: true, valorMontador: 0 }),
    ]);
    expect(r.map((m) => [m.nome, m.quantidade])).toEqual([
      ["Carlos", 2],
      [NOME_ADM, 1],
      ["Carlos", 1],
    ]);
    expect(r[0]).toMatchObject({
      porTipo: { MONTAGEM: 1, DESMONTAGEM: 1, ASSISTENCIA: 0, MONTAGEM_LOJA: 0 },
      comissao: 80,
      aPagar: 40,
    });
  });

  it("não junta os particulares com uma loja chamada “Particular”", () => {
    const r = resumoPorLoja([
      linha({ lojaId: null, loja: null }),
      linha({ lojaId: "loja-x", loja: { nome: "Particular" } }),
    ]);
    expect(r).toHaveLength(2);
    expect(r.filter((l) => l.particular)).toHaveLength(1);
    expect(r.find((l) => l.particular)).toMatchObject({ devidoAEmpresa: 100, aReceber: 100 });
  });

  it("separa serviço de loja de particular, só com as origens presentes", () => {
    const r = resumoPorOrigem([
      linha({ tipoServico: "MONTAGEM_LOJA", pagoPelaLoja: true }),
      linha({ lojaId: null, loja: null, valorServico: 300, valorAssistencia: 0 }),
      linha({ lojaId: null, loja: null, tipoServico: "ASSISTENCIA", valorServico: 50, valorAssistencia: 0 }),
    ]);
    expect(r.map((o) => o.origem)).toEqual(["loja", "particular"]);
    expect(r[0]).toMatchObject({ quantidade: 1, receitaEmpresa: 10, aReceber: 0 });
    expect(r[1]).toMatchObject({
      quantidade: 2,
      porTipo: { MONTAGEM: 1, ASSISTENCIA: 1, DESMONTAGEM: 0, MONTAGEM_LOJA: 0 },
      receitaEmpresa: 350,
      aReceber: 350,
    });
    expect(resumoPorOrigem([linha({ lojaId: null, loja: null })]).map((o) => o.origem)).toEqual([
      "particular",
    ]);
  });

  it("lista por tipo, em ordem de data, sem os tipos vazios", () => {
    const lista = listaPorTipo(
      [
        linha({ clienteNome: "B", tipoServico: "MONTAGEM_LOJA", createdAt: new Date("2026-10-09") }),
        linha({ clienteNome: "A", tipoServico: "MONTAGEM_LOJA", createdAt: new Date("2026-10-02") }),
        linha({ clienteNome: "C" }),
      ],
      "cadastro"
    );
    expect(lista.map((g) => [g.tipo, g.linhas.map((m) => m.clienteNome)])).toEqual([
      ["MONTAGEM", ["C"]],
      ["MONTAGEM_LOJA", ["A", "B"]],
    ]);
  });
});

describe("planilha", () => {
  it("sai no padrão do Excel em português", () => {
    const csv = gerarPlanilha([linha({ valorServico: 1234.5 })], "cadastro");
    expect(csv.startsWith("﻿")).toBe(true);
    const [cabecalho, primeira] = csv.slice(1).split("\r\n");
    expect(cabecalho?.split(";")[0]).toBe("Tipo");
    const celulas = primeira!.split(";");
    expect(celulas[0]).toBe("Montagem");
    expect(celulas[2]).toBe("05/10/2026");
    expect(celulas[8]).toBe("Loja");
    expect(celulas[13]).toBe("1234,50");
    expect(celulas[17]).toBe("Não");
    const particular = gerarPlanilha([linha({ lojaId: null, loja: null })], "cadastro");
    expect(particular.split("\r\n")[1]!.split(";").slice(8, 10)).toEqual([
      "Particular",
      "Particular",
    ]);
  });

  it("não deixa texto de fora virar fórmula nem quebrar colunas", () => {
    expect(celulaTexto("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(celulaTexto("+55 73 9999")).toBe("'+55 73 9999");
    expect(celulaTexto("Rua A; casa 2")).toBe("\"Rua A; casa 2\"");
    expect(celulaTexto(null)).toBe("");
  });
});
