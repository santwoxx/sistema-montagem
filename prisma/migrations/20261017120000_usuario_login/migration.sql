-- Login por nome de usuário, além do e-mail. Opcional: quem não tem
-- usuário continua entrando só pelo e-mail (ou pelo Google).
ALTER TABLE "User" ADD COLUMN "usuario" TEXT;

CREATE UNIQUE INDEX "User_usuario_key" ON "User"("usuario");
