import { CopiarTexto } from "@/components/CopiarTexto";
import { formatarTelefone, linkTelefone, linkWhatsapp } from "@/lib/format";
import { linkMapa, linkWaze } from "@/lib/mapas";
import type { ReactNode } from "react";

// A linha de atalhos do cliente: navegar até ele, ligar, chamar no
// WhatsApp, copiar o endereço.
//
// Estava copiada em quatro telas (painel geral, rota do dia, tela da
// montagem no admin e no montador), e cada cópia foi ficando um pouco
// diferente da outra. Juntar aqui é o que faz uma correção como a do link
// do Waze (ver enderecoParaNavegacao em lib/mapas.ts) valer em todas de
// uma vez, em vez de em três de quatro.
//
// Waze vem primeiro de propósito: é o que a equipe usa para rodar a rota do
// dia; o Google Maps fica como segunda opção, que aguenta melhor endereço
// mal digitado.
export function AcoesCliente({
  endereco,
  telefone,
  className,
  children,
}: {
  endereco: string;
  telefone?: string | null;
  className?: string;
  // Atalhos que só existem numa tela (ex: "Ver na rota do dia").
  children?: ReactNode;
}) {
  const linkClasses = "inline-flex items-center gap-1 text-sm font-medium hover:underline";

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className ?? ""}`}>
      <a
        href={linkWaze(endereco)}
        target="_blank"
        rel="noreferrer"
        className={`${linkClasses} text-sky-600`}
      >
        🚗 Waze
      </a>
      <a
        href={linkMapa(endereco)}
        target="_blank"
        rel="noreferrer"
        className={`${linkClasses} text-blue-600`}
      >
        📍 Google Maps
      </a>
      {telefone ? (
        <>
          {/* O número aparece escrito, não só o rótulo "Ligar": quem está
              organizando a rota costuma precisar dele para digitar em
              outro lugar (ou só para conferir se é celular ou fixo). */}
          <a href={linkTelefone(telefone)} className={`${linkClasses} text-slate-600`}>
            📞 {formatarTelefone(telefone)}
          </a>
          <a
            href={linkWhatsapp(telefone)}
            target="_blank"
            rel="noreferrer"
            className={`${linkClasses} text-emerald-600`}
          >
            💬 WhatsApp
          </a>
        </>
      ) : null}
      <CopiarTexto texto={endereco} rotulo="Copiar endereço" />
      {children}
    </div>
  );
}
