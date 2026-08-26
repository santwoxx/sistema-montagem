// Datas ancoradas no fuso do negócio, não no fuso do servidor.
//
// O problema que isto resolve: a Vercel roda as funções em UTC, e o código
// montava os períodos com `new Date(ano, mes - 1, 1)` e `setHours(0,0,0,0)`,
// que usam o fuso do processo. Em UTC, "início de agosto" virava 01/08 00:00
// UTC = 31/07 21:00 em Itabuna -- então uma montagem lançada no fim da noite
// do dia 31 caía no mês seguinte, e uma montagem concluída às 22h aparecia
// com a data do dia seguinte na tela.
//
// Definir TZ=America/Sao_Paulo nas variáveis de ambiente da Vercel também
// resolveria, mas só lá: a máquina de quem desenvolve, um script avulso ou
// um provedor futuro continuariam divergindo. Aqui o fuso é explícito e o
// resultado é o mesmo em qualquer lugar -- inclusive no navegador, o que
// mantém o que o servidor renderiza igual ao que o cliente calcula.

export const FUSO_HORARIO = "America/Sao_Paulo";

const FORMATADOR_PARTES = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_HORARIO,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type PartesData = {
  ano: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
};

/** Que horas eram (no fuso do negócio) num determinado instante. */
export function partesNoFuso(instante: Date): PartesData {
  const partes = Object.fromEntries(
    FORMATADOR_PARTES.formatToParts(instante).map((p) => [p.type, p.value])
  ) as Record<string, string>;

  return {
    ano: Number(partes.year),
    // "24" em vez de "00" acontece em algumas engines para a meia-noite.
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
  };
}

/** Quantos minutos o fuso está à frente do UTC naquele instante. */
function deslocamentoEmMinutos(instante: Date): number {
  const p = partesNoFuso(instante);
  const comoSeFosseUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  // Descarta os milissegundos, que o formatador não devolve.
  return (comoSeFosseUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60000;
}

/**
 * O instante exato que corresponde a uma data/hora "de relógio de parede" no
 * fuso do negócio. `mes` é 1-12 e aceita passar do fim (mes = 13 vira
 * janeiro do ano seguinte), o que deixa o cálculo de "fim do mês" trivial.
 */
export function instanteLocal(
  ano: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0
): Date {
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const deslocamento = deslocamentoEmMinutos(new Date(alvo));
  const resultado = new Date(alvo - deslocamento * 60_000);

  // Segunda passada: numa virada de horário de verão o deslocamento do
  // palpite pode ser diferente do deslocamento do resultado. O Brasil não
  // usa horário de verão hoje, mas já usou -- e o custo de conferir é zero.
  const conferido = deslocamentoEmMinutos(resultado);
  return conferido === deslocamento
    ? resultado
    : new Date(alvo - conferido * 60_000);
}

/** Meia-noite de hoje, no fuso do negócio. */
export function inicioDoDiaLocal(referencia = new Date()): Date {
  const p = partesNoFuso(referencia);
  return instanteLocal(p.ano, p.mes, p.dia);
}

/** Primeiro instante do mês corrente, no fuso do negócio. */
export function inicioDoMesLocal(referencia = new Date()): Date {
  const p = partesNoFuso(referencia);
  return instanteLocal(p.ano, p.mes, 1);
}

/**
 * Intervalo [início, fim) do mês informado como "AAAA-MM" (o valor que sai
 * de um `<input type="month">`). Cai no mês corrente se vier algo inválido.
 */
export function intervaloDoMes(mes: string): { inicio: Date; fim: Date } {
  const [anoTexto, mesTexto] = String(mes || "").split("-");
  const ano = Number(anoTexto);
  const numeroMes = Number(mesTexto);

  const valido =
    Number.isInteger(ano) &&
    ano >= 1970 &&
    ano <= 9999 &&
    Number.isInteger(numeroMes) &&
    numeroMes >= 1 &&
    numeroMes <= 12;

  if (!valido) {
    const agora = partesNoFuso(new Date());
    return {
      inicio: instanteLocal(agora.ano, agora.mes, 1),
      fim: instanteLocal(agora.ano, agora.mes + 1, 1),
    };
  }

  return {
    inicio: instanteLocal(ano, numeroMes, 1),
    fim: instanteLocal(ano, numeroMes + 1, 1),
  };
}

/**
 * Intervalo [início, fim) do dia informado como "AAAA-MM-DD" (o valor de um
 * `<input type="date">`). Devolve null se a data não fizer sentido.
 */
export function intervaloDoDia(data: string): { inicio: Date; fim: Date } | null {
  const [anoTexto, mesTexto, diaTexto] = String(data || "").split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);

  const valido =
    Number.isInteger(ano) &&
    ano >= 1970 &&
    ano <= 9999 &&
    Number.isInteger(mes) &&
    mes >= 1 &&
    mes <= 12 &&
    Number.isInteger(dia) &&
    dia >= 1 &&
    dia <= 31;

  if (!valido) return null;

  return {
    inicio: instanteLocal(ano, mes, dia),
    fim: instanteLocal(ano, mes, dia + 1),
  };
}

/** O mês corrente como "AAAA-MM", pronto para um `<input type="month">`. */
export function mesAtual(referencia = new Date()): string {
  const p = partesNoFuso(referencia);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}`;
}
