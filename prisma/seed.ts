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
      // integraCentralSync: é esta a loja que o CentralSync atende (ver
      // lib/centralsync.ts). Instalação já existente é marcada pela migração
      // 20260902120000_loja_integra_centralsync, não por aqui.
      data: {
        nome: CENTRAL_MOVEIS_NOME,
        telefone: "7399392585",
        ativo: true,
        integraCentralSync: true,
      },
    });
    console.log(`Loja "${CENTRAL_MOVEIS_NOME}" cadastrada com o WhatsApp padrão.`);
  } else {
    console.log(`Loja "${CENTRAL_MOVEIS_NOME}" já cadastrada.`);
  }

  // 2. Login por usuário e senha de um administrador, além do Google.
  await configurarLoginPorUsuario();

  // Nada além disso é semeado. Este script roda no `npm run build`, ou
  // seja, a cada deploy: já existiu aqui uma loja e uma montagem de teste
  // ("nota 404") criadas por upsert, e o update do upsert reescrevia
  // valorServico e status a cada deploy -- uma montagem real que já tivesse
  // sido concluída voltava sozinha para PENDENTE. Loja e montagem se
  // cadastram pelo painel; seed é só para o que o sistema não consegue
  // criar sozinho (o primeiro admin).
}

// Usuário, senha e conta vêm das credenciais do Dario ou das variáveis de
// ambiente (Vercel -> Settings -> Environment Variables). Como o seed roda a
// cada deploy, o administrador padrão (Dario) fica garantido com papel ADMIN
// e status ativo, e os campos podem ser sobrescritos pelas variáveis se necessário.
async function configurarLoginPorUsuario() {
  const usuarioDigitado = process.env.ADMIN_USUARIO?.trim() || "Dario-Dmnmontagem";
  const senha = process.env.ADMIN_USUARIO_SENHA || "88434848";
  const email = (
    process.env.ADMIN_USUARIO_EMAIL?.trim() || "dario.montador1985@gmail.com"
  ).toLowerCase();

  // Minúsculo, como o login compara. Sem "@": é ele que diz ao login se o
  // que foi digitado é e-mail ou usuário.
  const usuario = usuarioDigitado.toLowerCase();
  if (usuario.includes("@")) {
    console.warn(`Login por usuário NÃO configurado: "${usuarioDigitado}" tem "@".`);
    return;
  }

  // Busca conta existente por e-mail ou por usuário
  let conta = await prisma.user.findUnique({ where: { email } });
  if (!conta) {
    conta = await prisma.user.findFirst({
      where: {
        OR: [
          { usuario },
          { usuario: { equals: usuario, mode: "insensitive" } },
        ],
      },
    });
  }

  // O usuário é único. Se outra conta já o tinha (o e-mail mudou),
  // ela o perde em vez de o deploy falhar no índice.
  await prisma.user.updateMany({
    where: { usuario, NOT: conta ? { id: conta.id } : { email } },
    data: { usuario: null },
  });

  const senhaHash = await bcrypt.hash(senha, 10);
  if (conta) {
    await prisma.user.update({
      where: { id: conta.id },
      data: {
        usuario,
        senha: senhaHash,
        role: "ADMIN",
        ativo: true,
        nome: conta.nome && conta.nome !== "Administrador" ? conta.nome : "Dario",
      },
    });
    console.log(
      `Login de administrador configurado para ${conta.nome || "Dario"} (usuário: "${usuario}", role: ADMIN).`
    );
  } else {
    await prisma.user.create({
      data: {
        nome: "Dario",
        email,
        usuario,
        senha: senhaHash,
        role: "ADMIN",
        ativo: true,
      },
    });
    console.log(
      `Login de administrador "${usuarioDigitado}" criado com sucesso para ${email} (Role: ADMIN).`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
