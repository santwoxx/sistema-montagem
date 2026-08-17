// Fica num arquivo à parte (sem importar bcrypt/prisma) porque tanto
// lib/auth.ts (runtime Node, usado nas Server Actions/páginas) quanto
// proxy.ts (runtime Edge, roda em toda requisição pra /admin, /montador e
// /login) precisam do mesmo segredo -- e o Edge não roda bcrypt/Prisma.
//
// Esse repositório é público (ver comentário em prisma/seed.ts sobre a
// senha do admin), então o valor de fallback abaixo é visível pra qualquer
// pessoa. Se SESSION_SECRET não estiver configurada em produção, qualquer
// um consegue forjar um cookie "sessao" com esse segredo conhecido e virar
// admin sem senha -- por isso o throw abaixo: falha alto e visível no boot
// em vez de aceitar login forjado silenciosamente.
export const COOKIE_NAME = "sessao";

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET não configurada. Defina essa variável de ambiente (Vercel -> Settings -> Environment Variables) antes de rodar em produção."
  );
}

export const SESSION_SECRET_BYTES = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "chave-de-desenvolvimento-insegura-troque-isso"
);
