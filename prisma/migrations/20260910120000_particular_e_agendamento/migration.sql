-- Serviço particular: montagem fechada direto com o cliente, sem loja.
-- Tornar a coluna opcional não mexe em nenhuma linha existente (toda
-- montagem já cadastrada continua com a sua loja).
ALTER TABLE "Montagem" ALTER COLUMN "lojaId" DROP NOT NULL;

-- Fila do link público de agendamento (/agendar).
CREATE TABLE "SolicitacaoAgendamento" (
    "id" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "clienteTelefone" TEXT NOT NULL,
    "clienteEndereco" TEXT NOT NULL,
    "produto" TEXT NOT NULL,
    "observacoes" TEXT,
    "dataPreferida" TIMESTAMP(3),
    "periodo" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidaEm" TIMESTAMP(3),
    "recusadaEm" TIMESTAMP(3),
    "montagemId" TEXT,

    CONSTRAINT "SolicitacaoAgendamento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SolicitacaoAgendamento_criadaEm_idx" ON "SolicitacaoAgendamento"("criadaEm");
