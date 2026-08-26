"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSession, requireMontador } from "@/lib/auth";
import {
  apagarArquivo,
  enviarArquivo,
  extensaoDe,
  TAMANHO_MAXIMO_UPLOAD,
  TAMANHO_MAXIMO_UPLOAD_TEXTO,
} from "@/lib/upload";

export async function atualizarPerfilAction(formData: FormData) {
  const session = await requireMontador();

  const erro = (mensagem: string) =>
    redirect(`/montador/perfil?erro=${encodeURIComponent(mensagem)}`);

  const nome = String(formData.get("nome") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();

  if (!nome) {
    erro("Informe seu nome.");
    return;
  }

  let fotoUrl: string | undefined;
  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    if (!foto.type.startsWith("image/")) {
      erro("O arquivo da foto precisa ser uma imagem.");
      return;
    }
    if (foto.size > TAMANHO_MAXIMO_UPLOAD) {
      erro(`A foto é muito grande (máximo ${TAMANHO_MAXIMO_UPLOAD_TEXTO}).`);
      return;
    }
    const envio = await enviarArquivo(
      `perfis/${session.sub}-${Date.now()}.${extensaoDe(foto)}`,
      foto
    );
    if (!envio.ok) {
      erro(envio.erro);
      return;
    }
    fotoUrl = envio.url;
  }

  const anterior = fotoUrl
    ? await prisma.user.findUnique({
        where: { id: session.sub },
        select: { fotoUrl: true },
      })
    : null;

  await prisma.user.update({
    where: { id: session.sub },
    data: {
      nome,
      telefone: telefone || null,
      ...(fotoUrl ? { fotoUrl } : {}),
    },
  });

  // Foto de perfil trocada: apaga a anterior (melhor esforço, já com o
  // banco gravado).
  if (fotoUrl && anterior?.fotoUrl && anterior.fotoUrl !== fotoUrl) {
    await apagarArquivo(anterior.fotoUrl);
  }

  // O cookie de sessão guarda o nome desde o login; atualiza para refletir
  // a mudança imediatamente (sem precisar deslogar e logar de novo).
  await createSession({ sub: session.sub, role: session.role, nome });

  revalidatePath("/montador");
  revalidatePath("/montador/perfil");
  revalidatePath("/admin/montadores");
  revalidatePath(`/admin/montadores/${session.sub}`);
  redirect(`/montador/perfil?sucesso=${encodeURIComponent("Perfil atualizado.")}`);
}
