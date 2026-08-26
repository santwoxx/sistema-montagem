import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/session-secret";

// Encerra a sessão apagando o cookie e devolve a pessoa ao login.
//
// Existe porque o cookie e o banco podem discordar: a assinatura do cookie
// continua válida por 30 dias, mas o usuário pode ter sido desativado ou
// excluído no meio do caminho (ver getSessionUser em lib/auth.ts). Nesse
// caso não dá para redirecionar direto para /login -- o proxy veria um
// cookie assinado e devolveria para /admin, em laço. Apagar o cookie aqui,
// numa rota fora do matcher do proxy, quebra o laço.
//
// Também é o destino do botão "Sair" quando a Server Action de logout não
// puder rodar (ex: JavaScript desabilitado).
const MOTIVOS: Record<string, string> = {
  sessao:
    "Sua sessão foi encerrada porque seu acesso foi alterado. Entre novamente.",
};

export async function GET(request: NextRequest) {
  const motivo = request.nextUrl.searchParams.get("motivo") ?? "";
  const mensagem = MOTIVOS[motivo];

  const destino = new URL("/login", request.url);
  if (mensagem) destino.searchParams.set("erro", mensagem);

  const resposta = NextResponse.redirect(destino);
  // Apaga com o mesmo path com que foi criado (ver createSession), senão o
  // navegador mantém o cookie e a pessoa volta presa no mesmo laço.
  resposta.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return resposta;
}
