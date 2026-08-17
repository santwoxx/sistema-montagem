import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { NavBar, type NavLink } from "@/components/NavBar";

const links: NavLink[] = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/montagens", label: "Montagens" },
  { href: "/admin/montagens/nova", label: "Importar nota" },
  { href: "/admin/montadores", label: "Montadores" },
  { href: "/admin/lojas", label: "Lojas" },
  { href: "/admin/financeiro", label: "Financeiro" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();

  return (
    <>
      <NavBar nome={session.nome} titulo="Painel do administrador" links={links} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-6">{children}</main>
    </>
  );
}
