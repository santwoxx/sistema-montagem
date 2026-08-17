import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_PROJECT_ID = "sistema-montagem-92126";

const jwks = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

export type IdentidadeGoogle = {
  email: string;
  nome: string;
};

/**
 * Verifica a assinatura do ID token do Firebase (sem precisar de uma
 * service account) usando as chaves públicas do Google, e confere se o
 * token é mesmo deste projeto Firebase.
 */
export async function verificarTokenGoogle(idToken: string): Promise<IdentidadeGoogle | null> {
  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    const email = typeof payload.email === "string" ? payload.email : null;
    const emailVerificado = payload.email_verified === true;
    if (!email || !emailVerificado) return null;

    const nome = typeof payload.name === "string" ? payload.name : email;
    return { email: email.toLowerCase(), nome };
  } catch {
    return null;
  }
}

export type ResultadoAutorizacao = {
  autorizado: boolean;
  status: number;
  detalhe?: string;
};

/**
 * Confere se o e-mail está autorizado a entrar como administrador. A lista
 * de e-mails autorizados vive nas regras do Firestore (firestore.rules), não
 * em dados — por isso aqui só tentamos ler um documento fixo
 * ("adminEmails/check"): a própria regra decide, com base no e-mail de quem
 * está pedindo, se a leitura é permitida ou não. Usa o ID token do usuário
 * (já verificado acima) — não precisa de credenciais de servidor.
 */
export async function emailAutorizadoComoAdmin(
  idToken: string
): Promise<ResultadoAutorizacao> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/adminEmails/check`;

  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });

  if (resposta.ok) return { autorizado: true, status: resposta.status };

  const detalhe = await resposta.text().catch(() => "");
  return { autorizado: false, status: resposta.status, detalhe: detalhe.slice(0, 300) };
}
