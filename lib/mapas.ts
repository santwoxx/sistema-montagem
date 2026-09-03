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

/**
 * Limpa o endereço antes de mandá-lo para a busca do Waze.
 *
 * O endereço chega como uma linha só, do jeito que a loja digitou ou que o
 * CentralSync mandou -- e vem com coisas que o Google entende e o Waze não:
 *
 *   Rua José Bonifácio, 364 - Santo Antônio, Itabuna - BA (CEP: 45602-132)
 *
 * O buscador do Waze é bem menos tolerante que o do Google: o trecho entre
 * parênteses (CEP, ponto de referência, "casa amarela") derruba a busca, e
 * o app abre sem achar nada -- que é o "clica no Waze e não vai" relatado
 * por quem usa. O hífen separando bairro e cidade também atrapalha; vírgula
 * é o separador que ele espera.
 *
 * Google Maps continua recebendo o endereço inteiro (linkMapa), porque lá o
 * texto extra ajuda em vez de atrapalhar.
 */
export function enderecoParaNavegacao(endereco: string) {
  const limpo = endereco
    // Fora tudo entre parênteses: é sempre complemento ou referência.
    .replace(/\([^)]*\)?/g, " ")
    // CEP solto (com ou sem o rótulo), que sobra quando não vem entre
    // parênteses. O Waze até busca por CEP sozinho, mas junto com o
    // endereço ele vira mais um termo para não casar.
    .replace(/cep[:\s]*\d{2}\.?\d{3}-?\d{3}/gi, " ")
    .replace(/(?<!\d)\d{5}-\d{3}(?!\d)/g, " ")
    // Hífen usado como separador ("bairro - cidade", "Itabuna - BA") vira
    // vírgula. O hífen dentro de palavra (Cidade-Nova) fica quieto.
    .replace(/\s+-\s+/g, ", ")
    .replace(/\s+/g, " ")
    // Sobras de pontuação: vírgulas seguidas e pontuação nas pontas.
    .replace(/\s*,\s*(?=,)/g, "")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();

  // Endereço que era só um complemento entre parênteses ficaria vazio aqui
  // -- melhor mandar o original e deixar o Waze tentar do que abrir vazio.
  return limpo || endereco.trim();
}

export function linkWaze(endereco: string) {
  // "www" e "navigate=yes" são o formato documentado do link universal do
  // Waze: no celular abre o aplicativo já traçando a rota, e no computador
  // cai no site.
  return `https://www.waze.com/ul?q=${encodeURIComponent(
    enderecoParaNavegacao(endereco)
  )}&navigate=yes`;
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
