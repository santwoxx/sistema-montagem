"use client";

import { Card } from "@/components/ui";
import { CopiarTexto } from "@/components/CopiarTexto";

/**
 * Mostra o link público de agendamento para o admin mandar ao cliente.
 *
 * O endereço vem pronto do servidor (ver lib/url.ts); aqui só é preciso ser
 * componente de cliente por causa do botão de copiar.
 */
export function LinkAgendamento({ url }: { url: string }) {
  const mensagem = `Olá! Para agendar sua montagem, é só preencher seus dados neste link: ${url}`;

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <p className="font-semibold text-slate-900">🔗 Link de agendamento do cliente</p>
      <p className="mt-1 text-sm text-slate-500">
        Mande este link para quem quiser contratar uma montagem particular. O
        cliente preenche endereço, telefone, o que vai montar e o dia que
        prefere — e o pedido cai aqui no painel para você conferir.
      </p>

      <p className="mt-3 break-all rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
        {url}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <CopiarTexto texto={url} rotulo="Copiar link" />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
        >
          💬 Enviar por WhatsApp
        </a>
        <a
          href="/agendar"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:underline"
        >
          👁 Ver como o cliente vê
        </a>
      </div>
    </Card>
  );
}
