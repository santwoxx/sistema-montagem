"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { instanteLocal } from "@/lib/datas";
import { ipDoPedido, registrarTentativa } from "@/lib/limite";
import { PeriodoAgendamentoSchema } from "@/lib/validacao";

// Quanto texto cada campo aceita. A página é pública: sem um teto aqui, um
// POST direto no endpoint da Server Action grava um texto de megabytes na
// fila do admin. Os limites são folgados para o uso real (um endereço
// completo cabe bem em 300) e existem só para haver um fim.
const LIMITES = {
  clienteNome: 120,
  clienteTelefone: 40,
  clienteEndereco: 300,
  produto: 300,
  observacoes: 600,
} as const;

// Uma pessoa pedindo agendamento manda um formulário, não vinte. O limite é
// por IP e por instância do servidor (ver lib/limite.ts): segura o caso
// comum de alguém martelando o botão ou um script bobo, não um ataque
// distribuído.
const LIMITE_ENVIOS = 5;
const JANELA_ENVIOS_MS = 10 * 60 * 1000;

function texto(formData: FormData, campo: keyof typeof LIMITES): string {
  return String(formData.get(campo) ?? "")
    .trim()
    .slice(0, LIMITES[campo]);
}

function voltarComErro(mensagem: string): never {
  redirect(`/agendar?erro=${encodeURIComponent(mensagem)}`);
}

/**
 * Recebe o formulário público de agendamento (/agendar).
 *
 * Não cria montagem: grava uma solicitação numa fila que o admin revisa.
 * Quem chega aqui não está autenticado e não tem como saber preço, comissão
 * nem agenda — deixar isso virar montagem sozinho colocaria no financeiro
 * (e na rota do dia) um serviço que ninguém conferiu.
 */
export async function criarSolicitacaoAction(formData: FormData) {
  const cabecalhos = await headers();
  const limite = registrarTentativa(`agendar:${ipDoPedido(cabecalhos)}`, {
    limite: LIMITE_ENVIOS,
    janelaMs: JANELA_ENVIOS_MS,
  });
  if (!limite.permitido) {
    voltarComErro(
      "Recebemos vários pedidos deste aparelho agora há pouco. Espere alguns minutos e tente de novo."
    );
  }

  const clienteNome = texto(formData, "clienteNome");
  const clienteTelefone = texto(formData, "clienteTelefone");
  const clienteEndereco = texto(formData, "clienteEndereco");
  const produto = texto(formData, "produto");
  const observacoes = texto(formData, "observacoes");

  if (!clienteNome || !clienteTelefone || !clienteEndereco || !produto) {
    voltarComErro(
      "Preencha nome, telefone, endereço e o que precisa ser montado."
    );
  }

  // Meio-dia no fuso do negócio, igual ao que criarMontagemAction faz com a
  // data agendada: assim o dia escolhido não escorrega para o anterior
  // quando a tela formata a data.
  const [ano, mes, dia] = String(formData.get("dataPreferida") ?? "")
    .trim()
    .split("-")
    .map(Number);
  const dataPreferida =
    Number.isInteger(ano) && Number.isInteger(mes) && Number.isInteger(dia)
      ? instanteLocal(ano, mes, dia, 12)
      : null;

  const periodoAnalise = PeriodoAgendamentoSchema.safeParse(
    String(formData.get("periodo") ?? "")
  );

  await prisma.solicitacaoAgendamento.create({
    data: {
      clienteNome,
      clienteTelefone,
      clienteEndereco,
      produto,
      observacoes: observacoes || null,
      dataPreferida,
      periodo: periodoAnalise.success ? periodoAnalise.data : null,
    },
  });

  revalidatePath("/admin");
  redirect("/agendar?enviado=1");
}

/**
 * Tira uma solicitação da fila sem criar montagem (trote, fora da região,
 * cliente desistiu). Não apaga: a linha continua gravada como histórico de
 * quem procurou a empresa.
 */
export async function recusarSolicitacaoAction(id: string) {
  await requireAdmin();

  await prisma.solicitacaoAgendamento.updateMany({
    where: { id, atendidaEm: null, recusadaEm: null },
    data: { recusadaEm: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/montagens/nova");
}
