-- Fila de notas pendentes: um pedido, uma nota.
--
-- A API (app/api/notas-pendentes/route.ts) já checava repetição com um
-- SELECT antes do INSERT, mas dois POSTs do CentralSync chegando junto (o
-- repique de um retry, alguém clicando duas vezes lá) passavam os dois pelo
-- SELECT antes de qualquer INSERT acontecer -- e a mesma entrega virava duas
-- notas na fila do admin. Quem resolve isso é uma restrição no banco.
--
-- numeroPedido continua opcional; no Postgres um índice único permite
-- vários NULL, então nota sem número segue sendo aceita normalmente.

-- Antes de criar a restrição, desfaz as duplicatas que já existirem:
-- mantém a mais antiga de cada numeroPedido (a que o admin provavelmente
-- já viu na tela) e descarta as demais.
DELETE FROM "NotaPendente" a
      USING "NotaPendente" b
      WHERE a."numeroPedido" IS NOT NULL
        AND a."numeroPedido" = b."numeroPedido"
        AND (a."criadaEm" > b."criadaEm"
             OR (a."criadaEm" = b."criadaEm" AND a."id" > b."id"));

-- O índice único substitui o índice simples criado em
-- 20260821120000_indice_numero_pedido: ele atende as mesmas buscas.
DROP INDEX IF EXISTS "NotaPendente_numeroPedido_idx";

CREATE UNIQUE INDEX "NotaPendente_numeroPedido_key" ON "NotaPendente"("numeroPedido");
