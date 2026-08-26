import { describe, expect, it } from "vitest";
import {
  instanteLocal,
  intervaloDoDia,
  intervaloDoMes,
  mesAtual,
  partesNoFuso,
} from "@/lib/datas";

// Estes testes existem porque o bug que eles travam é invisível em quem
// desenvolve (máquina em UTC-3) e só aparece em produção (Vercel em UTC).
describe("datas ancoradas no fuso do negócio", () => {
  it("monta o início do mês às 03:00 UTC (meia-noite em Itabuna)", () => {
    expect(instanteLocal(2026, 8, 1).toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  it("grava o meio-dia agendado como meio-dia local, não do servidor", () => {
    expect(instanteLocal(2026, 8, 24, 12).toISOString()).toBe(
      "2026-08-24T15:00:00.000Z"
    );
  });

  it("vira o ano ao calcular o fim de dezembro", () => {
    const { inicio, fim } = intervaloDoMes("2026-12");
    expect(inicio.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("mantém em agosto uma montagem concluída às 23h30 de 31/08", () => {
    // 01/09 02:30 UTC = 31/08 23:30 em Itabuna. Com os limites em UTC, esta
    // montagem era contada em setembro.
    const concluidaTardeDaNoite = new Date("2026-09-01T02:30:00.000Z");
    const agosto = intervaloDoMes("2026-08");

    expect(partesNoFuso(concluidaTardeDaNoite)).toMatchObject({ mes: 8, dia: 31 });
    expect(concluidaTardeDaNoite >= agosto.inicio).toBe(true);
    expect(concluidaTardeDaNoite < agosto.fim).toBe(true);
  });

  it("cobre o dia inteiro na rota, das 00h às 24h locais", () => {
    const dia = intervaloDoDia("2026-08-31")!;
    expect(dia.inicio.toISOString()).toBe("2026-08-31T03:00:00.000Z");
    expect(dia.fim.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("recusa data inválida e cai no mês corrente quando o mês é inválido", () => {
    expect(intervaloDoDia("nao-e-data")).toBeNull();
    expect(intervaloDoDia("")).toBeNull();

    const corrente = intervaloDoMes("lixo");
    const esperado = intervaloDoMes(mesAtual());
    expect(corrente.inicio.toISOString()).toBe(esperado.inicio.toISOString());
  });
});
