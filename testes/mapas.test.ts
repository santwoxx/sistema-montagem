import { describe, expect, it } from "vitest";
import {
  dividirEmTrechos,
  linkEmbedRota,
  linkRotaGoogleMaps,
  MAX_PARADAS_POR_TRECHO,
} from "@/lib/mapas";

const enderecos = (n: number) =>
  Array.from({ length: n }, (_, i) => `Rua ${i + 1}, Itabuna - BA`);

describe("rota do dia", () => {
  it("cabe num trecho só quando são poucas paradas", () => {
    const trechos = dividirEmTrechos(enderecos(4), "Depósito");
    expect(trechos).toHaveLength(1);
    expect(trechos[0]!.origem).toBe("Depósito");
    expect(trechos[0]!.paradas).toHaveLength(4);
  });

  it("divide no limite do Google Maps e emenda os trechos", () => {
    const lista = enderecos(23);
    const trechos = dividirEmTrechos(lista, "Depósito");

    expect(trechos).toHaveLength(3);
    expect(trechos.map((t) => t.paradas.length)).toEqual([10, 10, 3]);
    // Cada trecho começa onde o anterior terminou: nenhuma parada é pulada
    // nem repetida ao abrir os links em sequência.
    expect(trechos[1]!.origem).toBe(lista[9]);
    expect(trechos[2]!.origem).toBe(lista[19]);
    expect(trechos.flatMap((t) => t.paradas)).toEqual(lista);
  });

  it("deixa a origem em branco quando o admin não informou o ponto de partida", () => {
    const [trecho] = dividirEmTrechos(enderecos(3));
    expect(trecho!.origem).toBeUndefined();
  });

  it("ignora endereços vazios e devolve nada quando não sobra parada", () => {
    expect(dividirEmTrechos(["  ", ""])).toEqual([]);
    expect(dividirEmTrechos([])).toEqual([]);
    expect(dividirEmTrechos(["  ", "Rua A"])[0]!.paradas).toEqual(["Rua A"]);
  });

  it("usa a última parada como destino e as demais como waypoints", () => {
    const url = new URL(
      linkRotaGoogleMaps({ origem: "Depósito", paradas: ["Rua A", "Rua B", "Rua C"] })
    );
    expect(url.searchParams.get("origin")).toBe("Depósito");
    expect(url.searchParams.get("destination")).toBe("Rua C");
    expect(url.searchParams.get("waypoints")).toBe("Rua A|Rua B");
    expect(url.searchParams.get("travelmode")).toBe("driving");
  });

  it("mantém o limite de 10 paradas por trecho documentado", () => {
    expect(MAX_PARADAS_POR_TRECHO).toBe(10);
  });

  it("só monta o mapa embutido com chave e origem", () => {
    const trecho = { origem: "Depósito", paradas: ["Rua A"] };
    expect(linkEmbedRota(trecho, undefined)).toBeNull();
    expect(linkEmbedRota({ paradas: ["Rua A"] }, "CHAVE")).toBeNull();
    expect(linkEmbedRota(trecho, "CHAVE")).toContain("maps/embed/v1/directions");
  });
});
