import type { ReactNode } from "react";
import { requireMontador } from "@/lib/auth";
import { NavBar, type NavBusca, type NavLink } from "@/components/NavBar";

const links: NavLink[] = [
  { href: "/montador", label: "Minhas montagens" },
  { href: "/montador/financeiro", label: "Financeiro" },
  { href: "/montador/perfil", label: "Meu perfil" },
];

const busca: NavBusca = {
  href: "/montador/busca",
  placeholder: "Cliente, telefone, endereço ou pedido",
};

export default async function MontadorLayout({ children }: { children: ReactNode }) {
  const session = await requireMontador();

  return (
    <>
      <NavBar nome={session.nome} titulo="Painel do montador" links={links} busca={busca} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-6">{children}</main>
    </>
  );
}
