import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME, SESSION_SECRET_BYTES as secret } from "@/lib/session-secret";

async function lerSessao(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { role?: string };
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessao = await lerSessao(req);

  const rotaAdmin = pathname.startsWith("/admin");
  const rotaMontador = pathname.startsWith("/montador");

  if ((rotaAdmin || rotaMontador) && !sessao) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("proximo", pathname);
    return NextResponse.redirect(url);
  }

  if (rotaAdmin && sessao && sessao.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/montador", req.url));
  }

  if (rotaMontador && sessao && sessao.role !== "MONTADOR") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  if (pathname === "/login" && sessao) {
    const destino = sessao.role === "ADMIN" ? "/admin" : "/montador";
    return NextResponse.redirect(new URL(destino, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/montador/:path*", "/login"],
};
