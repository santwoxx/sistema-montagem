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
 * Cidade e estado assumidos quando o endereço não diz em que cidade fica.
 *
 * O Google Maps chuta a cidade pela localização de quem clica; o Waze, não:
 * sem cidade ele procura o nome da rua no país inteiro e volta sem resultado
 * (ou com a rua de mesmo nome em outro estado). Como a maioria dos endereços
 * chega da nota fiscal só com "rua, número, bairro", é aqui que a cidade
 * entra.
 *
 * Só é usada quando o endereço não traz nem UF nem o nome desta cidade, e
 * quando ele é curto o bastante para ser só rua/número/bairro (ver
 * `comCidadePadrao`). Para atender outra cidade, defina
 * `NEXT_PUBLIC_CIDADE_PADRAO`; para desligar de vez, defina como vazio.
 */
const CIDADE_PADRAO = (process.env.NEXT_PUBLIC_CIDADE_PADRAO ?? "Itabuna, BA").trim();

const UFS =
  "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";

const SO_A_UF = new RegExp(`^(?:${UFS})$`, "i");

/**
 * Onde o endereço acaba e começa a observação de entrega.
 *
 * O campo é uma linha de texto livre, então vem com o que a loja anotou
 * junto: "COD.GILVAN RODRIGUES" (o código do pedido na loja), "prox. ao
 * mercado", "falar com a vizinha". O Google engole isso; o Waze trata cada
 * palavra como parte do endereço e não acha nada.
 *
 * As bordas são `(?<!\p{L})`/`(?!\p{L})` em vez de `\b` de propósito: `\b`
 * em JavaScript só conhece letras ASCII, então "Telêmaco" casaria com "tel"
 * e a rua inteira seria cortada.
 */
const MARCADOR_REFERENCIA =
  /(?<!\p{L})(?:c[oó]d(?:igo)?|ref(?:er[eê]ncia)?|obs|ponto\s+de\s+refer\p{L}*|pr[oó]x(?:imo)?|perto\s+d[eo]|ao\s+lado|em\s+frente|defronte|fundos|falar\s+com|contato|tel(?:efone)?|fone|recado|whats\p{L}*)(?!\p{L})/iu;

/** Tipos de via: "Rua 2" é nome de rua, não a casa número 2. */
const TIPO_DE_VIA =
  /^(?:r|rua|av|avenida|trav|travessa|al|alameda|pra[cç]a|estrada|rod|rodovia|via|beco|ladeira|largo|conj|conjunto|loteamento|lot|quadra|qd)\.?$/i;

/** "25 de Dezembro", "7 de Setembro": o número faz parte do nome da via. */
const PARTICULA = /^(?:de|do|da|dos|das)$/i;

/** "nº 145", "n. 145": o marcador some e o número fica. */
const MARCADOR_DE_NUMERO = /^n[ºo°]?\.?$/i;

function cortarNaReferencia(trecho: string) {
  const achado = trecho.match(MARCADOR_REFERENCIA);
  return achado?.index === undefined ? trecho : trecho.slice(0, achado.index);
}

/**
 * Separa rua, número e bairro com vírgula quando eles vêm grudados.
 *
 * "RUA 25 DE DEZEMBRO 145 SAO CAETANO" é uma linha só para o Waze, que tenta
 * casar tudo como nome de rua. Com as vírgulas no lugar
 * ("RUA 25 DE DEZEMBRO, 145, SAO CAETANO") ele reconhece o número da casa.
 */
function separarNumeroDaRua(trecho: string) {
  const tokens = trecho.split(" ").filter(Boolean);

  for (let i = 1; i < tokens.length; i++) {
    if (!/^\d{1,5}[a-z]?$/i.test(tokens[i]!)) continue;
    // Nome da via, não número da casa: "Rua 25 de Dezembro", "Rua 2".
    if (PARTICULA.test(tokens[i + 1] ?? "")) continue;
    if (i === 1 && TIPO_DE_VIA.test(tokens[0]!)) continue;
    // "BR 101 km 20": os dois números são da rodovia, não de uma casa.
    if (/^km\.?$/i.test(tokens[i + 1] ?? "")) continue;
    if (/^km\.?$/i.test(tokens[i - 1]!)) continue;

    const inicio = MARCADOR_DE_NUMERO.test(tokens[i - 1]!) ? i - 1 : i;
    const antes = tokens.slice(0, inicio).join(" ");
    if (!antes) return trecho;

    return [antes, tokens[i]!, tokens.slice(i + 1).join(" ")]
      .filter(Boolean)
      .join(", ");
  }

  return trecho;
}

function semAcentos(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Acrescenta a cidade quando o endereço claramente não tem nenhuma.
 *
 * Conservador de propósito: mandar o montador para a rua certa na cidade
 * errada é pior do que a busca não achar nada. Só completa quando não há UF
 * no fim, o nome da cidade padrão não aparece em lugar nenhum, e sobraram no
 * máximo três pedaços — que é o formato de quem só tem rua, número e bairro.
 * "Rua A, 12, Centro, Ilhéus" tem quatro e fica como está.
 */
function comCidadePadrao(partes: string[]) {
  const endereco = partes.join(", ");
  if (!CIDADE_PADRAO) return endereco;
  if (partes.length > 3) return endereco;
  if (SO_A_UF.test(partes[partes.length - 1] ?? "")) return endereco;

  const texto = semAcentos(endereco);
  const jaCitada = semAcentos(CIDADE_PADRAO)
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 2)
    .some((p) => texto.includes(p));
  if (jaCitada) return endereco;

  return `${endereco}, ${CIDADE_PADRAO}`;
}

/**
 * Deixa o endereço no formato que a busca do Waze entende.
 *
 * O endereço chega como uma linha só, do jeito que a loja digitou ou que o
 * CentralSync mandou -- e vem com coisas que o Google entende e o Waze não:
 *
 *   Rua José Bonifácio, 364 - Santo Antônio, Itabuna - BA (CEP: 45602-132)
 *   RUA 25 DE DEZEMBRO 145 SAO CAETANO COD.GILVAN RODRIGUES
 *
 * O buscador do Waze é bem menos tolerante que o do Google: complemento
 * entre parênteses, CEP, código do pedido e ponto de referência derrubam a
 * busca, e o app abre sem achar nada -- que é o "clica no Waze e não vai"
 * relatado por quem usa. Rua e número grudados e a falta da cidade têm o
 * mesmo efeito.
 *
 * Google Maps continua recebendo o endereço inteiro (linkMapa), porque lá o
 * texto extra ajuda em vez de atrapalhar.
 */
export function enderecoParaNavegacao(endereco: string) {
  const semComplemento = endereco
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
    .replace(/\s+/g, " ");

  // Corta a observação pedaço a pedaço, não da primeira ocorrência até o
  // fim: em "Rua A, 12, prox. ao mercado, Itabuna - BA" a cidade vem depois
  // da referência, e cortar o resto jogaria fora justamente o que o Waze
  // mais precisa.
  const partes = semComplemento
    .split(",")
    .map((parte) => cortarNaReferencia(parte).replace(/^[\s.;-]+|[\s.;-]+$/g, "").trim())
    .filter(Boolean);

  // Endereço que era só um complemento entre parênteses ficaria vazio aqui
  // -- melhor mandar o original e deixar o Waze tentar do que abrir vazio.
  if (partes.length === 0) return endereco.trim();

  // Re-separado depois do número entrar porque é a contagem de pedaços que
  // diz se falta cidade: "RUA X 145 BAIRRO" chega aqui como um pedaço só e
  // sai como três.
  const comNumero = [separarNumeroDaRua(partes[0]!), ...partes.slice(1)]
    .join(", ")
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);

  return comCidadePadrao(comNumero).replace(/\s+/g, " ").trim();
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
