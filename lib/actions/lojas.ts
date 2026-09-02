"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizarCnpj, ehErroCnpjDuplicado } from "@/lib/cnpj";
import { paraNumeroBr } from "@/lib/format";

function paraPercentual(valor: FormDataEntryValue | null) {
  const numero = paraNumeroBr(String(valor ?? ""));
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return numero > 100 ? 100 : numero;
}

export async function criarLojaAction(formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();
  const endereco = String(formData.get("endereco") || "").trim();
  const cnpj = normalizarCnpj(String(formData.get("cnpj") || ""));
  const percentualAssistencia = paraPercentual(formData.get("percentualAssistencia"));
  // Libera o envio da conclusão para o CentralSync nas montagens lançadas à
  // mão desta loja (ver lib/centralsync.ts).
  const integraCentralSync = formData.get("integraCentralSync") === "on";

  if (!nome) {
    redirect(`/admin/lojas?erro=${encodeURIComponent("Informe o nome da loja.")}`);
  }

  try {
    await prisma.loja.create({
      data: {
        nome,
        telefone: telefone || null,
        endereco: endereco || null,
        cnpj,
        percentualAssistencia,
        integraCentralSync,
      },
    });
  } catch (error) {
    if (ehErroCnpjDuplicado(error)) {
      redirect(
        `/admin/lojas?erro=${encodeURIComponent("Já existe uma loja cadastrada com esse CNPJ.")}`
      );
    }
    throw error;
  }

  revalidatePath("/admin/lojas");
  redirect(
    `/admin/lojas?sucesso=${encodeURIComponent(`Loja "${nome}" cadastrada.`)}`
  );
}

export async function atualizarLojaAction(id: string, formData: FormData) {
  await requireAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();
  const endereco = String(formData.get("endereco") || "").trim();
  const cnpj = normalizarCnpj(String(formData.get("cnpj") || ""));
  const ativo = formData.get("ativo") === "on";
  const percentualAssistencia = paraPercentual(formData.get("percentualAssistencia"));
  const integraCentralSync = formData.get("integraCentralSync") === "on";

  if (!nome) {
    redirect(
      `/admin/lojas?erro=${encodeURIComponent("Informe o nome da loja.")}`
    );
  }

  try {
    await prisma.loja.update({
      where: { id },
      data: {
        nome,
        telefone: telefone || null,
        endereco: endereco || null,
        cnpj,
        ativo,
        percentualAssistencia,
        integraCentralSync,
      },
    });
  } catch (error) {
    if (ehErroCnpjDuplicado(error)) {
      redirect(
        `/admin/lojas?erro=${encodeURIComponent("Já existe outra loja cadastrada com esse CNPJ.")}`
      );
    }
    throw error;
  }

  revalidatePath("/admin/lojas");
  redirect(`/admin/lojas?sucesso=${encodeURIComponent("Loja atualizada.")}`);
}

export async function excluirLojaAction(id: string) {
  await requireAdmin();

  try {
    await prisma.loja.delete({ where: { id } });
  } catch (error) {
    const codigo = (error as { code?: string })?.code;
    if (codigo === "P2003" || codigo === "P2014") {
      redirect(
        `/admin/lojas?erro=${encodeURIComponent(
          "Essa loja já tem montagens registradas e não pode ser excluída. Desative-a em vez disso."
        )}`
      );
    }
    throw error;
  }

  revalidatePath("/admin/lojas");
  redirect(`/admin/lojas?sucesso=${encodeURIComponent("Loja excluída.")}`);
}
