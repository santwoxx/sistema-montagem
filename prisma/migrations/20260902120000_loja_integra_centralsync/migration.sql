-- AlterTable
ALTER TABLE "Loja" ADD COLUMN "integraCentralSync" BOOLEAN NOT NULL DEFAULT false;

-- Liga a marcação em quem já é, de fato, a loja do CentralSync -- senão o
-- botão "Enviar para a Central Móveis" nasceria escondido em todo lugar e o
-- admin teria que descobrir sozinho que precisa ir marcar a loja.
--
-- Dois sinais, e o primeiro é o que não erra: loja que já recebeu montagem
-- com pedido no formato da integração ("del-..."). O segundo cobre a
-- instalação em que a Central Móveis ainda não recebeu nenhum pedido pela
-- API -- o "%" no lugar do "ó" evita depender de unaccent/collation.
UPDATE "Loja"
SET "integraCentralSync" = true
WHERE "id" IN (
    SELECT DISTINCT "lojaId" FROM "Montagem" WHERE lower("numeroPedido") LIKE 'del-%'
  )
  OR lower("nome") LIKE 'central m%veis%';
