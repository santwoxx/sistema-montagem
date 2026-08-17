-- CreateTable
CREATE TABLE "NotaPendente" (
    "id" TEXT NOT NULL,
    "numeroPedido" TEXT,
    "clienteNome" TEXT NOT NULL,
    "clienteTelefone" TEXT,
    "clienteEndereco" TEXT NOT NULL,
    "descricaoServico" TEXT NOT NULL,
    "dataAgendada" TIMESTAMP(3),
    "observacoes" TEXT,
    "montadorSugeridoId" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaPendente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotaPendente_montadorSugeridoId_idx" ON "NotaPendente"("montadorSugeridoId");

-- AddForeignKey
ALTER TABLE "NotaPendente" ADD CONSTRAINT "NotaPendente_montadorSugeridoId_fkey" FOREIGN KEY ("montadorSugeridoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
