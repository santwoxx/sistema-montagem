// Leitura de nota fiscal: XML da NFe e texto de DANFE vindo do OCR.
//
// Mora fora de lib/actions/importar.ts porque aquele arquivo é "use server"
// -- lá só é possível exportar funções assíncronas, e um arquivo de Server
// Actions não pode ser importado por um teste (as ações começam checando
// sessão/permissão). Aqui não há sessão, banco nem rede: entra texto, sai
// o que foi possível reconhecer. É o pedaço mais frágil do sistema (dezenas
// de heurísticas sobre um texto que nunca vem igual duas vezes), e agora é
// o mais coberto por teste -- ver testes/nota-fiscal.test.ts.

import { XMLParser } from "fast-xml-parser";
import { normalizarCnpj } from "@/lib/cnpj";
import { paraNumeroBr } from "@/lib/format";

export type DadosImportados = {
  clienteNome?: string;
  clienteTelefone?: string;
  clienteEndereco?: string;
  descricaoServico?: string;
  valorServico?: string;
  numeroPedido?: string;
  lojaNomeSugerida?: string;
  lojaCnpjSugerido?: string;
  textoOriginal?: string;
  notaUrl?: string;
  erro?: string;
};

// Procura por uma chave em qualquer nível de um objeto (a estrutura de uma
// NFe pode vir com ou sem alguns níveis de aninhamento, dependendo do
// emissor, então buscamos a chave em vez de fixar um caminho exato).
function procurarChave(obj: unknown, chave: string): unknown {
  if (obj === null || typeof obj !== "object") return undefined;
  const registro = obj as Record<string, unknown>;
  if (chave in registro) return registro[chave];
  for (const valor of Object.values(registro)) {
    const encontrado = procurarChave(valor, chave);
    if (encontrado !== undefined) return encontrado;
  }
  return undefined;
}

function textoDe(valor: unknown): string | undefined {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor === "string" || typeof valor === "number") {
    const texto = String(valor).trim();
    return texto || undefined;
  }
  return undefined;
}

function paraValorBrasileiro(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  return valor.includes(",") ? valor : valor.replace(".", ",");
}

export function interpretarXmlDeNota(xml: string): DadosImportados {
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
  const doc: unknown = parser.parse(xml);

  const infNFe = procurarChave(doc, "infNFe") ?? doc;
  const ide = procurarChave(infNFe, "ide");
  const emit = procurarChave(infNFe, "emit");
  const dest = procurarChave(infNFe, "dest");
  const enderDest = procurarChave(dest, "enderDest");
  const totalNota = procurarChave(infNFe, "ICMSTot");

  if (!dest && !emit && !totalNota) {
    return {
      erro:
        "Esse XML não parece ser uma nota fiscal eletrônica (NFe/NFCe). Confira o arquivo.",
    };
  }

  let detalhes = procurarChave(infNFe, "det");
  if (detalhes && !Array.isArray(detalhes)) detalhes = [detalhes];

  const produtos = Array.isArray(detalhes)
    ? detalhes
        .map((item) => textoDe(procurarChave(item, "xProd")))
        .filter((v): v is string => Boolean(v))
        .join("; ")
    : undefined;

  const enderecoPartes = [
    textoDe(procurarChave(enderDest, "xLgr")),
    textoDe(procurarChave(enderDest, "nro")),
    textoDe(procurarChave(enderDest, "xBairro")),
    textoDe(procurarChave(enderDest, "xMun")),
    textoDe(procurarChave(enderDest, "UF")),
  ].filter((v): v is string => Boolean(v));

  return {
    clienteNome: textoDe(procurarChave(dest, "xNome")),
    clienteTelefone: textoDe(procurarChave(dest, "fone")),
    clienteEndereco: enderecoPartes.length ? enderecoPartes.join(", ") : undefined,
    descricaoServico: produtos,
    valorServico: paraValorBrasileiro(textoDe(procurarChave(totalNota, "vNF"))),
    numeroPedido: textoDe(procurarChave(ide, "nNF")),
    lojaNomeSugerida: textoDe(procurarChave(emit, "xNome")),
    lojaCnpjSugerido: normalizarCnpj(textoDe(procurarChave(emit, "CNPJ"))) ?? undefined,
  };
}

// --- Importação por foto/imagem (OCR) ---------------------------------
//
// O reconhecimento de texto em si (OCR) roda no navegador do admin, via
// tesseract.js — funciona igual em computador e celular, sem custo e sem
// depender de nenhum serviço de IA paga, e evita os problemas de rodar
// bibliotecas pesadas de leitura de imagem/PDF numa função serverless (foi
// por causa disso que a importação de PDF tinha sido desativada antes).
//
// Esta ação recebe só o TEXTO já reconhecido pelo navegador e tenta
// localizar os campos de uma nota fiscal (DANFE) nele, usando os rótulos
// padronizados que a Sefaz exige em todo DANFE — "DESTINATÁRIO/REMETENTE",
// "VALOR TOTAL DA NOTA" etc. — em vez de depender de uma posição fixa na
// página, já que a leitura por OCR de uma foto nunca preserva o layout
// exato. É um "melhor esforço": o texto lido também é devolvido inteiro
// para o admin conferir/copiar manualmente o que não for reconhecido.

const ROTULO_DESTINATARIO = /DESTINAT[AÁ]RI|REMETENTE|NOME\s*\/?\s*RAZ[AÃ]O\s*SOCIAL/;

// O canhoto (tira de recibo no topo do DANFE) também cita a palavra
// "destinatário" dentro de uma frase corrida (ex: "...DESTINATÁRIO: FULANO
// - Rua tal..."), antes da seção de dados do cliente propriamente dita, que
// vem sempre com este título exato mais abaixo. Se usarmos o rótulo solto
// acima pra achar onde corta a nota, ele bate primeiro no canhoto — cedo
// demais — e mistura cabeçalho da loja com dados do cliente. Por isso
// preferimos achar este título específico primeiro.
const ROTULO_SECAO_DESTINATARIO = /DESTINAT[AÁ]RI[OA]?\s*\/\s*REMETENTE/;

// Linhas que são rótulos/cabeçalhos conhecidos do DANFE — usadas para não
// confundir um rótulo com o valor de outro campo.
const ROTULOS_CONHECIDOS =
  /DANFE|DOCUMENTO AUXILIAR|NATUREZA DA OPERA|PROTOCOLO DE AUTORIZA|INSCRI[CÇ][AÃ]O ESTADUAL|CNPJ|CPF|CEP|DESTINAT[AÁ]RI|REMETENTE|NOME\s*\/?\s*RAZ[AÃ]O SOCIAL|ENDERE[CÇ]O|BAIRRO|DISTRITO|MUNIC[IÍ]PIO|FONE|FAX|^UF$|INDICADOR|DATA DA EMISS|DATA DA ENTRADA|HORA DA ENTRADA|C[AÁ]LCULO DO IMPOSTO|BASE DE C[AÁ]LCULO|VALOR DO|VALOR TOTAL|OUTRAS DESP|TRANSPORTADOR|VOLUMES TRANSPORTADOS|RAZ[AÃ]O SOCIAL|C[OÓ]DIGO ANTT|PLACA|DADOS DO PRODUTO|DESCRI[CÇ][AÃ]O DO PRODUTO|C[OÓ]D\.?\s*PROD|NCM|CST|CFOP|UNID|QTD|ALIQUOTA|DADOS ADICIONAIS|INFORMA[CÇ][OÕ]ES COMPLEMENTARES|RESERVADO AO FISCO|CHAVE DE ACESSO|CONSULTA DE AUTENTICIDADE|SA[IÍ]DA|ENTRADA|S[EÉ]RIE/;

// Faixa Unicode dos acentos "soltos" que sobram depois do normalize("NFD")
// (ex: "Ã" vira "A" + este caractere combinante).
const DIACRITICOS_NFD = /[̀-ͯ]/g;

function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(DIACRITICOS_NFD, "")
    .toUpperCase();
}

function linhasValidas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// Filtro padrão de "isso parece um valor de verdade, não lixo de OCR":
// exige pelo menos duas letras. Sozinho não garante muito, mas já descarta
// bordas de tabela mal lidas (pontuação/dígitos soltos) sem exigir um
// formato específico, já que cada campo tem o seu.
function pareceValorValido(texto: string): boolean {
  return (texto.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? []).length >= 2;
}

// Nome de cliente: só letras/espaço/apóstrofo/hífen/ponto, sem dígito, e
// pelo menos duas palavras (nome + sobrenome) — mais rígido que o filtro
// genérico, porque um nome errado é pior que deixar o campo em branco pro
// admin preencher. O nome no DANFE é sempre impresso em maiúsculas (ou, no
// mínimo, cada palavra capitalizada de forma consistente) — lixo de OCR
// típico mistura maiúscula/minúscula dentro da MESMA palavra (ex:
// "eNFICA"), o que uma palavra de nome de verdade nunca faz.
function pareceNome(texto: string): boolean {
  if (texto.length > 80 || /\d/.test(texto)) return false;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.\- ]*$/.test(texto)) return false;
  const palavras = texto.split(/\s+/).filter(Boolean);
  const palavraConsistente = (p: string) =>
    /^[A-ZÀ-Ö][A-ZÀ-Ö'.-]*$/.test(p) || /^[A-ZÀ-Ö][a-zà-ÿ'.-]*$/.test(p);
  if (!palavras.every(palavraConsistente)) return false;
  const substanciais = palavras.filter(
    (p) => p.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").length >= 2
  );
  return substanciais.length >= 2;
}

// Procura um rótulo (ex: "NOME/RAZÃO SOCIAL") nas linhas e devolve o valor
// associado — pode estar depois do rótulo na mesma linha, ou ser a próxima
// linha "útil" (que não seja, ela mesma, outro rótulo conhecido), já que o
// OCR de uma tabela às vezes separa rótulo e valor em linhas diferentes.
// "aceitar" permite exigir um formato mais específico (ex: nome de
// pessoa) — se o primeiro candidato não bate, continua procurando em vez
// de aceitar qualquer coisa que não pareça um rótulo.
function valorAposRotulo(
  linhas: string[],
  rotulo: RegExp,
  inicio = 0,
  fim = linhas.length,
  aceitar: (candidato: string) => boolean = pareceValorValido
): string | undefined {
  for (let i = inicio; i < fim; i++) {
    const linha = linhas[i];
    const m = semAcento(linha).match(rotulo);
    if (!m || m.index === undefined) continue;

    const restoMesmaLinha = linha.slice(m.index + m[0].length).replace(/^[:\-\s]+/, "").trim();
    if (
      restoMesmaLinha.length > 2 &&
      !ROTULOS_CONHECIDOS.test(semAcento(restoMesmaLinha)) &&
      aceitar(restoMesmaLinha)
    ) {
      return restoMesmaLinha;
    }

    for (let j = i + 1; j < Math.min(i + 3, fim); j++) {
      const candidato = linhas[j].trim();
      if (
        candidato.length > 2 &&
        !ROTULOS_CONHECIDOS.test(semAcento(candidato)) &&
        aceitar(candidato)
      ) {
        return candidato;
      }
    }
  }
  return undefined;
}

function primeiroMatch(texto: string, regex: RegExp): string | undefined {
  const m = texto.match(regex);
  return m?.[1]?.trim() || m?.[0]?.trim();
}

function todosOsMatches(texto: string, regex: RegExp): string[] {
  return [...texto.matchAll(regex)].map((m) => m[0]);
}

export function interpretarTextoNota(textoOriginal: string): DadosImportados {
  // Troca espacos nao separaveis (comuns na saida do OCR) por espacos normais.
  // Limpa também caracteres que o OCR frequentemente inventa ao ler as bordas
  // das tabelas do DANFE (como | e [ e ]), pois atrapalham as buscas.
  const texto = textoOriginal
    .replace(/ /g, " ")
    .replace(/[|\[\]{}_]/g, " ");
  const linhas = linhasValidas(texto);

  if (linhas.length === 0) {
    return {
      erro: "Não consegui reconhecer texto nessa imagem. Tente uma foto mais nítida, bem iluminada e sem cortar as bordas da nota.",
      textoOriginal,
    };
  }

  // A seção do destinatário (cliente) começa depois da seção do emitente
  // (a loja) em todo DANFE — usamos essa divisão pra não misturar telefone,
  // endereço e documento de um com o do outro. Damos preferência ao título
  // exato da seção ("DESTINATÁRIO/REMETENTE"); só caímos pro rótulo solto
  // (que também bate na menção do canhoto, mais cedo na página) se aquele
  // título não for encontrado.
  const indiceSecaoDestinatario = linhas.findIndex((l) =>
    ROTULO_SECAO_DESTINATARIO.test(semAcento(l))
  );
  const indiceDestinatario =
    indiceSecaoDestinatario >= 0
      ? indiceSecaoDestinatario
      : linhas.findIndex((l) => ROTULO_DESTINATARIO.test(semAcento(l)));
  const corte = indiceDestinatario >= 0 ? indiceDestinatario : Math.ceil(linhas.length / 2);

  // Nome da loja: o cabeçalho/timbre impresso colado no título "DANFE" —
  // usamos esse título como âncora (mais confiável que "a primeira linha
  // da página"), porque o canhoto (a tira de recibo no topo, ver acima)
  // tem frases curtas antes disso — como "TOTAL: R$ ..." e "DATA DE
  // RECEBIMENTO" — que passariam pelo filtro de rótulo conhecido e
  // virariam um "nome de loja" sem sentido. Procuramos de trás pra frente
  // a partir do "DANFE" e paramos na primeira linha válida, já que o
  // cabeçalho fica logo antes dele, não várias linhas distante.
  function pareceNomeDeLoja(l: string): boolean {
    return (
      l.length >= 3 &&
      l.length <= 80 &&
      !ROTULOS_CONHECIDOS.test(semAcento(l)) &&
      !/R\$|\d{1,3}(?:\.\d{3})*,\d{2}/.test(l)
    );
  }
  const indiceDanfe = linhas
    .slice(0, corte)
    .findIndex((l) => /DANFE|DOCUMENTO AUXILIAR/.test(semAcento(l)));
  let lojaNomeSugerida: string | undefined;
  if (indiceDanfe >= 0) {
    for (let i = indiceDanfe - 1; i >= Math.max(0, indiceDanfe - 6); i--) {
      if (pareceNomeDeLoja(linhas[i])) {
        lojaNomeSugerida = linhas[i];
        break;
      }
    }
  } else {
    lojaNomeSugerida = linhas.slice(0, corte).find(pareceNomeDeLoja);
  }

  const RE_CNPJ = /(?<!\d)\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}(?!\d)/g;
  const RE_TELEFONE = /\(?\d{2}\)?\s?(?:9\s?)?\d{4}[-\s]?\d{4}(?!\d)/g;
  const RE_MOEDA = /\d{1,3}(?:\.\d{3})*,\d{2}/g;

  // Numa tabela mal reconhecida, o OCR às vezes cola numa linha só o valor
  // de um campo com o começo do próximo (ex: endereço seguido do CEP, ou
  // município seguido de telefone/UF/hora) — cortamos o candidato no
  // primeiro pedaço que bate com outro tipo de campo conhecido, pra não
  // salvar tudo isso junto como se fosse endereço/bairro/município.
  const RE_CEP = /(?<!\d)\d{2}\.?\d{3}-?\d{3}(?!\d)/;
  const RE_DATA = /\b\d{2}[-/]\d{2}[-/]\d{4}\b/;
  const RE_HORA = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;
  const RE_INDICADOR_IE = /\d\s*-\s*(?:N[AÃ]O\s*)?CONTRIBUINTE/i;
  const RE_OUTRO_CAMPO = new RegExp(
    [RE_CEP.source, RE_TELEFONE.source, RE_DATA.source, RE_HORA.source, RE_INDICADOR_IE.source].join(
      "|"
    ),
    "i"
  );
  // Colunas da tabela do DANFE chegam separadas por corridas de espaço.
  // Sem colapsar, o endereço era gravado como "Rua X, 128        Centro".
  function normalizarEspacos(valor: string) {
    return valor.replace(/\s+/g, " ").trim();
  }

  function cortarEm(valor: string | undefined, regex: RegExp): string | undefined {
    if (!valor) return undefined;
    const m = valor.match(regex);
    const cortado = normalizarEspacos(
      m && m.index !== undefined ? valor.slice(0, m.index) : valor
    );
    return cortado || undefined;
  }

  function cortarEmOutroCampo(valor: string | undefined): string | undefined {
    return cortarEm(valor, RE_OUTRO_CAMPO);
  }

  // Para o nome do cliente o corte precisa incluir CPF/CNPJ: na linha do
  // destinatário o documento fica na coluna ao lado do nome, e o OCR entrega
  // os dois grudados ("MARIA SOUZA DA SILVA   111.222.333-44   12/08/2026").
  // Como pareceNome recusa qualquer coisa com dígito, o nome inteiro era
  // descartado e o campo chegava vazio para o admin preencher na mão.
  const RE_CPF = /(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}(?!\d)/;
  const RE_DOCUMENTO_OU_OUTRO_CAMPO = new RegExp(
    [RE_CPF.source, RE_CNPJ.source, RE_OUTRO_CAMPO.source].join("|"),
    "i"
  );
  function cortarNome(valor: string | undefined): string | undefined {
    return cortarEm(valor, RE_DOCUMENTO_OU_OUTRO_CAMPO);
  }

  const cnpjsAntes = todosOsMatches(linhas.slice(0, corte).join("\n"), RE_CNPJ);
  const lojaCnpjSugerido = cnpjsAntes[0] ? (normalizarCnpj(cnpjsAntes[0]) ?? undefined) : undefined;

  const textoDestinatario = linhas.slice(corte).join("\n");

  const clienteNome = cortarNome(
    valorAposRotulo(
      linhas,
      /NOME\s*\/?\s*RAZ[AÃ]O SOCIAL/,
      corte,
      linhas.length,
      // Testa o candidato já cortado: quem decide é o nome, não o CPF que
      // veio junto da coluna vizinha.
      (candidato) => pareceNome(cortarNome(candidato) ?? "")
    )
  );

  const telefonesDepois = todosOsMatches(textoDestinatario, RE_TELEFONE);
  const clienteTelefone = telefonesDepois[0];

  const enderecoValor = cortarEmOutroCampo(valorAposRotulo(linhas, /ENDERE[CÇ]O/, corte));
  const bairroValor = cortarEmOutroCampo(
    valorAposRotulo(linhas, /BAIRRO\s*\/?\s*DISTRITO/, corte)
  );
  const municipioValor = cortarEmOutroCampo(valorAposRotulo(linhas, /MUNIC[IÍ]PIO/, corte));
  const clienteEndereco = [...new Set([enderecoValor, bairroValor, municipioValor])]
    .filter((v): v is string => Boolean(v))
    .join(", ") || undefined;

  // "VALOR TOTAL DA NOTA" é a última coluna da tabela de impostos do DANFE
  // — pegamos o último valor em formato de moeda que aparece logo depois
  // do rótulo (a linha do rótulo e a linha dos valores costumam vir juntas
  // no texto lido, mesmo que a tabela em si não seja reconhecida).
  const janelaValorTotal = texto.match(/VALOR\s+TOTAL\s+DA\s+NOTA[\s\S]{0,120}/i)?.[0];
  const valoresTotal = janelaValorTotal ? todosOsMatches(janelaValorTotal, RE_MOEDA) : [];
  let valorServico = valoresTotal.at(-1);

  if (!valorServico) {
    // Sem o rótulo específico, usa o maior valor monetário encontrado na
    // nota inteira — geralmente é o total (sempre uma sugestão a conferir).
    const todosValores = todosOsMatches(texto, RE_MOEDA)
      .map((v) => paraNumeroBr(v))
      .filter((v) => Number.isFinite(v));
    if (todosValores.length) {
      const maior = Math.max(...todosValores);
      valorServico = maior.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    }
  }


  // O número da nota é impresso agrupado no DANFE ("Nº 000.000.404"). O
  // padrão antigo parava no primeiro grupo e gravava "000" como número do
  // pedido em toda nota lida por foto. Aqui o grupo inteiro é capturado e
  // depois normalizado (sem pontos, sem zeros à esquerda), chegando ao mesmo
  // "404" que o XML da mesma nota traz em <nNF>.
  const numeroBruto = primeiroMatch(
    texto,
    /N[ºo°]\s*[:.]?\s*(\d{1,3}(?:\.\d{3})+|\d{1,9})\b/
  );
  const numeroPedido = numeroBruto
    ? numeroBruto.replace(/\./g, "").replace(/^0+(?=\d)/, "") || undefined
    : undefined;

  // Restringe a busca da descrição à seção da tabela de produtos (depois
  // do título "DADOS DO PRODUTO/SERVIÇO") — sem isso, qualquer trecho
  // numérico em outra parte da nota (protocolo, chave de acesso, CNPJ...)
  // pode acidentalmente formar um "código + texto + NCM" e ser pego à toa.
  const indiceProdutos = linhas.findIndex((l) =>
    /DADOS DO PRODUTO|DESCRI[CÇ][AÃ]O DO PRODUTO/.test(semAcento(l))
  );
  const textoProdutos = indiceProdutos >= 0 ? linhas.slice(indiceProdutos).join("\n") : texto;

  // Descrição do produto/serviço: no DANFE, o texto do produto fica entre
  // o código do item e o código NCM, ambos numéricos — é frágil (depende
  // muito da qualidade da foto), então quando não encontra deixa em branco
  // para o admin completar, como já acontece hoje quando o XML não traz
  // produtos. Exclui explicitamente as abreviações da própria linha de
  // cabeçalho da tabela (NCM, CST, CFOP, UNID, QTD, ICMS, IPI...): elas
  // também batem no padrão de "código" (letras/dígitos, até 15 caracteres)
  // e, sem essa exclusão, "âncoram" a busca nelas em vez de no código de
  // verdade (ex: "000310"), engolindo o começo da descrição junto com ele.
  let descricaoServico = primeiroMatch(
    textoProdutos,
    /\b(?!(?:NCM|SH|CST|CFOP|UNID|QTD|VLR|UNIT|TOTAL|BC|ICMS|IPI|ALIQUOTAS|PROD|COD)\b)[A-Z0-9-]{1,15}\b\s+([A-ZÀ-ÖØ-öø-ÿ0-9][A-ZÀ-ÖØ-öø-ÿ0-9/\-.,() ]{4,150}?)\s+\d{7,8}\b/i
  );

  // Muitas vezes a descrição do produto quebra em várias linhas na coluna da tabela.
  // Se achamos a primeira linha, pegamos as próximas que pareçam ser continuação do texto.
  if (descricaoServico) {
    const linhaProdutoIdx = linhas.findIndex((l) => l.includes(descricaoServico as string));
    if (linhaProdutoIdx >= 0) {
      let extra = "";
      for (let i = linhaProdutoIdx + 1; i < Math.min(linhaProdutoIdx + 4, linhas.length); i++) {
        const linha = linhas[i];
        // Se achou um rótulo do DANFE, um valor de moeda (outra coluna/total) ou linha vazia, parou.
        if (
          ROTULOS_CONHECIDOS.test(semAcento(linha)) ||
          /\d{1,3}(?:\.\d{3})*,\d{2}/.test(linha) ||
          linha.length < 3
        ) {
          break;
        }
        extra += " " + linha;
      }
      descricaoServico += extra;
    }
    // Ao juntar as linhas da coluna, sobra às vezes um token solto de
    // bordas de tabela mal lidas (ex: "'", ")"), e no final da descrição
    // (última linha lida) uma sequência de letras soltas sem sentido (ex:
    // "o ) o"). Descarta tokens que são só pontuação e, no fim do texto,
    // tokens de uma letra só — sem mexer no meio da frase, onde uma letra
    // solta pode ser uma palavra de verdade (ex: "E" de "kit E espelhos").
    const palavras = descricaoServico
      .split(/\s+/)
      .filter((p) => /[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(p));
    while (
      palavras.length > 1 &&
      palavras.at(-1)!.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").length === 1 &&
      /^[A-Za-zÀ-ÖØ-öø-ÿ][.,;:'"()-]*$/.test(palavras.at(-1)!)
    ) {
      palavras.pop();
    }
    descricaoServico = palavras.join(" ") || undefined;
  }

  return {
    clienteNome,
    clienteTelefone,
    clienteEndereco,
    descricaoServico,
    valorServico,
    numeroPedido,
    lojaNomeSugerida,
    lojaCnpjSugerido,
    textoOriginal,
  };
}
