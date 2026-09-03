import { FUSO_HORARIO, partesNoFuso } from "@/lib/datas";

export function formatarMoeda(valor: number | null | undefined) {
  return (valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Todas as datas são exibidas no fuso do negócio, não no fuso de quem
// renderiza. Sem o `timeZone` explícito, o servidor da Vercel (UTC) mostrava
// uma montagem concluída às 22h já com a data do dia seguinte -- e o mesmo
// registro aparecia com data diferente conforme fosse o servidor ou o
// navegador a formatar.
export function formatarData(data: Date | string | null | undefined) {
  if (!data) return "-";
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO_HORARIO });
}

export function formatarDataHora(data: Date | string | null | undefined) {
  if (!data) return "-";
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO_HORARIO,
  });
}

/** yyyy-MM-dd para `<input type="date">`, no fuso do negócio. */
export function paraInputDate(data: Date | string | null | undefined) {
  if (!data) return "";
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "";
  const p = partesNoFuso(d);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

export function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

// Converte um texto no formato brasileiro ("2.999,00", ponto de milhar e
// vírgula decimal) para number. Só trocar a vírgula por ponto (sem tirar o
// ponto de milhar) quebra valores >= 1000 — "2.999,00" virava "2.999.00",
// que o parser lê como 2,999 (não 2999). Sem vírgula, assume que já está em
// formato decimal comum (ex: "250" ou "250.5").
export function paraNumeroBr(valor: string | number | null | undefined): number {
  if (typeof valor === "number") return valor;
  const texto = String(valor ?? "").trim();
  if (!texto) return NaN;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  return Number(normalizado);
}

export function formatarCnpj(cnpj: string | null | undefined) {
  if (!cnpj) return "";
  const digitos = apenasDigitos(cnpj);
  if (digitos.length !== 14) return cnpj;
  return digitos.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
}

// linkMapa/linkWaze moram em lib/mapas.ts, junto com os links de rota com
// várias paradas usados no painel do admin.

// Único lugar que monta link de WhatsApp: o prefixo 55 (código do Brasil)
// estava repetido em quatro arquivos, e uma mensagem pronta é o caso mais
// comum (aviso de ocorrência para a loja, pedido de avaliação, rota do dia).
export function linkWhatsapp(telefone: string, mensagem?: string) {
  const digitos = apenasDigitos(telefone);
  const comCodigoPais = digitos.startsWith("55") ? digitos : `55${digitos}`;
  const base = `https://wa.me/${comCodigoPais}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

export function linkTelefone(telefone: string) {
  return `tel:${apenasDigitos(telefone)}`;
}

// Telefone no formato que se lê num cartão: (73) 98803-6706. O número é
// gravado do jeito que a loja mandou (às vezes só dígitos, às vezes com
// código do país), e é ele que aparece na tela ao lado do botão de ligar.
// Fora dos tamanhos conhecidos, devolve o texto original -- melhor mostrar
// esquisito do que esconder o contato do cliente.
export function formatarTelefone(telefone: string | null | undefined) {
  const original = String(telefone ?? "").trim();
  // Anotação junto do número ("73 99991-2345 recado", "casa") é comum, e
  // formatar jogaria fora justamente o aviso de quem atende. Nesses casos
  // o texto vai inteiro para a tela -- o link de ligar usa só os dígitos
  // de qualquer jeito (linkTelefone).
  if (/\p{L}/u.test(original)) return original;

  let digitos = apenasDigitos(original);
  // "+55 73 98803-6706" e "5573988036706" chegam com o código do país.
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2);

  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return original;
}

export const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const STATUS_COLOR: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-800 border border-amber-200",
  EM_ANDAMENTO: "bg-blue-100 text-blue-800 border border-blue-200",
  CONCLUIDO: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  CANCELADO: "bg-gray-200 text-gray-600 border border-gray-300",
};

export const OCORRENCIA_LABEL: Record<string, string> = {
  CLIENTE_AUSENTE: "Cliente ausente",
  PECA_DANIFICADA: "Peça danificada ou faltando",
  REAGENDAR: "Cliente pediu para remarcar",
  OUTRO: "Outro problema",
};

export const OCORRENCIA_COLOR: Record<string, string> = {
  CLIENTE_AUSENTE: "bg-amber-100 text-amber-800 border border-amber-200",
  PECA_DANIFICADA: "bg-red-100 text-red-800 border border-red-200",
  REAGENDAR: "bg-blue-100 text-blue-800 border border-blue-200",
  OUTRO: "bg-gray-200 text-gray-700 border border-gray-300",
};
