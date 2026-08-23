// Preparo das fotos no próprio aparelho, antes de subir para o servidor.
//
// Toda foto do sistema (produto montado, ocorrência, perfil, manual) sobe
// dentro de uma Server Action, e o corpo de uma Server Action tem limite de
// tamanho (ver `experimental.serverActions.bodySizeLimit` no next.config.ts;
// o padrão do Next são 1 MB). Foto de celular hoje sai com 2 a 6 MB — ou
// seja, o envio estourava o limite e morria antes de chegar na action, sem
// mensagem nenhuma para quem estava com o celular na mão.
//
// Reduzir aqui resolve os dois lados do problema: cabe no limite e sobe
// rápido mesmo na internet ruim da rua, que é onde o montador está.

const LADO_MAXIMO_PADRAO = 1600;
const QUALIDADE_PADRAO = 0.82;

type Opcoes = {
  /** Maior lado da imagem final, em pixels. */
  ladoMaximo?: number;
  /** Qualidade do JPEG, de 0 a 1. */
  qualidade?: number;
};

/**
 * Devolve uma versão menor da imagem (JPEG redimensionado). Nunca lança:
 * se o navegador não conseguir processar o arquivo, devolve o original —
 * melhor tentar enviar grande do que travar a conclusão da montagem.
 */
export async function comprimirImagem(
  arquivo: File,
  { ladoMaximo = LADO_MAXIMO_PADRAO, qualidade = QUALIDADE_PADRAO }: Opcoes = {}
): Promise<File> {
  // GIF animado vira um quadro só se passar pelo canvas; SVG não tem
  // tamanho intrínseco confiável. Nos dois casos, sobe como veio.
  if (!arquivo.type.startsWith("image/")) return arquivo;
  if (arquivo.type === "image/gif" || arquivo.type === "image/svg+xml") return arquivo;

  try {
    const imagem = await carregarImagem(arquivo);
    const largura = "naturalWidth" in imagem ? imagem.naturalWidth : imagem.width;
    const altura = "naturalHeight" in imagem ? imagem.naturalHeight : imagem.height;
    if (!largura || !altura) return arquivo;

    const escala = Math.min(1, ladoMaximo / Math.max(largura, altura));
    const novaLargura = Math.round(largura * escala);
    const novaAltura = Math.round(altura * escala);

    const canvas = document.createElement("canvas");
    canvas.width = novaLargura;
    canvas.height = novaAltura;
    const contexto = canvas.getContext("2d");
    if (!contexto) return arquivo;
    contexto.drawImage(imagem, 0, 0, novaLargura, novaAltura);
    if (typeof ImageBitmap !== "undefined" && imagem instanceof ImageBitmap) {
      imagem.close();
    }

    const menor = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", qualidade);
    });
    // Foto já pequena (ou print de tela que fica maior em JPEG): mantém o
    // original em vez de piorar a imagem sem ganhar tamanho.
    if (!menor || menor.size >= arquivo.size) return arquivo;

    return new File([menor], trocarParaJpg(arquivo.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn("Não consegui reduzir a imagem; enviando o arquivo original.", e);
    return arquivo;
  }
}

/**
 * Troca o arquivo escolhido num `<input type="file">` — usado nos
 * formulários que ainda enviam pelo `<form action={...}>` nativo, para que
 * o que sobe seja a versão reduzida e não a foto original do celular.
 * Devolve false se o navegador não permitir a troca (aí sobe o original).
 */
export function trocarArquivoDoInput(input: HTMLInputElement, arquivo: File) {
  try {
    const transferencia = new DataTransfer();
    transferencia.items.add(arquivo);
    input.files = transferencia.files;
    return input.files[0] === arquivo;
  } catch (e) {
    console.warn("Navegador não deixou trocar o arquivo do campo.", e);
    return false;
  }
}

// A câmera do iPhone entrega HEIC e a do Android entrega JPEG — depois do
// canvas os dois viram JPEG, então o nome precisa acompanhar.
function trocarParaJpg(nome: string) {
  const base = nome.replace(/\.[^.]*$/, "").trim();
  return `${base || "foto"}.jpg`;
}

async function carregarImagem(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" respeita a orientação gravada no EXIF: sem isso a foto
      // tirada com o celular deitado sobe de lado.
      return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    } catch {
      // Safari antigo não aceita as opções — cai no <img> abaixo.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem escolhida."));
    };
    img.src = url;
  });
}
