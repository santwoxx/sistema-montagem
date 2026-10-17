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

// Usuário, senha e conta vêm das variáveis de ambiente (Vercel -> Settings
// -> Environment Variables), nunca do código: este repositório é público, e
// nem o hash da senha pode ficar aqui -- senha curta sai dele por força
// bruta. A conta é a do e-mail informado, a mesma que entra pelo Google,
// então os dois caminhos levam ao mesmo usuário. Como o seed roda a cada
// deploy, trocar a senha é trocar a variável e publicar de novo.
async function configurarLoginPorUsuario() {
  const usuarioDigitado = process.env.ADMIN_USUARIO?.trim();
  const senha = process.env.ADMIN_USUARIO_SENHA;
  const email = process.env.ADMIN_USUARIO_EMAIL?.trim().toLowerCase();

  if (!usuarioDigitado && !senha && !email) return;
  if (!usuarioDigitado || !senha || !email) {
    console.warn(
      "Login por usuário NÃO configurado: ADMIN_USUARIO, ADMIN_USUARIO_SENHA e ADMIN_USUARIO_EMAIL precisam estar todas definidas."
    );
    return;
  }

  // Minúsculo, como o login compara. Sem "@": é ele que diz ao login se o
  // que foi digitado é e-mail ou usuário.
  const usuario = usuarioDigitado.toLowerCase();
  if (usuario.includes("@")) {
    console.warn(`Login por usuário NÃO configurado: "${usuarioDigitado}" tem "@".`);
    return;
  }

  const conta = await prisma.user.findUnique({ where: { email } });
  if (conta && conta.role !== "ADMIN") {
    console.warn(`Login por usuário NÃO configurado: ${email} é de um montador, não de um administrador.`);
    return;
  }

  // O usuário é único. Se outra conta já o tinha (o e-mail da variável
  // mudou), ela o perde em vez de o deploy falhar no índice.
  await prisma.user.updateMany({
    where: { usuario, NOT: { email } },
    data: { usuario: null },
  });

  const senhaHash = await bcrypt.hash(senha, 10);
  if (conta) {
    await prisma.user.update({
      where: { id: conta.id },
      data: { usuario, senha: senhaHash },
    });
  } else {
    await prisma.user.create({
      data: { nome: usuarioDigitado, email, usuario, senha: senhaHash, role: "ADMIN" },
    });
  }
  console.log(`Login por usuário "${usuarioDigitado}" configurado para ${email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
