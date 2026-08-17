import { prisma } from "@/lib/prisma";
import { normalizarCnpj } from "@/lib/cnpj";

// Endpoint público chamado pelo CentralSync (outro sistema, sem sessão de
// login aqui) quando um pedido é designado ao Dario por lá. Não cria uma
// Montagem de verdade — só deixa o pedido em "Notas pendentes" (ver
// app/admin/montagens/nova) até um admin revisar, completar loja/valor e
// clicar em salvar. Protegido por uma chave compartilhada, não por sessão.

const ALLOWED_ORIGIN = "https://centralsync.vercel.app";
const TAMANHO_MAXIMO_CAMPO = 300;
const TAMANHO_MAXIMO_TEXTO_LONGO = 2000;
const TAMANHO_MAXIMO_URL = 2000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-centralsync-key",
    Vary: "Origin",
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function textoValido(valor: unknown, tamanhoMaximo: number): string | undefined {
  if (typeof valor !== "string") return undefined;
  const texto = valor.trim().slice(0, tamanhoMaximo);
  return texto || undefined;
}

function urlValida(valor: unknown, tamanhoMaximo: number): string | undefined {
  const texto = textoValido(valor, tamanhoMaximo);
  if (!texto) return undefined;
  try {
    const url = new URL(texto);
    return url.protocol === "https:" || url.protocol === "http:" ? texto : undefined;
  } catch {
    return undefined;
  }
}

function numeroPositivoValido(valor: unknown): number | undefined {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) return undefined;
  return Math.round(valor * 100) / 100;
}

export async function POST(request: Request) {
  const chaveEsperada = process.env.CENTRALSYNC_API_KEY;
  const chaveRecebida = request.headers.get("x-centralsync-key");

  if (!chaveEsperada || chaveRecebida !== chaveEsperada) {
    return jsonResponse(401, { ok: false, erro: "Chave de acesso inválida." });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, erro: "JSON inválido." });
  }

  const dados = corpo as Record<string, unknown>;

  const clienteNome = textoValido(dados.clienteNome, TAMANHO_MAXIMO_CAMPO);
  const clienteEndereco = textoValido(dados.clienteEndereco, TAMANHO_MAXIMO_CAMPO);
  const descricaoServico = textoValido(dados.descricaoServico, TAMANHO_MAXIMO_TEXTO_LONGO);

  if (!clienteNome || !clienteEndereco || !descricaoServico) {
    return jsonResponse(400, {
      ok: false,
      erro: "clienteNome, clienteEndereco e descricaoServico são obrigatórios.",
    });
  }

  const clienteTelefone = textoValido(dados.clienteTelefone, TAMANHO_MAXIMO_CAMPO);
  const numeroPedido = textoValido(dados.numeroPedido, TAMANHO_MAXIMO_CAMPO);
  const observacoes = textoValido(dados.observacoes, TAMANHO_MAXIMO_TEXTO_LONGO);
  const montadorSugeridoNome = textoValido(dados.montadorSugerido, TAMANHO_MAXIMO_CAMPO);
  const valorServico = numeroPositivoValido(dados.valorServico);
  const fotoReferenciaUrl = urlValida(dados.fotoReferenciaUrl, TAMANHO_MAXIMO_URL);
  // Opcional: se o CentralSync informar a loja emitente (nome e/ou CNPJ),
  // "Usar esta nota" já resolve/cadastra ela automaticamente — mesmo
  // mecanismo da importação por OCR/XML. Sem isso, o admin escolhe a loja
  // manualmente como já acontecia antes.
  const lojaNomeSugerida = textoValido(dados.lojaNome, TAMANHO_MAXIMO_CAMPO);
  const lojaCnpjSugerido = normalizarCnpj(textoValido(dados.lojaCnpj, TAMANHO_MAXIMO_CAMPO)) ?? undefined;

  let dataAgendada: Date | undefined;
  const dataAgendadaBruta = textoValido(dados.dataAgendada, 20);
  if (dataAgendadaBruta) {
    const parsed = new Date(`${dataAgendadaBruta}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) dataAgendada = parsed;
  }

  let montadorSugeridoId: string | undefined;
  if (montadorSugeridoNome) {
    const montador = await prisma.user.findFirst({
      where: { role: "MONTADOR", ativo: true, nome: { equals: montadorSugeridoNome, mode: "insensitive" } },
      select: { id: true },
    });
    montadorSugeridoId = montador?.id;
  }

  const notaPendente = await prisma.notaPendente.create({
    data: {
      numeroPedido,
      clienteNome,
      clienteTelefone,
      clienteEndereco,
      descricaoServico,
      valorServico,
      dataAgendada,
      observacoes,
      fotoReferenciaUrl,
      montadorSugeridoId,
      lojaNomeSugerida,
      lojaCnpjSugerido,
    },
  });

  return jsonResponse(201, { ok: true, id: notaPendente.id });
}
