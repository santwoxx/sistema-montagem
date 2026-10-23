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

type ResultadoEnvioFoto = { ok: true; url: string } | { ok: false; erro: string };

export function ConcluirMontagemForm({
  action,
  enviarFoto,
  exigirAssinaturas = true,
  jaTemFoto = false,
  rotuloBotao = "Concluir montagem",
  rotuloAssinaturaMontador = "Sua assinatura (montador)",
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Sobe uma foto e devolve o endereço dela (enviarFotoComprovanteAction). */
  enviarFoto: (formData: FormData) => Promise<ResultadoEnvioFoto>;
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
  // Endereço de cada foto que já subiu. Se o envio cair no meio (o sinal
  // sumiu na terceira foto), tentar de novo continua de onde parou em vez de
  // subir tudo outra vez. Zera quando outras fotos são escolhidas.
  const enviadasRef = useRef(new Map<File, string>());
  const [fotosNomes, setFotosNomes] = useState<string[]>([]);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // O que aparece no botão durante o envio ("Enviando foto 2 de 5…").
  const [etapa, setEtapa] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    setFotosNomes(arquivos.map((a) => a.name));
    setErroLocal(null);
    enviadasRef.current = new Map();
    fotosPreparadasRef.current = arquivos.map((arquivo) =>
      comprimirImagem(arquivo).catch(() => arquivo)
    );
  }

  function pararComErro(mensagem: string) {
    setEnviando(false);
    setEtapa(null);
    setErroLocal(mensagem);
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
            pararComErro(
              `A foto ${foto.name} ficou com ${(foto.size / (1024 * 1024)).toFixed(1)} MB, acima do limite de 3 MB, e não vai subir — não é a internet. Tire outra pelo próprio celular ou escolha uma imagem menor.`
            );
            return;
          }
        }

        // Uma foto por envio, e só depois a conclusão (ver
        // enviarFotoComprovanteAction): juntas, a partir de umas seis fotos
        // o pedido passava do teto de 4 MB e era recusado sem explicação.
        const fotoUrls: string[] = [];
        for (let i = 0; i < fotos.length; i++) {
          const foto = fotos[i];
          let url = enviadasRef.current.get(foto);
          if (!url) {
            setEtapa(
              fotos.length > 1 ? `Enviando foto ${i + 1} de ${fotos.length}…` : "Enviando a foto…"
            );
            const dados = new FormData();
            dados.set("foto", foto);
            const resultado = await enviarFoto(dados);
            if (!resultado.ok) {
              pararComErro(resultado.erro);
              return;
            }
            url = resultado.url;
            enviadasRef.current.set(foto, url);
          }
          fotoUrls.push(url);
        }

        setEtapa("Salvando o comprovante…");
        const formData = new FormData();
        fotoUrls.forEach((url) => formData.append("fotoUrls", url));
        formData.set("assinaturaMontador", assinaturaMontador);
        formData.set("assinaturaCliente", assinaturaCliente);
        await action(formData);
        // Quando dá certo a ação redireciona e esta tela sai do ar; se ela
        // voltar (erro tratado no servidor), libera o botão de novo.
        setEnviando(false);
        setEtapa(null);
      } catch (erro) {
        console.error("Falha ao enviar o comprovante da montagem:", erro);
        pararComErro(
          "Não consegui enviar agora. Confira a internet e tente de novo — nada foi perdido: as fotos e as assinaturas continuam aqui, e as fotos que já subiram não sobem de novo."
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
          // Trocar as fotos no meio do envio misturaria as duas escolhas.
          disabled={enviando}
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
        {enviando ? (etapa ?? "Enviando…") : rotuloBotao}
      </Button>
    </form>
  );
}
