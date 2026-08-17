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

  // 2. Cadastro da Empresa (Loja) e Nota (Montagem)
  console.log("\nIniciando cadastro da empresa e da nota...");
  
  const loja = await prisma.loja.upsert({
    where: { cnpj: '46112641000481' },
    update: {},
    create: {
      nome: 'ITABUNA PNEUS MOVEIS LTDA',
      telefone: '(73) 3301-2488',
      endereco: 'Avenida do Cinqüentenário, 812, Centro, Itabuna - BA, 45.600-004',
      cnpj: '46112641000481',
      ativo: true,
    },
  });
  console.log(`Loja registrada/encontrada: ${loja.nome}`);

  const montagem = await prisma.montagem.upsert({
    where: {
      // Como não temos um unique claro além do ID, buscaremos primeiro e depois usaremos update/create
      id: (await prisma.montagem.findFirst({ where: { numeroPedido: '404', lojaId: loja.id } }))?.id || 'nova-nota-404'
    },
    update: {
      valorServico: 999.00,
      status: 'PENDENTE'
    },
    create: {
      numeroPedido: '404',
      lojaId: loja.id,
      clienteNome: 'MARIA DE LOURDES SANTOS',
      clienteTelefone: '(73) 98239-6002',
      clienteEndereco: 'Rua de Mutuns, 204, Santa Ines, Itabuna - BA, 45.603-662',
      descricaoServico: 'Montagem: BUFFET MONZA CINAMOMO/OFF WHITE',
      valorServico: 999.00, 
      observacoes: 'Nota Fiscal: 404 Série 1, Emissão: 22/06/2026, Valor Produto: R$ 999,00',
      status: 'PENDENTE',
    }
  });
  console.log(`Nota (Montagem) N° 404 registrada/atualizada com sucesso.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
