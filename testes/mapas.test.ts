import { describe, expect, it } from "vitest";
import {
  dividirEmTrechos,
  enderecoParaNavegacao,
  linkEmbedRota,
  linkMapa,
  linkRotaGoogleMaps,
  linkWaze,
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

// O Waze é o que a equipe usa para rodar a rota, e a busca dele é bem menos
// tolerante que a do Google: endereço com "(CEP: ...)" abre o aplicativo
// sem achar nada -- o "clica no Waze e não vai".
describe("link do Waze", () => {
  const ENDERECO = "Rua José Bonifácio, 364 - Santo Antônio, Itabuna - BA (CEP: 45602-132)";

  it("tira o CEP entre parênteses e troca o hífen separador por vírgula", () => {
    expect(enderecoParaNavegacao(ENDERECO)).toBe(
      "Rua José Bonifácio, 364, Santo Antônio, Itabuna, BA"
    );
  });

  it("tira também o CEP solto, com ou sem rótulo", () => {
    expect(enderecoParaNavegacao("Rua A, 12, Itabuna, BA, CEP 45600-000")).toBe(
      "Rua A, 12, Itabuna, BA"
    );
    expect(enderecoParaNavegacao("Rua A, 12, Itabuna 45600-000")).toBe("Rua A, 12, Itabuna");
  });

  it("tira ponto de referência entre parênteses, que o Waze não entende", () => {
    expect(enderecoParaNavegacao("Rua A, 12, Itabuna (casa amarela, ao lado do mercado)")).toBe(
      "Rua A, 12, Itabuna"
    );
  });

  it("devolve o original quando não sobraria nada para buscar", () => {
    // Endereço que é só uma referência: melhor mandar assim e deixar o Waze
    // tentar do que abrir o aplicativo com a busca vazia.
    expect(enderecoParaNavegacao("(casa amarela)")).toBe("(casa amarela)");
  });

  it("monta o link universal do Waze já pedindo navegação", () => {
    const url = new URL(linkWaze(ENDERECO));
    expect(url.host).toBe("www.waze.com");
    expect(url.pathname).toBe("/ul");
    expect(url.searchParams.get("navigate")).toBe("yes");
    expect(url.searchParams.get("q")).toBe("Rua José Bonifácio, 364, Santo Antônio, Itabuna, BA");
  });

  it("deixa o Google Maps receber o endereço inteiro", () => {
    // Lá o texto a mais (CEP, referência) ajuda a achar o ponto certo.
    expect(new URL(linkMapa(ENDERECO)).searchParams.get("query")).toBe(ENDERECO);
  });
});
