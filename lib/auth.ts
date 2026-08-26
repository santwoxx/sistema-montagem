import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, SESSION_SECRET_BYTES as secret } from "@/lib/session-secret";

export { COOKIE_NAME };

export type Papel = "ADMIN" | "MONTADOR";

export type SessionPayload = {
  sub: string;
  role: Papel;
  nome: string;
};

export async function hashPassword(senha: string) {
  return bcrypt.hash(senha, 10);
}

export async function verifyPassword(senha: string, hash: string) {
  return bcrypt.compare(senha, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ role: payload.role, nome: payload.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// cache() memoiza o resultado por requisição: layout, page e componentes
// aninhados podem chamar getSession() livremente sem repetir a leitura do
// cookie e a verificação do JWT a cada chamada.
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      role: payload.role as Papel,
      nome: payload.nome as string,
    };
  } catch {
    return null;
  }
});

/**
 * A sessão conferida contra o banco, e não só contra a assinatura do cookie.
 *
 * O cookie vale 30 dias e carrega papel e nome congelados no momento do
 * login -- ele não sabe que o usuário foi desativado, excluído ou teve o
 * papel trocado depois disso. Antes daqui, desmarcar "Montador ativo" (ou
 * até excluir o cadastro) não tirava ninguém de dentro do sistema: quem já
 * estava logado continuava entrando até o cookie vencer, semanas depois.
 *
 * Também é por isso que `nome` e `role` saem do banco e não do cookie: são a
 * versão atual, não a de quando a pessoa entrou.
 *
 * cache() garante uma consulta por requisição, mesmo com layout + página +
 * componentes chamando isto.
 */
export const getSessionUser = cache(async () => {
  const session = await getSession();
  if (!session?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, nome: true, role: true, ativo: true },
  });
  if (!user || !user.ativo) return null;

  return user;
});

// Encerra a sessão pela rota /logout em vez de redirecionar direto para
// /login: o cookie continua válido (a assinatura está certa, o que mudou foi
// o usuário no banco), então o proxy mandaria de volta para /admin e a
// navegação entraria em laço. A rota /logout apaga o cookie antes de mandar
// para o login -- e não está no matcher do proxy, justamente por isso.
const SAIR_SESSAO_INVALIDA = "/logout?motivo=sessao";

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getSessionUser();
  if (!user) redirect(SAIR_SESSAO_INVALIDA);
  if (user.role !== "ADMIN") redirect("/montador");

  return { sub: user.id, role: "ADMIN", nome: user.nome };
}

export async function requireMontador(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getSessionUser();
  if (!user) redirect(SAIR_SESSAO_INVALIDA);
  if (user.role !== "MONTADOR") redirect("/admin");

  return { sub: user.id, role: "MONTADOR", nome: user.nome };
}

/**
 * Igual às duas acima, mas para as ações que atendem os dois painéis e
 * decidem o que fazer a partir do papel de quem chamou.
 */
export async function requireUsuario(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getSessionUser();
  if (!user) redirect(SAIR_SESSAO_INVALIDA);

  return { sub: user.id, role: user.role, nome: user.nome };
}
