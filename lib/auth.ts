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

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/montador");
  return session;
}

export async function requireMontador(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "MONTADOR") redirect("/admin");
  return session;
}

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.sub } });
});
