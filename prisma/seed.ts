import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@montafacil.com";
// Gera uma senha aleatória a cada execução (nunca fixa/gravada no código),
// já que este script fica num repositório público.
const ADMIN_SENHA = randomBytes(9).toString("base64url");

async function main() {
  // 1. Criação ou verificação do Administrador
  const existente = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existente) {
    console.log(`Usuário administrador já existe (${ADMIN_EMAIL}).`);
  } else {
    const senhaHash = await bcrypt.hash(ADMIN_SENHA, 10);

    await prisma.user.create({
      data: {
        nome: "Administrador",
        email: ADMIN_EMAIL,
        senha: senhaHash,
        role: "ADMIN",
      },
    });

    console.log("Usuário administrador criado com sucesso:");
    console.log(`  E-mail: ${ADMIN_EMAIL}`);
    console.log(`  Senha:  ${ADMIN_SENHA}`);
    console.log("Troque essa senha após o primeiro acesso.");
  }

  // 1.5 Loja padrão que recebe os avisos de ocorrência (problema na
  // montagem) por WhatsApp quando a loja do pedido não tem telefone
  // próprio cadastrado ainda. Sem CNPJ, então não dá pra usar upsert por
  // esse campo -- busca por nome e só cria se ainda não existir, pra não
  // sobrescrever um telefone que o admin já tenha ajustado manualmente.
  const CENTRAL_MOVEIS_NOME = "Central Móveis";
  const centralMoveis = await prisma.loja.findFirst({
    where: { nome: CENTRAL_MOVEIS_NOME },
  });
  if (!centralMoveis) {
    await prisma.loja.create({
      data: { nome: CENTRAL_MOVEIS_NOME, telefone: "7399392585", ativo: true },
    });
    console.log(`Loja "${CENTRAL_MOVEIS_NOME}" cadastrada com o WhatsApp padrão.`);
  } else {
    console.log(`Loja "${CENTRAL_MOVEIS_NOME}" já cadastrada.`);
  }

  // Nada além disso é semeado. Este script roda no `npm run build`, ou
  // seja, a cada deploy: já existiu aqui uma loja e uma montagem de teste
  // ("nota 404") criadas por upsert, e o update do upsert reescrevia
  // valorServico e status a cada deploy -- uma montagem real que já tivesse
  // sido concluída voltava sozinha para PENDENTE. Loja e montagem se
  // cadastram pelo painel; seed é só para o que o sistema não consegue
  // criar sozinho (o primeiro admin).
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
