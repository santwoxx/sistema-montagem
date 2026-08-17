"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/lib/actions/auth";
import { Modal } from "@/components/ui";

function BotaoSair() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
    >
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}

export type NavLink = {
  href: string;
  label: string;
};

export function NavBar({
  nome,
  titulo,
  links,
}: {
  nome: string;
  titulo: string;
  links: NavLink[];
}) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  // Fecha o menu mobile sempre que a rota muda (clique num link, voltar
  // pelo navegador etc.), já que o NavBar continua montado entre
  // navegações. Ajustar o estado durante a renderização (em vez de um
  // efeito) evita uma passada extra de render a cada troca de rota.
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);
  if (pathname !== pathnameAnterior) {
    setPathnameAnterior(pathname);
    setMenuAberto(false);
  }

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
      <header className="sticky top-0 z-10 border-b border-navy-light bg-navy/95 backdrop-blur-sm shadow-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
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

          <div className="order-2 flex items-center gap-2 sm:order-3 sm:gap-3">
            <span className="hidden text-sm text-slate-300 sm:inline">
              Olá, {nome.split(" ")[0]}
            </span>
            <form action={logoutAction}>
              <BotaoSair />
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

      <Modal aberto={menuAberto} onClose={() => setMenuAberto(false)} titulo="Menu">
        <nav className="flex flex-col gap-1">{renderLinksMobile()}</nav>
      </Modal>
    </>
  );
}
