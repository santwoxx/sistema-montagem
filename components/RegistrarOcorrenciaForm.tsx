"use client";

import { useState, useTransition } from "react";
import { Alerta, Button, Field, Select, Textarea } from "@/components/ui";
import { comprimirImagem } from "@/lib/imagem";

const OPCOES = [
  { valor: "CLIENTE_AUSENTE", label: "Cliente ausente" },
  { valor: "PECA_DANIFICADA", label: "Peça danificada ou faltando" },
  { valor: "REAGENDAR", label: "Cliente pediu para remarcar" },
  { valor: "OUTRO", label: "Outro problema" },
];

type Resultado =
  | { ok: true; url: string | null; aviso?: string }
  | { ok: false; erro: string };

export function RegistrarOcorrenciaForm({
  action,
}: {
  action: (formData: FormData) => Promise<Resultado>;
}) {
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [linkWhatsapp, setLinkWhatsapp] = useState<string | null>(null);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLinkWhatsapp(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      // A foto vai reduzida: a original do celular passa de 2 MB e estoura o
      // limite de tamanho da Server Action, derrubando o envio inteiro.
      const foto = formData.get("foto");
      if (foto instanceof File && foto.size > 0) {
        formData.set("foto", await comprimirImagem(foto));
      }

      let resultado: Resultado;
      try {
        resultado = await action(formData);
      } catch (e) {
        console.error("Falha ao registrar a ocorrência:", e);
        setErro("Não consegui enviar agora. Confira a internet e tente de novo.");
        return;
      }
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      if (resultado.url) {
        window.open(resultado.url, "_blank", "noopener,noreferrer");
        setLinkWhatsapp(resultado.url);
        setSucesso(
          "Ocorrência registrada. Abrimos o WhatsApp com a mensagem pronta para a loja — confira e toque em enviar por lá."
        );
      } else {
        setSucesso(resultado.aviso ?? "Ocorrência registrada.");
      }
      setAberto(false);
    });
  }

  return (
    <div>
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {sucesso ? (
        <Alerta tipo="sucesso">
          {sucesso}
          {linkWhatsapp ? (
            <>
              {" "}
              <a
                href={linkWhatsapp}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                Não abriu? Toque aqui.
              </a>
            </>
          ) : null}
        </Alerta>
      ) : null}

      {!aberto ? (
        <button
          type="button"
          onClick={() => {
            setAberto(true);
            setErro(null);
            setSucesso(null);
          }}
          className="w-full text-center text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          ⚠️ Reportar problema na montagem
        </button>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Field label="O que aconteceu?">
            <Select name="tipo" required defaultValue="">
              <option value="" disabled>
                Selecione uma opção
              </option>
              {OPCOES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Detalhes (opcional)">
            <Textarea
              name="observacao"
              rows={2}
              placeholder="Ex: cliente não atendeu, porta com defeito de fábrica..."
            />
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              Foto (opcional, útil se for peça danificada)
            </p>
            <input
              type="file"
              name="foto"
              accept="image/*"
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-navy-light"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variante="secundario"
              className="flex-1"
              onClick={() => setAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variante="perigo" className="flex-1" disabled={pending}>
              {pending ? "Enviando…" : "Enviar e avisar a loja"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
