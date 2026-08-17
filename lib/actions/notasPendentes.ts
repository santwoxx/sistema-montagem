"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// Descarta uma nota pendente sem transformá-la em montagem (ex: veio
// duplicada, ou o pedido foi cancelado no CentralSync).
export async function descartarNotaPendenteAction(id: string) {
  await requireAdmin();
  await prisma.notaPendente.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/montagens/nova");
  revalidatePath("/admin");
}
