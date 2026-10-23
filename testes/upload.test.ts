import { describe, expect, it } from "vitest";
import { caminhoFotoDaMontagem, ehFotoDaMontagem } from "@/lib/upload";

// As fotos do comprovante sobem uma por envio e a conclusão recebe só os
// endereços. É ehFotoDaMontagem que impede gravar como comprovante (e mandar
// ao CentralSync) um endereço qualquer.

const BLOB = "https://abc123.public.blob.vercel-storage.com";
const ID = "cmabc123def456ghi789jkl0m";

describe("fotos do comprovante", () => {
  it("reconhece a foto subida para esta montagem", () => {
    // O Blob acrescenta um sufixo aleatório antes da extensão.
    expect(ehFotoDaMontagem(`${BLOB}/montagens/${ID}-1761220000000-k3f9-Xy7AbC.jpg`, ID)).toBe(
      true
    );
  });

  it("aceita o caminho que o próprio sistema gera", () => {
    const caminho = caminhoFotoDaMontagem(ID, "jpeg");
    expect(caminho.startsWith(`montagens/${ID}-`)).toBe(true);
    expect(caminho.endsWith(".jpeg")).toBe(true);
    expect(ehFotoDaMontagem(`${BLOB}/${caminho}`, ID)).toBe(true);
  });

  it("recusa foto de outra montagem ou de outra pasta", () => {
    expect(ehFotoDaMontagem(`${BLOB}/montagens/outra-1-a.jpg`, ID)).toBe(false);
    // Id que só começa igual ao desta montagem.
    expect(ehFotoDaMontagem(`${BLOB}/montagens/${ID}x-1-a.jpg`, ID)).toBe(false);
    expect(ehFotoDaMontagem(`${BLOB}/ocorrencias/${ID}-1-a.jpg`, ID)).toBe(false);
  });

  it("recusa endereço de fora do Blob ou que não é endereço", () => {
    expect(ehFotoDaMontagem(`https://site-de-fora.com/montagens/${ID}-1-a.jpg`, ID)).toBe(false);
    expect(
      ehFotoDaMontagem(`https://blob.vercel-storage.com.site-de-fora.com/montagens/${ID}-1-a.jpg`, ID)
    ).toBe(false);
    expect(ehFotoDaMontagem("não é endereço", ID)).toBe(false);
    expect(ehFotoDaMontagem(`${BLOB}/montagens/-1-a.jpg`, "")).toBe(false);
  });
});
