-- CreateEnum
CREATE TYPE "TipoOcorrencia" AS ENUM ('CLIENTE_AUSENTE', 'PECA_DANIFICADA', 'REAGENDAR', 'OUTRO');

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" TEXT NOT NULL,
    "montagemId" TEXT NOT NULL,
    "tipo" "TipoOcorrencia" NOT NULL,
    "observacao" TEXT,
    "fotoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ocorrencia_montagemId_idx" ON "Ocorrencia"("montagemId");

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_montagemId_fkey" FOREIGN KEY ("montagemId") REFERENCES "Montagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
