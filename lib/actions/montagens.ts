"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession, requireAdmin } from "@/lib/auth";
import { linkWhatsapp, OCORRENCIA_LABEL, paraNumeroBr } from "@/lib/format";
import { pareceIdDoCentralSync } from "@/lib/centralsync";

function paraNumero(valor: FormDataEntryValue | null, padrao = 0) {
  const numero = paraNumeroBr(String(valor ?? ""));
  return Number.isFinite(numero) ? numero : padrao;
}

function paraData(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const data = new Date(`${texto}T12:00:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function arredondar(valor: number) {
  return Math.round(valor * 100) / 100;
}

// Percentual sempre entre 0 e 100. Sem esse limite, um valor digitado
// errado (ou um "-10" mandado direto no POST do formulário) gravava
// comissão negativa e contaminava o financeiro sem nenhum aviso.
function paraPercentual(valor: FormDataEntryValue | null) {
  const numero = arredondar(paraNumero(valor));
  if (numero < 0) return 0;
  return numero > 100 ? 100 : numero;
}

// Toda ação que mexe numa montagem afeta as mesmas telas dos dois painéis:
// listagem, painel geral, financeiro e a rota do dia. Antes cada ação
// repetia a sua própria lista de revalidatePath e as listas divergiam --
// era por isso que o financeiro do admin continuava mostrando números
// velhos depois de criar ou excluir uma montagem.
function revalidarMontagem(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/montagens");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/rota");
  revalidatePath("/montador");
  revalidatePath("/montador/financeiro");
  if (id) {
    revalidatePath(`/admin/montagens/${id}`);
    revalidatePath(`/montador/montagens/${id}`);
  }
}

const TAMANHO_MAXIMO_MANUAL = 20 * 1024 * 1024; // 20 MB

// Manual/instrução que o admin anexa ao designar o montador — aceita
// qualquer tipo de arquivo (imagem, PDF etc.), não só imagens como as
// fotos de comprovante. Retorna undefined se nenhum arquivo novo foi
// enviado (nesse caso o valor já salvo na montagem não é mexido).
async function processarManual(formData: FormData, caminhoErro: string) {
  const manual = formData.get("manual");
  if (!(manual instanceof File) || manual.size === 0) return undefined;

  if (manual.size > TAMANHO_MAXIMO_MANUAL) {
    redirect(
      `${caminhoErro}?erro=${encodeURIComponent(
        "O arquivo do manual é muito grande (máximo 20 MB)."
      )}`
    );
  }

  const partesNome = manual.name.split(".");
  const extensao = partesNome.length > 1 ? partesNome.pop() : "bin";
  const blob = await put(`manuais/${Date.now()}.${extensao}`, manual, {
    access: "public",
    addRandomSuffix: true,
  });

  return {
    manualUrl: blob.url,
    manualNomeArquivo: manual.name,
    manualTipo: manual.type || null,
  };
}

export async function criarMontagemAction(formData: FormData) {
  await requireAdmin();

  const notaPendenteId = String(formData.get("notaPendenteId") || "").trim();
  const lojaId = String(formData.get("lojaId") || "");
  const montadorIdBruto = String(formData.get("montadorId") || "");
  const feitoPorAdm = montadorIdBruto === "ADM";
  const montadorId = montadorIdBruto && montadorIdBruto !== "ADM" ? montadorIdBruto : null;

  const clienteNome = String(formData.get("clienteNome") || "").trim();
  const clienteTelefone = String(formData.get("clienteTelefone") || "").trim();
  const clienteEndereco = String(formData.get("clienteEndereco") || "").trim();
  const numeroPedido = String(formData.get("numeroPedido") || "").trim();
  const descricaoServico = String(formData.get("descricaoServico") || "").trim();
  const observacoes = String(formData.get("observacoes") || "").trim();

  const valorServico = arredondar(paraNumero(formData.get("valorServico")));
  const percentualAssistencia = paraPercentual(formData.get("percentualAssistencia"));
  const percentualMontador = paraPercentual(formData.get("percentualMontador"));
  const dataAgendada = paraData(formData.get("dataAgendada"));

  if (!lojaId || !clienteNome || !clienteEndereco || !descricaoServico || valorServico <= 0) {
    redirect(
      `/admin/montagens/nova?erro=${encodeURIComponent(
        "Preencha loja, cliente, endereço, serviço e um valor válido."
      )}`
    );
  }

  let manualDados = await processarManual(formData, "/admin/montagens/nova");

  // Se veio de uma nota pendente (ex: pedido enviado pelo CentralSync) e o
  // admin não anexou um manual próprio, usa a foto de referência do produto
  // que veio junto com a nota como manual/instrução da montagem.
  let notaPendente: { fotoReferenciaUrl: string | null } | null = null;
  if (notaPendenteId) {
    notaPendente = await prisma.notaPendente.findUnique({
      where: { id: notaPendenteId },
      select: { fotoReferenciaUrl: true },
    });
  }
  if (!manualDados && notaPendente?.fotoReferenciaUrl) {
    manualDados = {
      manualUrl: notaPendente.fotoReferenciaUrl,
      manualNomeArquivo: "Foto do produto (CentralSync)",
      manualTipo: null,
    };
  }

  const valorMontador = arredondar((valorServico * percentualMontador) / 100);
  const valorAssistencia = arredondar((valorServico * percentualAssistencia) / 100);

  const montagem = await prisma.montagem.create({
    data: {
      lojaId,
      montadorId,
      clienteNome,
      clienteTelefone: clienteTelefone || null,
      clienteEndereco,
      numeroPedido: numeroPedido || null,
      descricaoServico,
      observacoes: observacoes || null,
      valorServico,
      percentualAssistencia,
      valorAssistencia,
      percentualMontador,
      valorMontador,
      feitoPorAdm,
      dataAgendada,
      ...manualDados,
    },
  });

  // Some com a nota pendente agora que virou uma montagem de verdade —
  // melhor esforço, não impede a criação se falhar.
  if (notaPendenteId) {
    await prisma.notaPendente.delete({ where: { id: notaPendenteId } }).catch(() => {});
  }

  revalidarMontagem(montagem.id);
  redirect(
    `/admin/montagens/${montagem.id}?sucesso=${encodeURIComponent(
      "Montagem criada com sucesso."
    )}`
  );
}

export async function atualizarMontagemAction(id: string, formData: FormData) {
  await requireAdmin();

  const lojaId = String(formData.get("lojaId") || "");
  const montadorIdBruto = String(formData.get("montadorId") || "");
  const feitoPorAdm = montadorIdBruto === "ADM";
  const montadorId = montadorIdBruto && montadorIdBruto !== "ADM" ? montadorIdBruto : null;

  const clienteNome = String(formData.get("clienteNome") || "").trim();
  const clienteTelefone = String(formData.get("clienteTelefone") || "").trim();
  const clienteEndereco = String(formData.get("clienteEndereco") || "").trim();
  const numeroPedido = String(formData.get("numeroPedido") || "").trim();
  const descricaoServico = String(formData.get("descricaoServico") || "").trim();
  const observacoes = String(formData.get("observacoes") || "").trim();
  const status = String(formData.get("status") || "PENDENTE") as
    | "PENDENTE"
    | "EM_ANDAMENTO"
    | "CONCLUIDO"
    | "CANCELADO";

  const valorServico = arredondar(paraNumero(formData.get("valorServico")));
  const percentualAssistencia = paraPercentual(formData.get("percentualAssistencia"));
  const percentualMontador = paraPercentual(formData.get("percentualMontador"));
  const dataAgendada = paraData(formData.get("dataAgendada"));

  if (!lojaId || !clienteNome || !clienteEndereco || !descricaoServico || valorServico <= 0) {
    redirect(
      `/admin/montagens/${id}?erro=${encodeURIComponent(
        "Preencha loja, cliente, endereço, serviço e um valor válido."
      )}`
    );
  }

  const manualDados = await processarManual(formData, `/admin/montagens/${id}`);

  const valorMontador = arredondar((valorServico * percentualMontador) / 100);
  const valorAssistencia = arredondar((valorServico * percentualAssistencia) / 100);

  const atual = await prisma.montagem.findUnique({ where: { id } });
  const concluidoEm =
    status === "CONCLUIDO" ? atual?.concluidoEm ?? new Date() : null;

  await prisma.montagem.update({
    where: { id },
    data: {
      lojaId,
      montadorId,
      clienteNome,
      clienteTelefone: clienteTelefone || null,
      clienteEndereco,
      numeroPedido: numeroPedido || null,
      descricaoServico,
      observacoes: observacoes || null,
      valorServico,
      percentualAssistencia,
      valorAssistencia,
      ...manualDados,
      percentualMontador,
      valorMontador,
      feitoPorAdm,
      dataAgendada,
      status,
      concluidoEm,
    },
  });

  // Essa ação pode mudar o que o montador vê (montador designado, manual
  // anexado, endereço etc.), então o lado dele também precisa atualizar.
  revalidarMontagem(id);
  redirect(
    `/admin/montagens/${id}?sucesso=${encodeURIComponent("Montagem atualizada.")}`
  );
}

async function podeGerenciar(montagemId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const montagem = await prisma.montagem.findUnique({ where: { id: montagemId } });
  if (!montagem) redirect(session.role === "ADMIN" ? "/admin/montagens" : "/montador");

  if (session.role === "MONTADOR" && montagem.montadorId !== session.sub) {
    redirect("/montador");
  }

  return { session, montagem: montagem! };
}

function caminhoDetalhe(role: "ADMIN" | "MONTADOR", id: string) {
  return role === "ADMIN" ? `/admin/montagens/${id}` : `/montador/montagens/${id}`;
}

export async function atualizarClienteMontadorAction(id: string, formData: FormData) {
  const { session } = await podeGerenciar(id);
  const caminho = caminhoDetalhe(session.role, id);

  const clienteEndereco = String(formData.get("clienteEndereco") || "").trim();
  const clienteTelefone = String(formData.get("clienteTelefone") || "").trim();

  if (!clienteEndereco) {
    redirect(
      `${caminho}?erro=${encodeURIComponent("Informe o endereço do cliente.")}`
    );
  }

  await prisma.montagem.update({
    where: { id },
    data: { clienteEndereco, clienteTelefone: clienteTelefone || null },
  });

  revalidarMontagem(id);
  redirect(
    `${caminho}?sucesso=${encodeURIComponent("Endereço do cliente atualizado.")}`
  );
}

export async function atualizarStatusAction(
  id: string,
  novoStatus: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO"
) {
  const { session } = await podeGerenciar(id);

  await prisma.montagem.update({
    where: { id },
    data: {
      status: novoStatus,
      concluidoEm: novoStatus === "CONCLUIDO" ? new Date() : null,
    },
  });

  revalidarMontagem(id);
  redirect(caminhoDetalhe(session.role, id));
}

// Cloud Function do CentralSync que recebe a confirmação de montagem (fica
// esperando revisão de um admin de lá, não marca nada como concluído
// sozinha). Chave própria (MONTAFACIL_TO_CENTRALSYNC_KEY) -- de propósito
// diferente de CENTRALSYNC_API_KEY (usada em notas-pendentes/route.ts):
// aquela chave sai no bundle público do CentralSync (ele não tem backend),
// então nunca pode dobrar como segredo de um canal que precisa continuar
// privado. Sem fallback embutido no código -- se não estiver configurada,
// o envio simplesmente falha (ver avisarCentralSync).
const CENTRALSYNC_CONFIRMATION_URL = "https://us-central1-centralsync-c5b50.cloudfunctions.net/receiveMontagemConfirmation";
const CENTRALSYNC_SHARED_KEY = process.env.MONTAFACIL_TO_CENTRALSYNC_KEY;

// Chamado só pelo admin, pelo botão "Enviar ao CentralSync" (ver
// confirmarEnvioCentralSyncAction): o montador concluir aqui NÃO dispara
// nada sozinho. Do outro lado também nada é aplicado automaticamente: a
// confirmação entra na caixa "Montagens Feitas" da aba Entregas e um admin
// do CentralSync marca a entrega como montada depois de conferir foto e
// assinaturas.
async function avisarCentralSync(
  deliveryId: string,
  montadorNome: string | null,
  assemblerSignature: string,
  customerSignature: string,
  photo: string
): Promise<boolean> {
  if (!CENTRALSYNC_SHARED_KEY) {
    console.warn("MONTAFACIL_TO_CENTRALSYNC_KEY não configurada -- não é possível avisar o CentralSync.");
    return false;
  }
  try {
    const resposta = await fetch(CENTRALSYNC_CONFIRMATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-montafacil-key": CENTRALSYNC_SHARED_KEY,
      },
      body: JSON.stringify({ deliveryId, montadorNome, assemblerSignature, customerSignature, photo }),
      // Quem espera por esta chamada é o admin, na tela da montagem. Um
      // CentralSync fora do ar não pode deixar a tela travada: desiste em
      // 10s e o admin tenta de novo pelo mesmo botão.
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) {
      console.warn("CentralSync recusou a confirmação de montagem:", resposta.status);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Falha ao avisar o CentralSync sobre a montagem concluída:", e);
    return false;
  }
}

export async function concluirComProvaAction(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Só precisamos saber de quem é a montagem: o nome do montador só importa
  // no envio ao CentralSync, que hoje acontece no painel do admin.
  const montagem = await prisma.montagem.findUnique({
    where: { id },
    select: { montadorId: true },
  });
  if (!montagem) redirect("/montador");
  if (session.role !== "MONTADOR" || montagem.montadorId !== session.sub) {
    redirect("/montador");
  }

  const erro = (mensagem: string) =>
    redirect(
      `/montador/montagens/${id}?erro=${encodeURIComponent(mensagem)}`
    );

  const foto = formData.get("foto");
  const assinaturaMontador = String(formData.get("assinaturaMontador") || "");
  const assinaturaCliente = String(formData.get("assinaturaCliente") || "");

  if (!(foto instanceof File) || foto.size === 0) {
    erro("Tire uma foto do produto montado antes de concluir.");
    return;
  }
  if (!foto.type.startsWith("image/")) {
    erro("O arquivo da foto precisa ser uma imagem.");
    return;
  }
  if (foto.size > 8 * 1024 * 1024) {
    erro("A foto é muito grande (máximo 8 MB).");
    return;
  }
  if (!assinaturaMontador.startsWith("data:image/")) {
    erro("Falta a sua assinatura.");
    return;
  }
  if (!assinaturaCliente.startsWith("data:image/")) {
    erro("Falta a assinatura do cliente.");
    return;
  }

  const extensao = foto.type.split("/")[1] || "jpg";
  const blob = await put(`montagens/${id}-${Date.now()}.${extensao}`, foto, {
    access: "public",
    addRandomSuffix: true,
  });

  await prisma.montagem.update({
    where: { id },
    data: {
      status: "CONCLUIDO",
      concluidoEm: new Date(),
      fotoProdutoUrl: blob.url,
      assinaturaMontador,
      assinaturaCliente,
    },
  });

  // Concluir aqui NÃO avisa o CentralSync. Quem monta é o funcionário, mas
  // quem responde pela empresa perante a loja é o admin: a montagem
  // concluída entra na fila "Prontas para enviar ao CentralSync" do painel
  // do admin (ver app/admin/page.tsx) e só sai de lá quando ele confere a
  // foto e as assinaturas e clica em enviar (confirmarEnvioCentralSyncAction).
  // Fora que o montador está na rua, muitas vezes com internet ruim --
  // esperar a Cloud Function do CentralSync responder só pra ele conseguir
  // fechar a montagem era risco sem contrapartida.
  revalidarMontagem(id);
  redirect(`/montador/montagens/${id}`);
}

// Único caminho pelo qual uma conclusão sai daqui para o CentralSync,
// disparado pelo admin na fila do painel ou na tela da montagem. Serve
// tanto para o primeiro envio quanto para reenviar: do outro lado o
// documento é gravado pelo id da entrega, então reenviar sobrescreve o
// mesmo aviso em vez de criar outro.
//
// `origem` diz só para onde devolver o admin depois do clique: a fila do
// painel geral ou a tela da montagem. Os dois argumentos são sempre fixados
// com .bind no formulário -- assim a Server Action recebe zero argumentos de
// quem clica, e não dá para forjar um destino de redirecionamento.
export async function confirmarEnvioCentralSyncAction(
  id: string,
  origem: "painel" | "montagem"
) {
  await requireAdmin();

  const montagem = await prisma.montagem.findUnique({
    where: { id },
    include: { montador: { select: { nome: true } } },
  });
  if (!montagem) redirect("/admin/montagens");

  const voltarPara = origem === "painel" ? "/admin" : `/admin/montagens/${id}`;
  const comErro = (mensagem: string) =>
    redirect(`${voltarPara}?erro=${encodeURIComponent(mensagem)}`);

  if (!pareceIdDoCentralSync(montagem.numeroPedido)) {
    comErro("Esta montagem não veio do CentralSync, então não há o que enviar para lá.");
    return;
  }
  if (montagem.status !== "CONCLUIDO") {
    comErro("Marque a montagem como concluída antes de enviar a confirmação ao CentralSync.");
    return;
  }

  // A loja confere justamente a foto e as duas assinaturas. Mandar isso
  // vazio criava um aviso inútil do outro lado -- e marcava a montagem como
  // já enviada aqui, escondendo o problema.
  const faltando = [
    montagem.fotoProdutoUrl ? null : "a foto do produto montado",
    montagem.assinaturaMontador ? null : "a assinatura de quem montou",
    montagem.assinaturaCliente ? null : "a assinatura do cliente",
  ].filter((item): item is string => item !== null);

  if (faltando.length > 0) {
    comErro(
      `Falta ${faltando.join(", ")} para enviar ao CentralSync. Peça para quem montou concluir a montagem pelo aplicativo (foto + assinaturas).`
    );
    return;
  }

  const sucesso = await avisarCentralSync(
    montagem.numeroPedido,
    montagem.montador?.nome ?? null,
    montagem.assinaturaMontador!,
    montagem.assinaturaCliente!,
    montagem.fotoProdutoUrl!
  );

  if (!sucesso) {
    comErro("Não consegui avisar o CentralSync agora. Tente de novo em instantes.");
    return;
  }

  await prisma.montagem.update({
    where: { id },
    data: { notificadoCentralSyncEm: new Date() },
  });

  revalidatePath(`/admin/montagens/${id}`);
  revalidatePath("/admin");
  redirect(
    `${voltarPara}?sucesso=${encodeURIComponent("CentralSync avisado da conclusão.")}`
  );
}

const TIPOS_OCORRENCIA = ["CLIENTE_AUSENTE", "PECA_DANIFICADA", "REAGENDAR", "OUTRO"] as const;

type ResultadoOcorrencia =
  | { ok: true; url: string | null; aviso?: string }
  | { ok: false; erro: string };

// Registra a ocorrência (cliente ausente, peça danificada etc.) e devolve um
// link do WhatsApp (wa.me) já com a mensagem pronta para a loja, avisando
// qual pedido/cliente teve problema. Não dispara a mensagem sozinha -- por
// não termos uma API oficial do WhatsApp Business configurada, quem manda
// pra loja é o próprio montador, com um toque, a partir do link que abrimos
// (mesmo mecanismo do pedido de avaliação em gerarLinkAvaliacaoAction).
export async function registrarOcorrenciaAction(
  id: string,
  formData: FormData
): Promise<ResultadoOcorrencia> {
  const session = await getSession();
  if (!session) redirect("/login");

  const montagem = await prisma.montagem.findUnique({
    where: { id },
    include: { loja: true },
  });
  if (!montagem) return { ok: false, erro: "Montagem não encontrada." };
  if (session.role !== "MONTADOR" || montagem.montadorId !== session.sub) {
    return { ok: false, erro: "Você não tem acesso a esta montagem." };
  }

  const tipoBruto = String(formData.get("tipo") || "");
  if (!TIPOS_OCORRENCIA.includes(tipoBruto as (typeof TIPOS_OCORRENCIA)[number])) {
    return { ok: false, erro: "Selecione o que aconteceu na visita." };
  }
  const tipo = tipoBruto as (typeof TIPOS_OCORRENCIA)[number];
  const observacao = String(formData.get("observacao") || "").trim();

  let fotoUrl: string | undefined;
  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    if (!foto.type.startsWith("image/")) {
      return { ok: false, erro: "O arquivo da foto precisa ser uma imagem." };
    }
    if (foto.size > 8 * 1024 * 1024) {
      return { ok: false, erro: "A foto é muito grande (máximo 8 MB)." };
    }
    const extensao = foto.type.split("/")[1] || "jpg";
    const blob = await put(`ocorrencias/${id}-${Date.now()}.${extensao}`, foto, {
      access: "public",
      addRandomSuffix: true,
    });
    fotoUrl = blob.url;
  }

  await prisma.$transaction([
    prisma.ocorrencia.create({
      data: { montagemId: id, tipo, observacao: observacao || null, fotoUrl },
    }),
    prisma.montagem.update({
      where: { id },
      data: { status: "PENDENTE" },
    }),
  ]);

  revalidarMontagem(id);

  const linhasMensagem = [
    "🚨 *Problema na montagem*",
    "",
    `Loja: ${montagem.loja.nome}`,
    `Cliente: ${montagem.clienteNome}`,
    montagem.numeroPedido ? `Pedido: ${montagem.numeroPedido}` : null,
    `Produto/serviço: ${montagem.descricaoServico}`,
    `Endereço: ${montagem.clienteEndereco}`,
    "",
    `Problema: ${OCORRENCIA_LABEL[tipo]}`,
    observacao ? `Detalhes: ${observacao}` : null,
    fotoUrl ? `Foto: ${fotoUrl}` : null,
  ].filter((linha): linha is string => linha !== null);
  const mensagem = linhasMensagem.join("\n");

  if (!montagem.loja.telefone) {
    return {
      ok: true,
      url: null,
      aviso:
        "Ocorrência registrada. Cadastre o WhatsApp da loja (em Lojas) para avisar automaticamente da próxima vez.",
    };
  }

  return { ok: true, url: linkWhatsapp(montagem.loja.telefone, mensagem) };
}

export async function alternarPagamentoLojaAction(id: string) {
  await requireAdmin();
  const montagem = await prisma.montagem.findUnique({ where: { id } });
  if (!montagem) redirect("/admin/montagens");

  await prisma.montagem.update({
    where: { id },
    data: { pagoPelaLoja: !montagem!.pagoPelaLoja },
  });

  revalidarMontagem(id);
  redirect(`/admin/montagens/${id}`);
}

export async function alternarPagamentoMontadorAction(id: string) {
  await requireAdmin();
  const montagem = await prisma.montagem.findUnique({ where: { id } });
  if (!montagem) redirect("/admin/montagens");

  await prisma.montagem.update({
    where: { id },
    data: { pagoAoMontador: !montagem!.pagoAoMontador },
  });

  // O pagamento afeta diretamente o que o montador vê no painel dele (o
  // valor "a receber" some da lista assim que marcado como pago).
  revalidarMontagem(id);
  redirect(`/admin/montagens/${id}`);
}

export async function excluirMontagemAction(id: string) {
  await requireAdmin();

  await prisma.montagem.delete({ where: { id } });

  revalidarMontagem(id);
  redirect(
    `/admin/montagens?sucesso=${encodeURIComponent("Montagem excluída.")}`
  );
}
