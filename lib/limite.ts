// Limite de tentativas por janela de tempo.
//
// O login não tinha nenhuma trava: dava para tentar senha de montador em
// sequência, à vontade, e o único custo era o do bcrypt. O endpoint que
// recebe notas do CentralSync também aceitava chamadas sem limite.
//
// O que dá para prometer aqui: a contagem vive na memória do processo, e a
// Vercel roda várias instâncias -- então o limite real é "por instância",
// não global, e zera quando a instância é reciclada. Isso não segura um
// ataque distribuído; segura o caso comum, que é a mesma origem martelando
// a mesma conta. Um limite global de verdade pede um armazenamento
// compartilhado (Redis/Upstash), que é a evolução natural disto sem mudar
// as chamadas: só a implementação daqui muda.

type Janela = { contagem: number; expiraEm: number };

const janelas = new Map<string, Janela>();

// Teto de chaves guardadas. Sem isto, uma enxurrada de e-mails/IPs
// diferentes faria o Map crescer sem parar dentro do processo.
const MAXIMO_CHAVES = 10_000;

function limparExpiradas(agora: number) {
  for (const [chave, janela] of janelas) {
    if (janela.expiraEm <= agora) janelas.delete(chave);
  }
}

export type ResultadoLimite = {
  permitido: boolean;
  /** Quantos segundos faltam para poder tentar de novo. */
  esperarSegundos: number;
};

/**
 * Conta mais uma tentativa para `chave` e diz se ela pode seguir.
 *
 * A janela é deslizante por reinício: ao estourar o limite, a espera é
 * contada a partir da última tentativa -- então insistir durante o bloqueio
 * mantém o bloqueio, em vez de deixar o contador expirar sozinho.
 */
export function registrarTentativa(
  chave: string,
  { limite, janelaMs }: { limite: number; janelaMs: number }
): ResultadoLimite {
  const agora = Date.now();

  if (janelas.size > MAXIMO_CHAVES) limparExpiradas(agora);

  const atual = janelas.get(chave);

  if (!atual || atual.expiraEm <= agora) {
    janelas.set(chave, { contagem: 1, expiraEm: agora + janelaMs });
    return { permitido: true, esperarSegundos: 0 };
  }

  atual.contagem += 1;

  if (atual.contagem > limite) {
    // Insistir estende o bloqueio.
    atual.expiraEm = agora + janelaMs;
    return {
      permitido: false,
      esperarSegundos: Math.ceil((atual.expiraEm - agora) / 1000),
    };
  }

  return { permitido: true, esperarSegundos: 0 };
}

/** Zera o contador -- usado quando a tentativa deu certo (ex: login válido). */
export function limparTentativas(chave: string) {
  janelas.delete(chave);
}

/**
 * IP de quem chamou, do jeito que a Vercel entrega. Serve só para agrupar
 * tentativas: é falsificável, por isso o login também conta por e-mail.
 */
export function ipDoPedido(cabecalhos: Headers): string {
  const encaminhado = cabecalhos.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return cabecalhos.get("x-real-ip")?.trim() || "desconhecido";
}
