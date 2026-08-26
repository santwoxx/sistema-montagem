"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Caixa de diálogo usada no menu do celular e nas confirmações de exclusão.
 *
 * Mora num arquivo próprio (e não em components/ui.tsx) porque precisa de
 * efeitos -- e ui.tsx não é "use client", então o resto dos componentes
 * visuais continua podendo ser renderizado no servidor. Quem importa de
 * "@/components/ui" continua funcionando: de lá isto é reexportado.
 *
 * O que foi corrigido de acessibilidade: antes era uma <div> solta, sem
 * papel de diálogo, sem fechar no Esc, sem levar o foco para dentro e sem
 * travar a rolagem do fundo -- então quem usa teclado ou leitor de tela
 * ficava navegando a página atrás do diálogo aberto, sem saber que ele
 * existia, e no celular a página de trás rolava junto.
 */
export function Modal({
  aberto,
  onClose,
  titulo,
  children,
}: {
  aberto: boolean;
  onClose: () => void;
  titulo?: string;
  children: ReactNode;
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!aberto) return;

    // Guarda quem estava focado para devolver o foco ao fechar (senão o
    // foco volta para o começo da página e a pessoa perde o lugar).
    focoAnteriorRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const painel = painelRef.current;
    // Foca o primeiro controle do diálogo; se não houver, o próprio painel.
    const focavel = painel?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    (focavel ?? painel)?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        onClose();
        return;
      }

      if (evento.key !== "Tab" || !painel) return;

      // Mantém o Tab circulando dentro do diálogo.
      const focaveis = Array.from(
        painel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === painel);
      if (focaveis.length === 0) return;

      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;
      const atual = document.activeElement;

      if (evento.shiftKey && (atual === primeiro || atual === painel)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && atual === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar);

    // Trava a rolagem do fundo enquanto o diálogo está aberto.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
      focoAnteriorRef.current?.focus();
    };
  }, [aberto, onClose]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fundo. aria-hidden porque fechar clicando aqui já está disponível
          pelo Esc e pelos botões de cancelar -- não é um controle à parte. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-navy/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? tituloId : undefined}
        aria-label={titulo ? undefined : "Caixa de diálogo"}
        tabIndex={-1}
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl shadow-navy/10 duration-200 animate-in fade-in zoom-in-95 focus:outline-none"
      >
        {titulo ? (
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 id={tituloId} className="font-display text-lg font-bold text-navy">
              {titulo}
            </h3>
          </div>
        ) : null}

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
