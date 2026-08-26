"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { emailAutorizadoComoAdmin, verificarTokenGoogle } from "@/lib/firebase-verify";
import { ipDoPedido, limparTentativas, registrarTentativa } from "@/lib/limite";

// 10 tentativas de senha errada em 15 minutos, contadas por e-mail e por
// origem. É folgado para quem errou a senha algumas vezes no celular e
// apertado para quem está varrendo senhas. Ver as ressalvas em lib/limite.ts.
const LIMITE_LOGIN = { limite: 10, janelaMs: 15 * 60 * 1000 };

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const senha = String(formData.get("senha") || "");
  const proximo = String(formData.get("proximo") || "");

  if (!email || !senha) {
    redirect(`/login?erro=${encodeURIComponent("Preencha e-mail e senha.")}`);
  }

  // Duas chaves: por e-mail (para não deixar martelar uma conta específica
  // de vários lugares) e por origem (para não deixar varrer vários e-mails
  // do mesmo lugar).
  const ip = ipDoPedido(await headers());
  const chaves = [`login:email:${email}`, `login:ip:${ip}`];
  for (const chave of chaves) {
    const limite = registrarTentativa(chave, LIMITE_LOGIN);
    if (!limite.permitido) {
      redirect(
        `/login?erro=${encodeURIComponent(
          `Muitas tentativas seguidas. Espere ${Math.ceil(
            limite.esperarSegundos / 60
          )} minuto(s) e tente de novo.`
        )}`
      );
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.ativo) {
    redirect(`/login?erro=${encodeURIComponent("E-mail ou senha inválidos.")}`);
  }

  const senhaOk = await verifyPassword(senha, user.senha);
  if (!senhaOk) {
    redirect(`/login?erro=${encodeURIComponent("E-mail ou senha inválidos.")}`);
  }

  // Entrou: o contador não pode continuar penalizando esta conta.
  for (const chave of chaves) limparTentativas(chave);

  await createSession({ sub: user.id, role: user.role, nome: user.nome });

  const prefixoPermitido = user.role === "ADMIN" ? "/admin" : "/montador";
  const destino = proximo.startsWith(prefixoPermitido) ? proximo : prefixoPermitido;

  redirect(destino);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function loginGoogleAction(
  idToken: string
): Promise<{ error: string } | undefined> {
  const identidade = await verificarTokenGoogle(idToken);
  if (!identidade) {
    return { error: "Não foi possível confirmar sua conta Google. Tente novamente." };
  }

  const resultado = await emailAutorizadoComoAdmin(idToken);
  if (!resultado.autorizado) {
    if (resultado.status === 404) {
      return {
        error:
          'Falta criar o documento "adminEmails/check" no Firestore (aba Dados). Ele pode ficar vazio, sem nenhum campo — só precisa existir.',
      };
    }
    if (resultado.status === 403 || resultado.status === 401) {
      return {
        error: `O e-mail ${identidade.email} não está autorizado, ou as regras do Firestore ainda não foram publicadas (status ${resultado.status}).`,
      };
    }
    return {
      error: `Falha ao checar autorização (status ${resultado.status}). ${resultado.detalhe ?? ""}`.trim(),
    };
  }

  let user = await prisma.user.findUnique({ where: { email: identidade.email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        nome: identidade.nome,
        email: identidade.email,
        senha: await hashPassword(randomUUID()),
        role: "ADMIN",
      },
    });
  }

  if (user.role !== "ADMIN") {
    return {
      error: `O e-mail ${identidade.email} já é usado por um montador e não pode logar como administrador.`,
    };
  }

  if (!user.ativo) {
    return { error: "Este usuário administrador está desativado." };
  }

  await createSession({ sub: user.id, role: "ADMIN", nome: user.nome });
  redirect("/admin");
}
