import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { NavBar, type NavBusca, type NavLink } from "@/components/NavBar";

const links: NavLink[] = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/montagens", label: "Montagens" },
  { href: "/admin/rota", label: "Rota" },
  { href: "/admin/montagens/nova", label: "Importar nota" },
  { href: "/admin/montadores", label: "Montadores" },
  { href: "/admin/lojas", label: "Lojas" },
  { href: "/admin/financeiro", label: "Financeiro" },
];

const busca: NavBusca = {
  href: "/admin/busca",
  placeholder: "Cliente, telefone, endereço, pedido ou montador",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();

  return (
    <>
      {/* Sem o "Olá, nome": o cabeçalho tem no máximo 1024px, e com os sete
          links a lupa e a saudação não cabiam juntas -- ele quebrava em
          duas linhas no computador. */}
      <NavBar
        nome={session.nome}
        titulo="Painel do administrador"
        links={links}
        busca={busca}
        mostrarSaudacao={false}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-6">{children}</main>
    </>
  );
}
