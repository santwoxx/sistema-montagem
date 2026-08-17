-- AlterTable
ALTER TABLE "Montagem" ADD COLUMN     "avaliacaoSolicitadaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "montagemId" TEXT NOT NULL,
    "montadorId" TEXT NOT NULL,
    "estrelas" INTEGER NOT NULL,
    "comentario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_montagemId_key" ON "Avaliacao"("montagemId");

-- CreateIndex
CREATE INDEX "Avaliacao_montadorId_idx" ON "Avaliacao"("montadorId");

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_montagemId_fkey" FOREIGN KEY ("montagemId") REFERENCES "Montagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_montadorId_fkey" FOREIGN KEY ("montadorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
