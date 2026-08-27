"use client";

import { useRef, useState, useTransition } from "react";
import { Alerta, Button } from "@/components/ui";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { comprimirImagem } from "@/lib/imagem";

// Mesmo teto do servidor (TAMANHO_MAXIMO_UPLOAD em lib/upload.ts). Fica
// repetido aqui de propósito: aquele arquivo importa o SDK do Vercel Blob,
// que não pode ir para o pacote do navegador -- mesmo motivo do
// TAMANHO_MAXIMO_MANUAL em components/NovaMontagemForm.tsx.
const TAMANHO_MAXIMO_FOTO = 3 * 1024 * 1024;

export function ConcluirMontagemForm({
  action,
  exigirAssinaturas = true,
  jaTemFoto = false,
  rotuloBotao = "Concluir montagem",
  rotuloAssinaturaMontador = "Sua assinatura (montador)",
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Quando falso, as assinaturas em branco mantêm as que já estão salvas. */
  exigirAssinaturas?: boolean;
  /** Quando verdadeiro, dá para salvar sem escolher outra foto. */
  jaTemFoto?: boolean;
  rotuloBotao?: string;
  rotuloAssinaturaMontador?: string;
}) {
  const padMontadorRef = useRef<SignaturePadHandle>(null);
  const padClienteRef = useRef<SignaturePadHandle>(null);
  // A foto começa a ser reduzida assim que é escolhida, enquanto o montador
  // ainda está colhendo as assinaturas — quando ele toca em concluir, o
  // trabalho quase sempre já terminou.
  const fotosPreparadasRef = useRef<Promise<File>[]>([]);
  const [fotosNomes, setFotosNomes] = useState<string[]>([]);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    setFotosNomes(arquivos.map((a) => a.name));
    setErroLocal(null);
    fotosPreparadasRef.current = arquivos.map((arquivo) =>
      comprimirImagem(arquivo).catch(() => arquivo)
    );
  }

  function validarEEnviar(e: React.FormEvent<HTMLFormElement>) {
    // O envio é feito por aqui (e não pelo <form action>) porque a foto
    // precisa ser reduzida antes de subir: do jeito que era, a foto original
    // do celular estourava o limite de tamanho da Server Action e a tela
    // caía no "Algo deu errado" sem concluir nada.
    e.preventDefault();

    if (fotosPreparadasRef.current.length === 0 && !jaTemFoto) {
      setErroLocal("Escolha pelo menos uma foto do produto montado.");
      return;
    }
    const montadorAssinou = !padMontadorRef.current?.isEmpty();
    const clienteAssinou = !padClienteRef.current?.isEmpty();
    if (exigirAssinaturas && !montadorAssinou) {
      setErroLocal("Falta a sua assinatura.");
      return;
    }
    if (exigirAssinaturas && !clienteAssinou) {
      setErroLocal("Falta a assinatura do cliente.");
      return;
    }

    setErroLocal(null);
    setEnviando(true);

    const assinaturaMontador = montadorAssinou
      ? padMontadorRef.current?.toDataURL() ?? ""
      : "";
    const assinaturaCliente = clienteAssinou
      ? padClienteRef.current?.toDataURL() ?? ""
      : "";
    const fotosPromises = fotosPreparadasRef.current;

    startTransition(async () => {
      try {
        const fotos = await Promise.all(fotosPromises);

        for (const foto of fotos) {
          if (foto.size > TAMANHO_MAXIMO_FOTO) {
            setEnviando(false);
            setErroLocal(
              `A foto ${foto.name} ficou com ${(foto.size / (1024 * 1024)).toFixed(1)} MB, acima do limite de 3 MB, e não vai subir — não é a internet. Tire outra pelo próprio celular ou escolha uma imagem menor.`
            );
            return;
          }
        }

        const formData = new FormData();
        fotos.forEach((foto) => formData.append("fotos", foto));
        formData.set("assinaturaMontador", assinaturaMontador);
        formData.set("assinaturaCliente", assinaturaCliente);
        await action(formData);
        // Quando dá certo a ação redireciona e esta tela sai do ar; se ela
        // voltar (erro tratado no servidor), libera o botão de novo.
        setEnviando(false);
      } catch (erro) {
        console.error("Falha ao enviar o comprovante da montagem:", erro);
        setEnviando(false);
        setErroLocal(
          "Não consegui enviar agora. Confira a internet e tente de novo — nada foi perdido, a foto e as assinaturas continuam aqui. Se insistir, tente com uma foto menor."
        );
      }
    });
  }

  return (
    <form onSubmit={validarEEnviar} className="space-y-5">
      {erroLocal ? <Alerta tipo="erro">{erroLocal}</Alerta> : null}

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">
          Fotos do produto montado
        </p>
        <input
          type="file"
          name="fotos"
          accept="image/*"
          multiple
          // Sem `capture`: com ele o celular abria a câmera direto e não
          // deixava escolher uma foto já tirada (que é o caso de quem
          // fotografa na hora e só lança o serviço no sistema depois).
          onChange={aoEscolherFoto}
          className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-navy-light"
        />
        {fotosNomes.length > 0 ? (
          <p className="mt-1 text-xs text-slate-500">{fotosNomes.join(", ")}</p>
        ) : jaTemFoto ? (
          <p className="mt-1 text-xs text-slate-500">
            Já existe uma foto salva — só escolha outra se quiser substituí-la.
          </p>
        ) : null}
      </div>

      <SignaturePad ref={padMontadorRef} label={rotuloAssinaturaMontador} />
      <SignaturePad ref={padClienteRef} label="Assinatura do cliente" />
      {!exigirAssinaturas ? (
        <p className="-mt-2 text-xs text-slate-500">
          Deixe as assinaturas em branco para manter as que já estiverem salvas.
        </p>
      ) : null}

      <Button type="submit" variante="sucesso" className="w-full" disabled={enviando}>
        {enviando ? "Enviando…" : rotuloBotao}
      </Button>
    </form>
  );
}
