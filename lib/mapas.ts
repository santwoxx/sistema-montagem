// Links de mapa/navegação usados no painel do montador (uma parada) e no
// painel do admin (rota do dia, várias paradas em sequência).
//
// Tudo aqui é só montagem de URL — nenhuma chamada à API do Google, nenhuma
// chave obrigatória. A chave (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) só entra no
// mapa embutido da tela de rota, que é opcional: sem ela, os botões que
// abrem o Google Maps continuam funcionando igual.

export function linkMapa(endereco: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    endereco
  )}`;
}

export function linkWaze(endereco: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(endereco)}&navigate=yes`;
}

// A URL de direções do Google Maps aceita no máximo 9 pontos intermediários
// (waypoints) além da origem e do destino. Como o destino também é uma
// parada, cada trecho comporta 10 paradas nossas.
export const MAX_PARADAS_POR_TRECHO = 10;

export type TrechoRota = {
  // Ausente só no primeiro trecho quando o admin não informou de onde sai —
  // aí o Google usa a localização atual do aparelho.
  origem?: string;
  // A última parada da lista é o destino final do trecho; as demais viram
  // waypoints na ordem em que estão aqui.
  paradas: string[];
};

/**
 * Quebra a lista de endereços do dia em trechos que cabem numa URL do Google
 * Maps. Cada trecho começa onde o anterior terminou, então abrir os trechos
 * em sequência cobre a rota inteira sem repetir nem pular parada.
 */
export function dividirEmTrechos(enderecos: string[], origem?: string): TrechoRota[] {
  const paradas = enderecos.map((e) => e.trim()).filter(Boolean);
  if (paradas.length === 0) return [];

  const trechos: TrechoRota[] = [];
  const origemInicial = origem?.trim() || undefined;

  for (let i = 0; i < paradas.length; i += MAX_PARADAS_POR_TRECHO) {
    const grupo = paradas.slice(i, i + MAX_PARADAS_POR_TRECHO);
    trechos.push({
      // Do segundo trecho em diante a origem é a última parada do anterior,
      // pra rota continuar de onde parou.
      origem: i === 0 ? origemInicial : paradas[i - 1],
      paradas: grupo,
    });
  }

  return trechos;
}

/** Abre a rota do trecho no app/site do Google Maps (sem precisar de chave). */
export function linkRotaGoogleMaps(trecho: TrechoRota) {
  const destino = trecho.paradas[trecho.paradas.length - 1];
  const waypoints = trecho.paradas.slice(0, -1);

  const params = new URLSearchParams({ api: "1", travelmode: "driving" });
  if (trecho.origem) params.set("origin", trecho.origem);
  params.set("destination", destino);
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Mapa embutido (iframe) com a rota desenhada. Só funciona com uma chave da
 * Maps Embed API e com origem definida — nos dois casos em que falta algo,
 * devolve null e a tela cai no botão "abrir no Google Maps".
 */
export function linkEmbedRota(trecho: TrechoRota, chave: string | undefined) {
  if (!chave || !trecho.origem) return null;

  const destino = trecho.paradas[trecho.paradas.length - 1];
  const waypoints = trecho.paradas.slice(0, -1);

  const params = new URLSearchParams({
    key: chave,
    origin: trecho.origem,
    destination: destino,
    mode: "driving",
  });
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));

  return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
}
