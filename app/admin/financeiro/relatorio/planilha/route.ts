import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buscarLinhasDoRelatorio } from "@/lib/consultar-relatorio";
import { gerarPlanilha, lerFiltrosRelatorio, nomeDaPlanilha } from "@/lib/relatorio";

// Planilha do relatório detalhado, com os mesmos filtros da tela. O proxy já
// barra quem não é admin pelo cookie; requireAdmin confere também no banco
// (usuário desativado continua com cookie válido -- ver lib/auth.ts).
export async function GET(request: NextRequest) {
  await requireAdmin();

  const filtros = lerFiltrosRelatorio(Object.fromEntries(request.nextUrl.searchParams));
  const [{ linhas }, loja] = await Promise.all([
    buscarLinhasDoRelatorio(filtros),
    // Só para o nome do arquivo; "LOJAS"/"PARTICULAR" não acham nada.
    filtros.lojaId
      ? prisma.loja.findUnique({ where: { id: filtros.lojaId }, select: { nome: true } })
      : null,
  ]);

  return new Response(gerarPlanilha(linhas, filtros.base), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeDaPlanilha(filtros, loja?.nome)}"`,
      // Dados financeiros de quem está logado: nada de cache no caminho.
      "Cache-Control": "private, no-store",
    },
  });
}
