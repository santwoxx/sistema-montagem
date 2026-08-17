-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MONTADOR');

-- CreateEnum
CREATE TYPE "StatusMontagem" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "senha" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MONTADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loja" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "endereco" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComissaoLoja" (
    "id" TEXT NOT NULL,
    "montadorId" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ComissaoLoja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Montagem" (
    "id" TEXT NOT NULL,
    "numeroPedido" TEXT,
    "lojaId" TEXT NOT NULL,
    "montadorId" TEXT,
    "clienteNome" TEXT NOT NULL,
    "clienteTelefone" TEXT,
    "clienteEndereco" TEXT NOT NULL,
    "descricaoServico" TEXT NOT NULL,
    "valorServico" DOUBLE PRECISION NOT NULL,
    "percentualMontador" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorMontador" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataAgendada" TIMESTAMP(3),
    "status" "StatusMontagem" NOT NULL DEFAULT 'PENDENTE',
    "pagoPelaLoja" BOOLEAN NOT NULL DEFAULT false,
    "pagoAoMontador" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "Montagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ComissaoLoja_montadorId_lojaId_key" ON "ComissaoLoja"("montadorId", "lojaId");

-- CreateIndex
CREATE INDEX "Montagem_montadorId_idx" ON "Montagem"("montadorId");

-- CreateIndex
CREATE INDEX "Montagem_lojaId_idx" ON "Montagem"("lojaId");

-- CreateIndex
CREATE INDEX "Montagem_status_idx" ON "Montagem"("status");

-- AddForeignKey
ALTER TABLE "ComissaoLoja" ADD CONSTRAINT "ComissaoLoja_montadorId_fkey" FOREIGN KEY ("montadorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComissaoLoja" ADD CONSTRAINT "ComissaoLoja_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Montagem" ADD CONSTRAINT "Montagem_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Montagem" ADD CONSTRAINT "Montagem_montadorId_fkey" FOREIGN KEY ("montadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
