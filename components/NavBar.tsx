"use client";

import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/lib/actions/auth";
import { Button, Input, Modal } from "@/components/ui";

function BotaoSair({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}

export type NavLink = {
  href: string;
  label: string;
};

/** A lupa do topo: para onde ela leva e o que sugerir no campo. */
export type NavBusca = {
  href: string;
  placeholder: string;
};

function IconeLupa() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

/** Se a tecla foi digitada num campo de texto (onde "/" é só uma barra). */
function digitandoEmCampo(alvo: EventTarget | null) {
  if (!(alvo instanceof HTMLElement)) return false;
  return (
    alvo.isContentEditable ||
    alvo instanceof HTMLInputElement ||
    alvo instanceof HTMLTextAreaElement ||
    alvo instanceof HTMLSelectElement
  );
}

export function NavBar({
  nome,
  titulo,
  links,
  busca,
  mostrarSaudacao = true,
}: {
  nome: string;
  titulo: string;
  links: NavLink[];
  busca?: NavBusca;
  /** O "Olá, nome" do computador. Painel com muitos links não tem espaço. */
  mostrarSaudacao?: boolean;
}) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  // Estáveis: o Modal refaz o foco e a trava de rolagem sempre que o
  // onClose muda.
  const fecharMenu = useCallback(() => setMenuAberto(false), []);
  const fecharBusca = useCallback(() => setBuscaAberta(false), []);
  const abrirBuscaPeloMenu = () => {
    setMenuAberto(false);
    setBuscaAberta(true);
  };

  // Fecha o menu mobile sempre que a rota muda (clique num link, voltar
  // pelo navegador etc.), já que o NavBar continua montado entre
  // navegações. Ajustar o estado durante a renderização (em vez de um
  // efeito) evita uma passada extra de render a cada troca de rota.
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);
  if (pathname !== pathnameAnterior) {
    setPathnameAnterior(pathname);
    setMenuAberto(false);
    setBuscaAberta(false);
  }

  // Atalhos de teclado da lupa: Ctrl+K (⌘K no Mac) de qualquer lugar, e "/"
  // quando não se está digitando num campo.
  useEffect(() => {
    if (!busca) return;
    function aoTeclar(evento: KeyboardEvent) {
      const ctrlK = evento.key.toLowerCase() === "k" && (evento.ctrlKey || evento.metaKey);
      const barra =
        evento.key === "/" &&
        !evento.ctrlKey &&
        !evento.metaKey &&
        !evento.altKey &&
        !digitandoEmCampo(evento.target);
      if (!ctrlK && !barra) return;
      evento.preventDefault();
      setMenuAberto(false);
      setBuscaAberta(true);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [busca]);

  const ehAtivo = (href: string) =>
    href === pathname ||
    (href !== "/admin" && href !== "/montador" && pathname.startsWith(href));

  const renderLinksDesktop = () =>
    links.map((link) => (
      <Link
        key={link.href}
        href={link.href}
        className={
          "block rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
          (ehAtivo(link.href)
            ? "bg-navy-light text-gold shadow-sm"
            : "text-slate-300 hover:bg-navy-light hover:text-white")
        }
      >
        {link.label}
      </Link>
    ));

  const renderLinksMobile = () =>
    links.map((link) => (
      <Link
        key={link.href}
        href={link.href}
        className={
          "block rounded-xl px-4 py-3 text-base font-semibold transition-colors " +
          (ehAtivo(link.href)
            ? "bg-navy/10 text-navy"
            : "text-slate-700 hover:bg-navy/5")
        }
      >
        {link.label}
      </Link>
    ));

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-navy-light bg-navy/95 backdrop-blur-sm shadow-md print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-gold to-gold-hover text-white text-xl shadow-sm shadow-gold/30">
              D
            </span>
            <div className="leading-tight">
              <p className="text-lg font-bold text-white uppercase tracking-wide font-display">
                MontaFácil
              </p>
              <p className="text-xs text-slate-400 font-sans">{titulo}</p>
            </div>
          </div>

          <nav className="hidden sm:order-2 sm:flex sm:w-auto sm:justify-start sm:gap-1">
            {renderLinksDesktop()}
          </nav>

          {/* No celular ficam só a lupa e o menu: com o "Sair" junto, os
              três não cabiam ao lado da marca em telas de 360-375px e o
              cabeçalho quebrava em duas linhas. O "Sair" do celular mora
              dentro do menu. */}
          <div className="order-2 flex items-center gap-1 sm:order-3 sm:gap-3">
            {busca ? (
              <button
                type="button"
                onClick={() => setBuscaAberta(true)}
                aria-label="Buscar montagem, cliente ou montador"
                title="Buscar (Ctrl+K)"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-navy-light hover:text-white"
              >
                <IconeLupa />
              </button>
            ) : null}
            {mostrarSaudacao ? (
              <span className="hidden text-sm text-slate-300 sm:inline">
                Olá, {nome.split(" ")[0]}
              </span>
            ) : null}
            <form action={logoutAction} className="hidden sm:block">
              <BotaoSair className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50" />
            </form>
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-navy-light hover:text-white sm:hidden"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <Modal aberto={menuAberto} onClose={fecharMenu} titulo="Menu">
        <nav className="flex flex-col gap-1">
          {busca ? (
            <button
              type="button"
              onClick={abrirBuscaPeloMenu}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-semibold text-slate-700 transition-colors hover:bg-navy/5"
            >
              <IconeLupa />
              Buscar
            </button>
          ) : null}
          {renderLinksMobile()}
        </nav>
        <form action={logoutAction} className="mt-3 border-t border-slate-100 pt-3">
          <BotaoSair className="block w-full rounded-xl px-4 py-3 text-left text-base font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50" />
        </form>
      </Modal>

      {busca ? (
        <Modal aberto={buscaAberta} onClose={fecharBusca} titulo="Buscar" posicao="topo">
          {/* O <Form> navega sozinho para a página de resultados; o onSubmit
              só fecha a caixa -- buscar de novo estando já na página de
              busca não muda o pathname, então o fechamento automático da
              troca de rota não pegaria esse caso. */}
          <Form action={busca.href} role="search" onSubmit={fecharBusca} className="space-y-3">
            <Input
              type="search"
              name="q"
              required
              enterKeyHint="search"
              aria-label="Buscar"
              placeholder={busca.placeholder}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="hidden text-xs text-slate-500 sm:block">
                Dica: abra esta busca com Ctrl+K ou /
              </p>
              <Button type="submit" className="ml-auto">
                <IconeLupa />
                Buscar
              </Button>
            </div>
          </Form>
        </Modal>
      ) : null}
    </>
  );
}
