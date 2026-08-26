// Prepara o banco antes do `next build`: aplica as migrações pendentes e
// roda o seed (que só cria o que ainda não existe).
//
// Por que não chamar `prisma migrate deploy` direto no script de build:
//
// 1. Deploy de preview. Na Vercel, todo push abre um deploy de preview, e
//    ele usa as mesmas variáveis de ambiente do projeto -- ou seja, o mesmo
//    DATABASE_URL de produção. Do jeito anterior, abrir um preview para
//    conferir uma tela aplicava no banco de produção migrações de código
//    que talvez nem fosse ser promovido. Aqui o preview passa reto.
//
// 2. Mensagem de erro. Sem DATABASE_URL configurada, o build morria com um
//    erro de Prisma difícil de ligar à causa. Agora avisa o que falta.
//
// Ressalva conhecida: a migração roda no build, então o banco muda alguns
// instantes antes de o código novo entrar no ar. Para as migrações que este
// projeto costuma ter (adicionar coluna/índice) isso é inofensivo, porque o
// código antigo ignora o que não conhece. Migração destrutiva (renomear ou
// remover coluna em uso) pede o passo em dois deploys: primeiro adiciona,
// depois remove.

import { spawnSync } from "node:child_process";

const ambiente = process.env.VERCEL_ENV;

if (ambiente === "preview") {
  console.log(
    "[preparar-banco] Deploy de preview: migrações e seed não são aplicados " +
      "(o preview compartilha o banco de produção)."
  );
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error(
    "[preparar-banco] DATABASE_URL não está configurada.\n" +
      "  Local:  copie a string de conexão do Neon para o arquivo .env\n" +
      "  Vercel: Settings -> Environment Variables"
  );
  process.exit(1);
}

function rodar(titulo, comando, argumentos) {
  console.log(`[preparar-banco] ${titulo}...`);
  const resultado = spawnSync(comando, argumentos, {
    stdio: "inherit",
    shell: true,
  });
  if (resultado.status !== 0) {
    console.error(`[preparar-banco] Falhou em: ${titulo}`);
    process.exit(resultado.status ?? 1);
  }
}

rodar("aplicando migrações", "prisma", ["migrate", "deploy"]);
rodar("conferindo dados iniciais", "tsx", ["prisma/seed.ts"]);

console.log("[preparar-banco] Banco pronto.");
