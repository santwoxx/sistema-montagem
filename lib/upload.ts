import { put } from "@vercel/blob";

// Teto de cada arquivo que sobe por uma Server Action. Tem que ficar abaixo
// do `serverActions.bodySizeLimit` do next.config.ts (4 MB) com folga para o
// que o multipart acrescenta (limites de parte, cabeçalhos, as assinaturas
// que vão no mesmo envio). Acima disso o Next recusa o pedido inteiro antes
// de a action rodar — e aí não há mensagem nossa para mostrar.
export const TAMANHO_MAXIMO_UPLOAD = 3 * 1024 * 1024; // 3 MB
export const TAMANHO_MAXIMO_UPLOAD_TEXTO = "3 MB";

export type ResultadoUpload = { ok: true; url: string } | { ok: false; erro: string };

/**
 * Sobe um arquivo para o Vercel Blob devolvendo erro em texto em vez de
 * explodir. Sem isso, qualquer falha (loja de blobs não conectada ao projeto,
 * token vencido, internet caindo no meio do envio) derrubava a tela inteira
 * no "Algo deu errado" — o montador ficava sem saber se a montagem foi
 * concluída ou não, e o admin não tinha nenhuma pista do que configurar.
 */
export async function enviarArquivo(caminho: string, arquivo: File): Promise<ResultadoUpload> {
  try {
    const blob = await put(caminho, arquivo, {
      access: "public",
      addRandomSuffix: true,
    });
    return { ok: true, url: blob.url };
  } catch (e) {
    console.error("Falha ao enviar arquivo para o Vercel Blob:", e);
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        ok: false,
        erro:
          "O armazenamento de fotos não está configurado. Avise o administrador: falta conectar um Blob Store ao projeto no Vercel (variável BLOB_READ_WRITE_TOKEN).",
      };
    }
    return {
      ok: false,
      erro: "Não consegui salvar o arquivo agora. Confira a internet e tente de novo.",
    };
  }
}

/** Extensão a usar no nome do arquivo salvo, a partir do tipo enviado. */
export function extensaoDe(arquivo: File, padrao = "jpg") {
  const doTipo = arquivo.type.split("/")[1];
  if (doTipo) return doTipo.replace(/[^a-z0-9]/gi, "") || padrao;
  const partes = arquivo.name.split(".");
  return partes.length > 1 ? partes.pop()!.replace(/[^a-z0-9]/gi, "") || padrao : padrao;
}
