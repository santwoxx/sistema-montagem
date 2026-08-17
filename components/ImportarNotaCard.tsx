"use client";

import { useRef, useState } from "react";
import { Alerta } from "@/components/ui";
import {
  importarNotaAction,
  importarNotaTextoAction,
  resolverOuCriarLojaAction,
  type DadosImportados,
  type ResultadoResolucaoLoja,
} from "@/lib/actions/importar";

const TAMANHO_MAXIMO = 15 * 1024 * 1024; // 15 MB — fotos de celular podem ser grandes

/**
 * Card de "Importar nota" reutilizado nas telas que criam uma montagem a
 * partir de uma nota fiscal. Aceita o XML da NFe (lido no servidor) e fotos
 * ou imagens de notas impressas/DANFE (lidas por OCR no próprio navegador,
 * com tesseract.js — funciona igual em computador e celular, sem custo).
 *
 * Depois de extrair os dados, também resolve a loja emitente: se já existe
 * uma loja cadastrada com aquele nome/CNPJ, seleciona ela; senão, cadastra
 * uma loja nova automaticamente.
 */
export function ImportarNotaCard({
  onDados,
  onLojaResolvida,
}: {
  onDados: (dados: DadosImportados) => void;
  onLojaResolvida: (loja: ResultadoResolucaoLoja) => void;
}) {
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoLoja, setAvisoLoja] = useState<string | null>(null);
  const [textoLido, setTextoLido] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function tratarResultado(resultado: DadosImportados) {
    if (resultado.textoOriginal) setTextoLido(resultado.textoOriginal);

    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }

    onDados(resultado);

    if (!resultado.lojaNomeSugerida) return;
    try {
      const loja = await resolverOuCriarLojaAction(
        resultado.lojaNomeSugerida,
        resultado.lojaCnpjSugerido
      );
      if (!loja) return;
      onLojaResolvida(loja);
      setAvisoLoja(
        loja.criada
          ? `Loja "${loja.nome}" não estava cadastrada — cadastrei automaticamente.`
          : null
      );
    } catch (e) {
      console.error("Falha ao resolver/cadastrar loja da nota:", e);
      // Não interrompe a importação: os outros campos já foram preenchidos,
      // o admin pode escolher a loja manualmente na lista.
    }
  }

  async function reconhecerImagem(arquivo: File): Promise<string> {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("por", undefined, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setProgresso(`Lendo a imagem… ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    try {
      const {
        data: { text },
      } = await worker.recognize(arquivo);
      return text;
    } finally {
      await worker.terminate();
    }
  }

  async function importarArquivo(arquivo: File) {
    setImportando(true);
    setErro(null);
    setAvisoLoja(null);
    setTextoLido(null);
    setProgresso(null);
    try {
      if (arquivo.size > TAMANHO_MAXIMO) {
        setErro("Arquivo muito grande (máximo 15 MB).");
        return;
      }

      const nome = arquivo.name.toLowerCase();
      const ehXml = nome.endsWith(".xml") || arquivo.type.includes("xml");
      const ehImagem = arquivo.type.startsWith("image/");

      if (ehXml) {
        const formData = new FormData();
        formData.set("arquivo", arquivo);
        await tratarResultado(await importarNotaAction(formData));
        return;
      }

      if (ehImagem) {
        setProgresso("Preparando leitura da imagem…");
        const texto = await reconhecerImagem(arquivo);
        setProgresso("Interpretando os dados da nota…");
        await tratarResultado(await importarNotaTextoAction(texto));
        return;
      }

      setErro(
        "Formato não reconhecido. Envie o XML da nota fiscal ou uma foto/imagem dela (JPG, PNG, WEBP)."
      );
    } catch (e) {
      console.error("Falha ao importar nota:", e);
      setErro("Não foi possível importar esse arquivo. Tente novamente.");
    } finally {
      setImportando(false);
      setProgresso(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {avisoLoja ? <Alerta tipo="sucesso">{avisoLoja}</Alerta> : null}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xml,application/xml,text/xml,image/*"
          disabled={importando}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) importarArquivo(arquivo);
          }}
          className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-medium file:text-navy hover:file:bg-gold-hover"
        />
        {importando ? (
          <span className="text-sm text-slate-500">{progresso ?? "Lendo arquivo…"}</span>
        ) : null}
      </div>
      {textoLido ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-navy">
            Não achou tudo? Veja o texto lido da nota
          </summary>
          <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-600">
            {textoLido}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
