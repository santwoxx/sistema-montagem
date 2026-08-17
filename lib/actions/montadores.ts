"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { paraNumeroBr } from "@/lib/format";

export async function criarMontadorAction(formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") || "").trim();
  const senha = String(formData.get("senha") || "");
  let comissao = paraNumeroBr(formData.get("comissao")?.toString() || "0");
  if (!Number.isFinite(comissao) || comissao < 0) comissao = 0;
  if (comissao > 100) comissao = 100;

  if (!nome || !email || !senha) {
    redirect(
      `/admin/montadores?erro=${encodeURIComponent("Preencha nome, e-mail e senha.")}`
    );
  }
  if (senha.length < 6) {
    redirect(
      `/admin/montadores?erro=${encodeURIComponent(
        "A senha deve ter pelo menos 6 caracteres."
      )}`
    );
  }

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    redirect(
      `/admin/montadores?erro=${encodeURIComponent(
        "Já existe um usuário cadastrado com este e-mail."
      )}`
    );
  }

  const senhaHash = await hashPassword(senha);

  const montador = await prisma.user.create({
    data: {
      nome,
      email,
      telefone: telefone || null,
      senha: senhaHash,
      role: "MONTADOR",
      comissaoPadrao: comissao,
    },
  });

  revalidatePath("/admin/montadores");
  redirect(
    `/admin/montadores?sucesso=${encodeURIComponent(
      `Montador "${nome}" cadastrado com sucesso.`
    )}`
  );
}

export async function atualizarMontadorAction(id: string, formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") || "").trim();
  const novaSenha = String(formData.get("senha") || "");
  const ativo = formData.get("ativo") === "on";
  
  let comissaoPadrao = paraNumeroBr(formData.get("comissaoPadrao")?.toString() || "0");
  if (!Number.isFinite(comissaoPadrao) || comissaoPadrao < 0) comissaoPadrao = 0;
  if (comissaoPadrao > 100) comissaoPadrao = 100;

  if (!nome || !email) {
    redirect(
      `/admin/montadores/${id}?erro=${encodeURIComponent(
        "Preencha nome e e-mail."
      )}`
    );
  }

  if (novaSenha && novaSenha.length < 6) {
    redirect(
      `/admin/montadores/${id}?erro=${encodeURIComponent(
        "A nova senha deve ter pelo menos 6 caracteres."
      )}`
    );
  }

  const emailEmUso = await prisma.user.findFirst({
    where: { email, NOT: { id } },
  });
  if (emailEmUso) {
    redirect(
      `/admin/montadores/${id}?erro=${encodeURIComponent(
        "Este e-mail já está em uso por outro usuário."
      )}`
    );
  }

  await prisma.user.update({
    where: { id },
    data: {
      nome,
      email,
      telefone: telefone || null,
      ativo,
      comissaoPadrao,
      ...(novaSenha ? { senha: await hashPassword(novaSenha) } : {}),
    },
  });

  revalidatePath("/admin/montadores");
  revalidatePath(`/admin/montadores/${id}`);
  redirect(
    `/admin/montadores/${id}?sucesso=${encodeURIComponent("Dados atualizados.")}`
  );
}

export async function salvarComissoesAction(montadorId: string, formData: FormData) {
  await requireAdmin();

  const lojas = await prisma.loja.findMany({ select: { id: true } });

  await prisma.$transaction(
    lojas.map((loja) => {
      const bruto = String(formData.get(`percentual_${loja.id}`) || "0").replace(
        ",",
        "."
      );
      let percentual = Number(bruto);
      if (!Number.isFinite(percentual) || percentual < 0) percentual = 0;
      if (percentual > 100) percentual = 100;

      return prisma.comissaoLoja.upsert({
        where: { montadorId_lojaId: { montadorId, lojaId: loja.id } },
        update: { percentual },
        create: { montadorId, lojaId: loja.id, percentual },
      });
    })
  );

  revalidatePath(`/admin/montadores/${montadorId}`);
  redirect(
    `/admin/montadores/${montadorId}?sucesso=${encodeURIComponent(
      "Comissões atualizadas."
    )}`
  );
}

export async function excluirMontadorAction(id: string) {
  await requireAdmin();

  await prisma.user.delete({ where: { id } });

  revalidatePath("/admin/montadores");
  revalidatePath("/admin/montagens");
  redirect(
    `/admin/montadores?sucesso=${encodeURIComponent("Montador excluído.")}`
  );
}
