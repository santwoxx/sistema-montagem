"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizarCnpj, ehErroCnpjDuplicado } from "@/lib/cnpj";
import {
  interpretarTextoNota,
  interpretarXmlDeNota,
  type DadosImportados,
} from "@/lib/nota-fiscal";

// A leitura em si (XML e texto de OCR) vive em lib/nota-fiscal.ts, que é
// código puro e testável. Aqui ficam só as ações: conferir permissão,
// validar o que chegou e falar com o banco.
export type { DadosImportados };

const TAMANHO_MAXIMO_XML = 8 * 1024 * 1024;
const TAMANHO_MAXIMO_TEXTO_OCR = 20_000;

export async function importarNotaAction(formData: FormData): Promise<DadosImportados> {
  await requireAdmin();

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione um arquivo XML." };
  }

  if (arquivo.size > TAMANHO_MAXIMO_XML) {
    return { erro: "Arquivo muito grande (máximo 8 MB)." };
  }

  const nomeArquivo = arquivo.name.toLowerCase();

  try {
    if (nomeArquivo.endsWith(".xml") || arquivo.type.includes("xml")) {
      return interpretarXmlDeNota(await arquivo.text());
    }
    return {
      erro:
        "Formato não suportado por aqui. Envie um arquivo XML, ou use o campo de foto/imagem para notas impressas ou fotografadas.",
    };
  } catch (error) {
    console.error("Falha ao importar nota:", error);
    return { erro: "Não consegui ler esse arquivo. Confira se ele não está corrompido." };
  }
}

export async function importarNotaTextoAction(texto: string): Promise<DadosImportados> {
  await requireAdmin();

  const limpo = String(texto || "").slice(0, TAMANHO_MAXIMO_TEXTO_OCR);
  if (limpo.trim().length < 15) {
    return {
      erro:
        "Não consegui reconhecer texto suficiente nessa imagem. Tente uma foto mais nítida e bem enquadrada.",
    };
  }

  return interpretarTextoNota(limpo);
}

// --- Cadastro automático da loja ---------------------------------------

export type ResultadoResolucaoLoja = {
  lojaId: string;
  nome: string;
  criada: boolean;
};

// Procura uma loja já cadastrada que bata com o nome/CNPJ lido na nota; se
// não achar nenhuma, cadastra uma nova automaticamente. É assim que a
// importação atende ao pedido de "se a empresa não estiver cadastrada, o
// sistema cadastra" — sem exigir que o admin cadastre a loja à parte antes
// de importar a primeira nota dela.
export async function resolverOuCriarLojaAction(
  nomeSugerido: string,
  cnpjSugerido?: string
): Promise<ResultadoResolucaoLoja | null> {
  await requireAdmin();

  const nome = String(nomeSugerido || "").trim();
  if (!nome) return null;

  const cnpj = normalizarCnpj(cnpjSugerido);

  if (cnpj) {
    const porCnpj = await prisma.loja.findUnique({ where: { cnpj } });
    if (porCnpj) return { lojaId: porCnpj.id, nome: porCnpj.nome, criada: false };
  }

  const todas = await prisma.loja.findMany({ select: { id: true, nome: true, cnpj: true } });
  const nomeNota = nome.toLowerCase();
  const porNome = todas.find((l) => {
    const nomeLoja = l.nome.toLowerCase();
    return nomeNota.includes(nomeLoja) || nomeLoja.includes(nomeNota);
  });

  if (porNome) {
    // Achou pelo nome mas essa loja ainda não tinha CNPJ salvo — completa,
    // assim a próxima importação já reconhece direto pelo CNPJ.
    if (cnpj && !porNome.cnpj) {
      await prisma.loja.update({ where: { id: porNome.id }, data: { cnpj } }).catch(() => {});
    }
    return { lojaId: porNome.id, nome: porNome.nome, criada: false };
  }

  try {
    const nova = await prisma.loja.create({ data: { nome, cnpj } });
    revalidatePath("/admin/lojas");
    return { lojaId: nova.id, nome: nova.nome, criada: true };
  } catch (error) {
    // Corrida rara: duas importações da mesma loja nova ao mesmo tempo.
    if (cnpj && ehErroCnpjDuplicado(error)) {
      const existente = await prisma.loja.findUnique({ where: { cnpj } });
      if (existente) return { lojaId: existente.id, nome: existente.nome, criada: false };
    }
    throw error;
  }
}
