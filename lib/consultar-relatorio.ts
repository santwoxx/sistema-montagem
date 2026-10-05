import { prisma } from "@/lib/prisma";
import { type FiltrosRelatorio, type LinhaRelatorio, whereDoRelatorio } from "@/lib/relatorio";

/**
 * Teto de montagens num relatório. Um ano inteiro desta operação cabe com
 * folga; o teto existe para um período absurdo (dez anos) não derrubar a
 * página. Passou disso, a tela avisa em vez de mostrar números cortados
 * como se fossem o total.
 */
export const LIMITE_RELATORIO = 5000;

/** As montagens do relatório (a página e a planilha usam a mesma consulta). */
export async function buscarLinhasDoRelatorio(
  filtros: FiltrosRelatorio
): Promise<{ linhas: LinhaRelatorio[]; cortado: boolean }> {
  const linhas = await prisma.montagem.findMany({
    where: whereDoRelatorio(filtros),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: LIMITE_RELATORIO + 1,
    // `select` e não `include`: as assinaturas são base64 em campo Text e
    // viriam junto em todas as linhas sem ninguém usar.
    select: {
      id: true,
      tipoServico: true,
      status: true,
      createdAt: true,
      dataAgendada: true,
      concluidoEm: true,
      clienteNome: true,
      clienteTelefone: true,
      clienteEndereco: true,
      numeroPedido: true,
      descricaoServico: true,
      valorServico: true,
      valorMontador: true,
      valorAssistencia: true,
      percentualAcerto: true,
      lojaId: true,
      montadorId: true,
      pagoPelaLoja: true,
      pagoAoMontador: true,
      feitoPorAdm: true,
      loja: { select: { nome: true } },
      montador: { select: { nome: true } },
    },
  });

  return {
    linhas: linhas.slice(0, LIMITE_RELATORIO),
    cortado: linhas.length > LIMITE_RELATORIO,
  };
}
