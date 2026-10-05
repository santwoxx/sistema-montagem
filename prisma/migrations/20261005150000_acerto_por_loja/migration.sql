-- Acerto por loja: o percentual que a empresa fica da nota deixa de ser 8%
-- fixo no código e passa a ser do cadastro da loja, copiado em cada montagem.
-- O padrão 8 mantém exatamente as contas de hoje, inclusive para as
-- montagens já lançadas.
ALTER TABLE "Loja" ADD COLUMN "percentualAcerto" DOUBLE PRECISION NOT NULL DEFAULT 8,
ADD COLUMN "lancamentoManual" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Montagem" ADD COLUMN "percentualAcerto" DOUBLE PRECISION NOT NULL DEFAULT 8;
