import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buscarLinhasDoRelatorio } from "@/lib/consultar-relatorio";
import { gerarPlanilha, lerFiltrosRelatorio } from "@/lib/relatorio";

// Planilha do relatório detalhado, com os mesmos filtros da tela. O proxy já
// barra quem não é admin pelo cookie; requireAdmin confere também no banco
// (usuário desativado continua com cookie válido -- ver lib/auth.ts).
export async function GET(request: NextRequest) {
  await requireAdmin();

  const filtros = lerFiltrosRelatorio(Object.fromEntries(request.nextUrl.searchParams));
  const { linhas } = await buscarLinhasDoRelatorio(filtros);

  return new Response(gerarPlanilha(linhas, filtros.base), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${filtros.de}-a-${filtros.ate}.csv"`,
      // Dados financeiros de quem está logado: nada de cache no caminho.
      "Cache-Control": "private, no-store",
    },
  });
}
