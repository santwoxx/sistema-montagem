-- Tipo de serviço da montagem: montagem, assistência, desmontagem ou
-- montagem em loja. Só acrescenta uma coluna com padrão -- o código antigo,
-- que ainda roda enquanto o deploy novo sobe, simplesmente a ignora.
CREATE TYPE "TipoServico" AS ENUM ('MONTAGEM', 'ASSISTENCIA', 'DESMONTAGEM', 'MONTAGEM_LOJA');

ALTER TABLE "Montagem" ADD COLUMN "tipoServico" "TipoServico" NOT NULL DEFAULT 'MONTAGEM';

-- Assistências e desmontagens que já existem vieram do CentralSync com o
-- prefixo no nº do pedido. Mesma comparação de lib/centralsync.ts: sem
-- diferenciar maiúscula e ignorando espaço nas pontas.
UPDATE "Montagem" SET "tipoServico" = 'ASSISTENCIA'
WHERE lower(btrim("numeroPedido")) LIKE 'assist-%';

UPDATE "Montagem" SET "tipoServico" = 'DESMONTAGEM'
WHERE lower(btrim("numeroPedido")) LIKE 'desm-%';
