"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { paraNumeroBr } from "@/lib/format";

// Todas as ações desta tela mexem em MONTADOR e só em MONTADOR. O id vem de
// fora (é argumento da Server Action), então filtrar por `role` junto com o
// id não é redundância: sem isso, o id de um administrador passado para
// estas ações trocava o e-mail e a senha dele -- ou apagava a conta.
const APENAS_MONTADOR = { role: "MONTADOR" } as const;

// A checagem de e-mail repetido é feita antes, mas entre a consulta e a
// escrita cabe outro cadastro com o mesmo e-mail. Quando isso acontece, quem
// barra é a restrição única do banco -- que sem tratamento vira erro 500.
function ehEmailDuplicado(error: unknown) {
  const codigo = (error as { code?: string })?.code;
  const alvo = (error as { meta?: { target?: string[] } })?.meta?.target;
  return codigo === "P2002" && (alvo ?? []).includes("email");
}

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

  try {
    await prisma.user.create({
      data: {
        nome,
        email,
        telefone: telefone || null,
        senha: senhaHash,
        role: "MONTADOR",
        comissaoPadrao: comissao,
      },
    });
  } catch (error) {
    if (ehEmailDuplicado(error)) {
      redirect(
        `/admin/montadores?erro=${encodeURIComponent(
          "Já existe um usuário cadastrado com este e-mail."
        )}`
      );
    }
    throw error;
  }

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

  let alterados = 0;
  try {
    // updateMany (e não update) para poder filtrar por `role` junto com o
    // id -- `update` só aceita campos únicos no `where`.
    const resultado = await prisma.user.updateMany({
      where: { id, ...APENAS_MONTADOR },
      data: {
        nome,
        email,
        telefone: telefone || null,
        ativo,
        comissaoPadrao,
        ...(novaSenha ? { senha: await hashPassword(novaSenha) } : {}),
      },
    });
    alterados = resultado.count;
  } catch (error) {
    if (ehEmailDuplicado(error)) {
      redirect(
        `/admin/montadores/${id}?erro=${encodeURIComponent(
          "Este e-mail já está em uso por outro usuário."
        )}`
      );
    }
    throw error;
  }

  if (alterados === 0) {
    redirect(
      `/admin/montadores?erro=${encodeURIComponent(
        "Montador não encontrado."
      )}`
    );
  }

  revalidatePath("/admin/montadores");
  revalidatePath(`/admin/montadores/${id}`);
  redirect(
    `/admin/montadores/${id}?sucesso=${encodeURIComponent("Dados atualizados.")}`
  );
}

export async function salvarComissoesAction(montadorId: string, formData: FormData) {
  await requireAdmin();

  const montador = await prisma.user.findFirst({
    where: { id: montadorId, ...APENAS_MONTADOR },
    select: { id: true },
  });
  if (!montador) {
    redirect(
      `/admin/montadores?erro=${encodeURIComponent("Montador não encontrado.")}`
    );
  }

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

  const { count } = await prisma.user.deleteMany({
    where: { id, ...APENAS_MONTADOR },
  });

  revalidatePath("/admin/montadores");
  revalidatePath("/admin/montagens");
  redirect(
    count === 0
      ? `/admin/montadores?erro=${encodeURIComponent("Montador não encontrado.")}`
      : `/admin/montadores?sucesso=${encodeURIComponent("Montador excluído.")}`
  );
}
