-- Colunas que faltaram no deploy das "múltiplas fotos e foto da nota".
--
-- O schema.prisma ganhou os três campos abaixo, mas nenhuma migração foi
-- gerada junto. Como `prisma migrate deploy` só aplica o que está nesta
-- pasta, o banco de produção continuou sem as colunas -- e o Prisma Client
-- novo pede todas elas em qualquer consulta sem `select` (o detalhe da
-- montagem e a tela de nova montagem usam `include`). O SELECT falhava com
-- "column does not exist", a renderização no servidor quebrava e o
-- navegador mostrava só o erro genérico do React (#441), que vira o
-- "Algo deu errado nesta página" -- sem dizer a causa.
--
-- fotosProdutoUrls entra com DEFAULT ARRAY[]::TEXT[]: no Postgres a coluna
-- nova já nasce preenchida com a lista vazia nas montagens antigas, então
-- não sobra nada para corrigir depois.
--
-- IF NOT EXISTS porque a coluna pode ter sido criada na mão no banco de
-- produção enquanto o erro estava no ar: sem isso a migração falharia, e
-- uma migração que falha derruba o deploy inteiro.

-- AlterTable
ALTER TABLE "Montagem" ADD COLUMN IF NOT EXISTS "fotosProdutoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "notaUrl" TEXT;

-- AlterTable
ALTER TABLE "NotaPendente" ADD COLUMN IF NOT EXISTS "notaUrl" TEXT;
