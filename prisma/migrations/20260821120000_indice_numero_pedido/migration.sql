-- Busca por numeroPedido virou caminho quente: a fila de envio ao
-- CentralSync no painel do admin filtra por numeroPedido LIKE 'del-%', e a
-- API de notas pendentes procura por numeroPedido para não gravar o mesmo
-- pedido duas vezes. Sem índice, as duas viram varredura da tabela inteira.

-- CreateIndex
CREATE INDEX "Montagem_numeroPedido_idx" ON "Montagem"("numeroPedido");

-- CreateIndex
CREATE INDEX "NotaPendente_numeroPedido_idx" ON "NotaPendente"("numeroPedido");
