import { headers } from "next/headers";

/**
 * Endereço público desta instalação, para montar links que saem do sistema
 * (avaliação, agendamento) e vão parar no WhatsApp de alguém.
 *
 * Sai dos cabeçalhos do próprio pedido, e não de uma variável obrigatória:
 * assim funciona igual em localhost, no domínio da Vercel e num domínio
 * próprio, sem ninguém precisar lembrar de atualizar configuração — e sem o
 * risco de divulgar um link apontando para o lugar errado.
 * `NEXT_PUBLIC_APP_URL` continua tendo a última palavra para quem roda
 * atrás de um proxy que reescreve o host.
 */
export async function obterUrlBase(): Promise<string> {
  const configurada = process.env.NEXT_PUBLIC_APP_URL;
  if (configurada) return configurada.replace(/\/+$/, "");

  const cabecalhos = await headers();
  const host = cabecalhos.get("host") ?? "localhost:3000";
  const proto =
    cabecalhos.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
