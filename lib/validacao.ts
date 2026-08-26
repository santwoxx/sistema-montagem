import { z } from "zod";

// Validação dos valores que chegam de fora (formulário ou argumento de
// Server Action).
//
// O motivo de existir: `.bind(null, id, "EM_ANDAMENTO")` no formulário e o
// tipo TypeScript do parâmetro dão a impressão de que o valor que a ação
// recebe é sempre um dos previstos -- mas tipo de TypeScript some em tempo
// de execução, e uma Server Action é um endpoint HTTP como outro qualquer.
// Sem conferir aqui, um `status` inventado chegava direto no Prisma (erro
// 500 em vez de mensagem tratada) e um "CONCLUIDO" mandado na mão pulava a
// exigência de foto + assinaturas do fluxo de conclusão.
//
// Fica fora de um arquivo "use server" de propósito: lá só é possível
// exportar funções assíncronas.

export const StatusMontagemSchema = z.enum([
  "PENDENTE",
  "EM_ANDAMENTO",
  "CONCLUIDO",
  "CANCELADO",
]);
export type StatusMontagemValido = z.infer<typeof StatusMontagemSchema>;

export const TipoOcorrenciaSchema = z.enum([
  "CLIENTE_AUSENTE",
  "PECA_DANIFICADA",
  "REAGENDAR",
  "OUTRO",
]);
export type TipoOcorrenciaValido = z.infer<typeof TipoOcorrenciaSchema>;

// O que um montador pode mudar sozinho pelo aplicativo. Concluir NÃO está
// aqui: a conclusão passa por concluirComProvaAction, que exige foto do
// produto e as duas assinaturas. Cancelar é decisão do admin.
export const STATUS_PERMITIDOS_MONTADOR: StatusMontagemValido[] = [
  "PENDENTE",
  "EM_ANDAMENTO",
];

// Só diz para qual tela devolver o admin depois do clique (ver
// confirmarEnvioCentralSyncAction). Validado para que o valor não vire um
// destino de redirecionamento arbitrário.
export const OrigemEnvioSchema = z.enum(["painel", "montagem"]);
export type OrigemEnvio = z.infer<typeof OrigemEnvioSchema>;
