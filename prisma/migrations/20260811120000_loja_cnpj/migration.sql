-- AlterTable
ALTER TABLE "Loja" ADD COLUMN "cnpj" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Loja_cnpj_key" ON "Loja"("cnpj");
