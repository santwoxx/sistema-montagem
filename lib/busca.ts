// Regras da busca geral (a lupa do topo): como o texto digitado vira
// palavras e quando um registro "bate" com elas.
//
// Fica separado da consulta ao banco (lib/buscar-montagens.ts) para poder
// ser testado sem banco -- e porque as mesmas regras rodam dos dois lados:
// no SQL, para as montagens, e aqui em JS, para os montadores e para
// agrupar os clientes. Se uma mudar, a outra tem que acompanhar.
//
// O que a busca aceita:
// - sem acento e sem maiúscula: "joao" encontra "João";
// - palavras em qualquer ordem e em campos diferentes: "maria centro"
//   encontra a Maria que mora no Centro;
// - telefone em qualquer formato: "98803-6706", "73988036706" e
//   "(73) 98803-6706" encontram o mesmo número, do jeito que ele tiver sido
//   gravado (o telefone é salvo como a loja ou o cliente digitou).

import { apenasDigitos, formatarData } from "@/lib/format";

/** Mais que isso é colar um parágrafo na lupa, não buscar. */
const TAMANHO_MAXIMO_TERMO = 100;
const MAXIMO_DE_PALAVRAS = 6;
/** Menos dígitos que isso casaria com quase qualquer telefone. */
const MINIMO_DIGITOS_TELEFONE = 4;

/**
 * Letras acentuadas e as mesmas sem acento, na mesma posição. É o que o SQL
 * usa no `translate()` para comparar sem acento -- o Postgres não tem o
 * `unaccent` sem instalar extensão. O teste garante que isto dá o mesmo
 * resultado que `semAcento` abaixo.
 */
export const LETRAS_ACENTUADAS = "áàâãäåéèêëíìîïóòôõöúùûüçñ";
export const LETRAS_SEM_ACENTO = "aaaaaaeeeeiiiiooooouuuucn";

/** Minúsculas e sem acento, para comparar texto do jeito que a busca compara. */
export function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Lê o termo que veio da URL (`?q=`), já aparado e com tamanho limitado. */
export function lerTermo(valor: string | string[] | undefined | null): string {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return (bruto ?? "").trim().slice(0, TAMANHO_MAXIMO_TERMO);
}

/** As palavras que a busca procura, normalizadas e sem repetição. */
export function palavrasDaBusca(termo: string): string[] {
  const normalizado = semAcento(termo).trim();

  // Telefone digitado com espaço -- "(73) 98803-6706" -- é uma coisa só.
  // Separado, o "(73)" teria que aparecer como texto, e o mesmo número
  // gravado como "73988036706" deixava de ser encontrado.
  if (digitosDeTelefone(normalizado) !== null) return [normalizado.replace(/\s+/g, "")];

  const unicas = new Set(normalizado.split(/\s+/).filter(Boolean));
  return [...unicas].slice(0, MAXIMO_DE_PALAVRAS);
}

/**
 * Os dígitos da palavra, quando ela parece um pedaço de telefone (sem
 * letras e com dígitos suficientes). Serve para achar "(73) 98803-6706"
 * digitando "988036706", e vice-versa.
 */
export function digitosDeTelefone(palavra: string): string | null {
  if (/\p{L}/u.test(palavra)) return null;
  const digitos = apenasDigitos(palavra);
  return digitos.length >= MINIMO_DIGITOS_TELEFONE ? digitos : null;
}

/** Escapa os curingas do LIKE, para "%" e "_" digitados valerem como texto. */
export function escaparLike(palavra: string): string {
  return palavra.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Se o registro bate com a busca: toda palavra precisa aparecer em algum dos
 * textos (ou, se for número de telefone, em algum dos telefones). É a mesma
 * regra do SQL em lib/buscar-montagens.ts.
 */
export function correspondeABusca(
  palavras: string[],
  campos: {
    textos: Array<string | null | undefined>;
    telefones?: Array<string | null | undefined>;
  }
): boolean {
  if (palavras.length === 0) return false;

  const textos = campos.textos.map((t) => semAcento(t ?? ""));
  const telefones = (campos.telefones ?? []).map((t) => apenasDigitos(t ?? ""));

  return palavras.every((palavra) => {
    if (textos.some((t) => t.includes(palavra))) return true;
    const digitos = digitosDeTelefone(palavra);
    return digitos !== null && telefones.some((t) => t.includes(digitos));
  });
}

/** A data que mais diz sobre uma montagem antiga, já com o rótulo. */
export function descreverData(montagem: {
  concluidoEm: Date | null;
  dataAgendada: Date | null;
  createdAt: Date;
}): string {
  if (montagem.concluidoEm) return `Concluída em ${formatarData(montagem.concluidoEm)}`;
  if (montagem.dataAgendada) return `Agendada para ${formatarData(montagem.dataAgendada)}`;
  return `Cadastrada em ${formatarData(montagem.createdAt)}`;
}

export type MontagemDeCliente = {
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEndereco: string;
  createdAt: Date;
  /** Quem montou (nome do montador ou "a própria empresa"), se alguém. */
  responsavel: string | null;
};

export type ClienteEncontrado = {
  nome: string;
  telefone: string | null;
  endereco: string;
  montagens: number;
  ultimaEm: Date;
  ultimoResponsavel: string | null;
};

/**
 * Junta as montagens encontradas por cliente, para a busca mostrar "quem é
 * esse cliente" antes da lista de serviços.
 *
 * Só entram as montagens em que a busca bateu nos dados do próprio cliente
 * (nome, telefone, endereço): buscar pelo nome de um montador não deve
 * listar como "cliente encontrado" cada pessoa que ele atendeu.
 *
 * O cliente não tem cadastro próprio -- os dados dele vivem em cada
 * montagem --, então o agrupamento é pelo nome (sem acento, sem espaço
 * sobrando). Telefone e endereço mostrados são os da montagem mais recente
 * que os tiver. `montagens` precisa vir da mais recente para a mais antiga.
 */
export function agruparClientes(
  montagens: MontagemDeCliente[],
  palavras: string[]
): ClienteEncontrado[] {
  const porNome = new Map<string, ClienteEncontrado>();

  for (const m of montagens) {
    const bate = correspondeABusca(palavras, {
      textos: [m.clienteNome, m.clienteEndereco, m.clienteTelefone],
      telefones: [m.clienteTelefone],
    });
    if (!bate) continue;

    const chave = semAcento(m.clienteNome).replace(/\s+/g, " ").trim();
    const existente = porNome.get(chave);
    if (!existente) {
      porNome.set(chave, {
        nome: m.clienteNome.trim(),
        telefone: m.clienteTelefone,
        endereco: m.clienteEndereco,
        montagens: 1,
        ultimaEm: m.createdAt,
        ultimoResponsavel: m.responsavel,
      });
      continue;
    }

    existente.montagens += 1;
    existente.telefone ??= m.clienteTelefone;
    existente.ultimoResponsavel ??= m.responsavel;
  }

  return [...porNome.values()];
}
