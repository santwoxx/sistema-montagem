"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUsuario } from "@/lib/auth";
import {
  apagarArquivo,
  apagarArquivos,
  enviarArquivo,
  extensaoDe,
  TAMANHO_MAXIMO_UPLOAD,
  TAMANHO_MAXIMO_UPLOAD_TEXTO,
} from "@/lib/upload";
import { linkWhatsapp, OCORRENCIA_LABEL, paraNumeroBr } from "@/lib/format";
import {
  ehDesmontagemOuAssistencia,
  idDaEntregaNoCentralSync,
  nomeParaCentralSync,
  podeEnviarAoCentralSync,
} from "@/lib/centralsync";
import { instanteLocal } from "@/lib/datas";
import {
  OrigemEnvioSchema,
  STATUS_PERMITIDOS_MONTADOR,
  StatusMontagemSchema,
  TipoOcorrenciaSchema,
} from "@/lib/validacao";

function paraNumero(valor: FormDataEntryValue | null, padrao = 0) {
  const numero = paraNumeroBr(String(valor ?? ""));
  return Number.isFinite(numero) ? numero : padrao;
}

// Grava o dia agendado como meio-dia no fuso do negócio (e não meio-dia do
// fuso do servidor): assim a data continua caindo no mesmo dia quando a
// tela de rota filtra por dia e quando a lista formata para exibição.
function paraData(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  const [ano, mes, dia] = texto.split("-").map(Number);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) {
    return null;
  }
  const data = instanteLocal(ano, mes, dia, 12);
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

// Manual/instrução que o admin anexa ao designar o montador — aceita
// qualquer tipo de arquivo (imagem, PDF etc.), não só imagens como as
// fotos de comprovante. Retorna undefined se nenhum arquivo novo foi
// enviado (nesse caso o valor já salvo na montagem não é mexido).
//
// O limite aqui era de 20 MB, mas era mentira: o corpo de uma Server Action
// para em 1 MB por padrão (agora 4 MB, ver next.config.ts) e o pedido era
// recusado antes de chegar nesta função. Hoje o limite anunciado é o que
// realmente passa, e as imagens ainda sobem reduzidas pelo navegador.
async function processarManual(formData: FormData, caminhoErro: string) {
  const manual = formData.get("manual");
  if (!(manual instanceof File) || manual.size === 0) return undefined;

  if (manual.size > TAMANHO_MAXIMO_UPLOAD) {
    redirect(
      `${caminhoErro}?erro=${encodeURIComponent(
        `O arquivo do manual é muito grande (máximo ${TAMANHO_MAXIMO_UPLOAD_TEXTO}).`
      )}`
    );
  }

  const envio = await enviarArquivo(
    `manuais/${Date.now()}.${extensaoDe(manual, "bin")}`,
    manual
  );
  if (!envio.ok) {
    redirect(`${caminhoErro}?erro=${encodeURIComponent(envio.erro)}`);
  }

  return {
    manualUrl: envio.url,
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
  const notaUrl = String(formData.get("notaUrl") || "").trim();

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
      notaUrl: notaUrl || null,
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
  const notaUrl = String(formData.get("notaUrl") || "").trim();
  // Antes isto era um `as` direto no valor do formulário: um status
  // inventado atravessava até o Prisma e derrubava a tela com erro 500 em
  // vez de uma mensagem.
  const statusAnalise = StatusMontagemSchema.safeParse(
    String(formData.get("status") || "PENDENTE")
  );
  if (!statusAnalise.success) {
    redirect(
      `/admin/montagens/${id}?erro=${encodeURIComponent(
        "Status inválido. Escolha um dos status da lista."
      )}`
    );
  }
  const status = statusAnalise.data;

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

  const atual = await prisma.montagem.findUnique({
    where: { id },
    select: { concluidoEm: true, manualUrl: true },
  });
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
      notaUrl: notaUrl || null,
      ...manualDados,
      percentualMontador,
      valorMontador,
      feitoPorAdm,
      dataAgendada,
      status,
      concluidoEm,
    },
  });

  // Manual substituído: o arquivo antigo não serve mais para ninguém.
  // Depois do update, e em melhor esforço (ver apagarArquivo).
  if (manualDados && atual?.manualUrl && atual.manualUrl !== manualDados.manualUrl) {
    await apagarArquivo(atual.manualUrl);
  }

  // Essa ação pode mudar o que o montador vê (montador designado, manual
  // anexado, endereço etc.), então o lado dele também precisa atualizar.
  revalidarMontagem(id);
  redirect(
    `/admin/montagens/${id}?sucesso=${encodeURIComponent("Montagem atualizada.")}`
  );
}

async function podeGerenciar(montagemId: string) {
  // requireUsuario (e não getSession) porque o cookie sozinho não prova que
  // a pessoa ainda tem acesso: ele sobrevive à desativação/exclusão do
  // cadastro. Ver lib/auth.ts.
  const session = await requireUsuario();

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

// `novoStatusBruto` é `string` (e não a união dos status) de propósito: o
// valor chega de fora, e o tipo do parâmetro não é garantia nenhuma em
// tempo de execução. Quem garante é o schema abaixo.
export async function atualizarStatusAction(id: string, novoStatusBruto: string) {
  const { session } = await podeGerenciar(id);
  const caminho = caminhoDetalhe(session.role, id);

  const analise = StatusMontagemSchema.safeParse(novoStatusBruto);
  if (!analise.success) {
    redirect(`${caminho}?erro=${encodeURIComponent("Status inválido.")}`);
    return;
  }
  const novoStatus = analise.data;

  // Um montador só inicia (ou volta para pendente) a própria montagem.
  // Concluir exige foto e as duas assinaturas e passa por
  // concluirComProvaAction -- sem esta checagem, um "CONCLUIDO" enviado
  // direto para a ação fechava o serviço sem comprovante nenhum.
  if (
    session.role === "MONTADOR" &&
    !STATUS_PERMITIDOS_MONTADOR.includes(novoStatus)
  ) {
    redirect(
      `${caminho}?erro=${encodeURIComponent(
        "Para concluir a montagem, envie a foto do produto montado e as assinaturas."
      )}`
    );
    return;
  }

  await prisma.montagem.update({
    where: { id },
    data: {
      status: novoStatus,
      concluidoEm: novoStatus === "CONCLUIDO" ? new Date() : null,
    },
  });

  revalidarMontagem(id);
  redirect(caminho);
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

// Por que o envio não foi, em texto que dá para mostrar ao admin.
//
// Isto era um `boolean`, e toda causa possível -- chave que não existe no
// servidor, chave recusada do outro lado, função fria estourando o tempo,
// entrega que não existe mais lá -- virava a mesma frase "tente de novo em
// instantes" na tela. Quem estava com o celular na mão tentava de novo para
// sempre, e quem fosse investigar depois não tinha por onde começar: o
// status só aparecia num console.warn do servidor.
type ResultadoEnvioCentralSync = { ok: true } | { ok: false; motivo: string };

// Uma tentativa dá conta de um CentralSync já aquecido; o dobro disso é para
// a partida a frio. A Cloud Function de lá é chamada poucas vezes por dia,
// ou seja, quase sempre parte fria -- e partida fria + gravação passava dos
// 10s que ficavam aqui, o que chegava ao admin como falha sem motivo. O teto
// da página (maxDuration em app/admin/page.tsx e
// app/admin/montagens/[id]/page.tsx) cobre as duas tentativas com folga.
const TEMPO_LIMITE_CENTRALSYNC_MS = 12_000;

function motivoDaRecusaCentralSync(status: number) {
  if (status === 401 || status === 403) {
    return `O CentralSync recusou a chave de integração (erro ${status}). A chave daqui (MONTAFACIL_TO_CENTRALSYNC_KEY) precisa ser igual ao segredo MONTAFACIL_API_KEY cadastrado lá. Tentar de novo não resolve.`;
  }
  if (status === 404) {
    return "O CentralSync não achou essa entrega (erro 404). Confira se o pedido ainda existe lá com esse mesmo número.";
  }
  if (status === 413) {
    return "O comprovante ficou grande demais para o CentralSync aceitar (erro 413). Envie uma foto menor e recolha as assinaturas.";
  }
  if (status >= 500) {
    return `O CentralSync está com problema no servidor dele (erro ${status}). Tente de novo em alguns minutos.`;
  }
  return `O CentralSync recusou a confirmação (erro ${status}).`;
}

type TentativaCentralSync =
  | { ok: true }
  | { ok: false; motivo: string; repetir: boolean };

async function tentarAvisarCentralSync(
  corpo: string,
  chave: string
): Promise<TentativaCentralSync> {
  try {
    const resposta = await fetch(CENTRALSYNC_CONFIRMATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-montafacil-key": chave,
      },
      body: corpo,
      // Quem espera por esta chamada é o admin, na tela da montagem. Um
      // CentralSync fora do ar não pode deixar a tela travada.
      signal: AbortSignal.timeout(TEMPO_LIMITE_CENTRALSYNC_MS),
    });
    if (resposta.ok) return { ok: true };

    const detalhe = await resposta.text().catch(() => "");
    console.warn(
      "CentralSync recusou a confirmação de montagem:",
      resposta.status,
      detalhe.slice(0, 300)
    );
    return {
      ok: false,
      motivo: motivoDaRecusaCentralSync(resposta.status),
      // Só o que pode melhorar sozinho é repetido. Chave recusada e entrega
      // inexistente respondem igual na segunda vez -- repetir só faria o
      // admin esperar o dobro pela mesma resposta.
      repetir: resposta.status >= 500,
    };
  } catch (e) {
    const nome = (e as { name?: string })?.name;
    const expirou = nome === "TimeoutError" || nome === "AbortError";
    console.warn("Falha ao avisar o CentralSync sobre a montagem concluída:", e);
    return {
      ok: false,
      motivo: expirou
        ? `O CentralSync não respondeu em ${TEMPO_LIMITE_CENTRALSYNC_MS / 1000}s, nas duas tentativas. Ele pode estar lento ou fora do ar -- tente de novo em alguns minutos.`
        : "Não consegui alcançar o CentralSync (falha de rede entre os dois sistemas). Tente de novo em alguns minutos.",
      repetir: true,
    };
  }
}

// Chamado só pelo admin, pelo botão "Enviar ao CentralSync" (ver
// confirmarEnvioCentralSyncAction): o montador concluir aqui NÃO dispara
// nada sozinho. Do outro lado também nada é aplicado automaticamente: a
// confirmação entra na caixa "Montagens Feitas" da aba Entregas e um admin
// do CentralSync marca a entrega como montada depois de conferir foto e
// assinaturas.
type DadosEnvioCentralSync = {
  deliveryId: string;
  montadorNome: string | null;
  assemblerSignature: string;
  customerSignature: string;
  photo: string;
  reason?: string;
};

async function avisarCentralSync(
  dados: DadosEnvioCentralSync
): Promise<ResultadoEnvioCentralSync> {
  if (!CENTRALSYNC_SHARED_KEY) {
    console.warn("MONTAFACIL_TO_CENTRALSYNC_KEY não configurada -- não é possível avisar o CentralSync.");
    return {
      ok: false,
      motivo:
        "A chave de integração com o CentralSync não está configurada no servidor (MONTAFACIL_TO_CENTRALSYNC_KEY). Isso é configuração, não adianta insistir -- avise quem cuida do sistema.",
    };
  }

  // Campos vazios/indefinidos ficam de fora: o corpo carrega imagens em
  // base64 e não vale a pena engordá-lo com nulos que o outro lado
  // descartaria de qualquer jeito.
  const corpo = JSON.stringify(
    Object.fromEntries(
      Object.entries(dados).filter(([, valor]) => valor !== undefined && valor !== "")
    )
  );

  // Reenviar é seguro: do outro lado o aviso é gravado pelo id da entrega,
  // então a segunda tentativa sobrescreve a primeira em vez de duplicar
  // (mesma garantia que sustenta o botão "Reenviar ao CentralSync").
  let ultimoMotivo = "Não consegui avisar o CentralSync agora. Tente de novo em alguns minutos.";
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const resultado = await tentarAvisarCentralSync(corpo, CENTRALSYNC_SHARED_KEY);
    if (resultado.ok) return { ok: true };
    ultimoMotivo = resultado.motivo;
    if (!resultado.repetir) break;
  }
  return { ok: false, motivo: ultimoMotivo };
}

// Salva o comprovante da montagem (foto do produto montado + assinaturas) e
// marca como concluída. Usada pelos dois painéis:
//
// - Montador: é o fluxo normal do aplicativo, e exige a prova completa --
//   foto, a assinatura dele e a do cliente.
// - Admin: pode enviar ou trocar a foto de qualquer montagem. Isso não
//   existia em tela nenhuma, e por isso as montagens feitas pela própria
//   empresa (feitoPorAdm, sem montador designado) nunca conseguiam receber
//   a foto: o dono não tem painel de montador, e esta ação recusava quem
//   não fosse MONTADOR. Resultado: o botão "Enviar ao CentralSync" ficava
//   travado para sempre, reclamando de uma foto que não havia como anexar.
//   Para o admin as assinaturas são opcionais (em branco, mantém as que já
//   estiverem salvas) -- muitas vezes o que falta é só a foto.
export async function concluirComProvaAction(id: string, formData: FormData) {
  const { session, montagem } = await podeGerenciar(id);
  const caminho = caminhoDetalhe(session.role, id);

  const erro = (mensagem: string) =>
    redirect(`${caminho}?erro=${encodeURIComponent(mensagem)}`);

  const exigirAssinaturas = session.role === "MONTADOR";

  const fotosRaw = formData.getAll("fotos");
  const fotos = fotosRaw.filter((f): f is File => f instanceof File && f.size > 0);
  const temFotoNova = fotos.length > 0;

  const assinaturaMontador = String(formData.get("assinaturaMontador") || "").trim();
  const assinaturaCliente = String(formData.get("assinaturaCliente") || "").trim();

  if (!temFotoNova && !montagem.fotoProdutoUrl && montagem.fotosProdutoUrls.length === 0) {
    erro("Envie uma foto do produto montado antes de concluir.");
    return;
  }
  if (temFotoNova) {
    for (const foto of fotos) {
      if (!foto.type.startsWith("image/")) {
        erro("O arquivo da foto precisa ser uma imagem.");
        return;
      }
      if (foto.size > TAMANHO_MAXIMO_UPLOAD) {
        erro(
          `Uma foto é muito grande (máximo ${TAMANHO_MAXIMO_UPLOAD_TEXTO}). Tire outra pelo próprio celular, que o sistema reduz sozinho.`
        );
        return;
      }
    }
  }

  // Assinatura em branco só é aceita quando já existe uma salva (o admin
  // trocando só a foto, por exemplo). Nunca gravamos uma montagem concluída
  // sem prova nenhuma pelo lado do montador.
  if (!assinaturaMontador && !montagem.assinaturaMontador && exigirAssinaturas) {
    erro("Falta a sua assinatura.");
    return;
  }
  if (!assinaturaCliente && !montagem.assinaturaCliente && exigirAssinaturas) {
    erro("Falta a assinatura do cliente.");
    return;
  }
  if (assinaturaMontador && !assinaturaMontador.startsWith("data:image/")) {
    erro("Não consegui ler a assinatura de quem montou. Assine de novo.");
    return;
  }
  if (assinaturaCliente && !assinaturaCliente.startsWith("data:image/")) {
    erro("Não consegui ler a assinatura do cliente. Assine de novo.");
    return;
  }

  const fotoUrls: string[] = [];
  if (temFotoNova) {
    for (const foto of fotos) {
      const envio = await enviarArquivo(
        `montagens/${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${extensaoDe(foto)}`,
        foto
      );
      if (!envio.ok) {
        erro(envio.erro);
        return;
      }
      fotoUrls.push(envio.url);
    }
  }

  const jaEstavaConcluida = montagem.status === "CONCLUIDO";

  await prisma.montagem.update({
    where: { id },
    data: {
      status: "CONCLUIDO",
      concluidoEm: montagem.concluidoEm ?? new Date(),
      ...(fotoUrls.length > 0 ? {
        fotoProdutoUrl: fotoUrls[0], // fallback para o CentralSync
        fotosProdutoUrls: { push: fotoUrls }
      } : {}),
      ...(assinaturaMontador ? { assinaturaMontador } : {}),
      ...(assinaturaCliente ? { assinaturaCliente } : {}),
    },
  });

  // Foto trocada: não apagamos mais fotos antigas tão facilmente agora que são múltiplas,
  // mas como o admin pode substituir a principal (fotoProdutoUrl), deixamos quieto
  // para evitar apagar arquivos úteis.

  // Concluir aqui NÃO avisa o CentralSync. Quem monta é o funcionário, mas
  // quem responde pela empresa perante a loja é o admin: a montagem
  // concluída entra na fila "Prontas para enviar ao CentralSync" do painel
  // do admin (ver app/admin/page.tsx) e só sai de lá quando ele confere a
  // foto e as assinaturas e clica em enviar (confirmarEnvioCentralSyncAction).
  // Fora que o montador está na rua, muitas vezes com internet ruim --
  // esperar a Cloud Function do CentralSync responder só pra ele conseguir
  // fechar a montagem era risco sem contrapartida.
  revalidarMontagem(id);
  redirect(
    `${caminho}?sucesso=${encodeURIComponent(
      jaEstavaConcluida
        ? "Comprovante atualizado."
        : "Montagem concluída. Foto e assinaturas salvas."
    )}`
  );
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
  origemBruta: string,
  formData?: FormData
) {
  await requireAdmin();

  // Valor de fora: se não for um dos dois destinos previstos, cai no da
  // tela da montagem em vez de virar um redirecionamento arbitrário.
  const origem = OrigemEnvioSchema.safeParse(origemBruta).data ?? "montagem";

  const montagem = await prisma.montagem.findUnique({
    where: { id },
    include: {
      montador: { select: { nome: true } },
      // integraCentralSync é o que libera o envio das montagens lançadas à
      // mão (ver podeEnviarAoCentralSync em lib/centralsync.ts).
      loja: { select: { integraCentralSync: true } },
    },
  });
  if (!montagem) redirect("/admin/montagens");

  const voltarPara = origem === "painel" ? "/admin" : `/admin/montagens/${id}`;
  const comErro = (mensagem: string) =>
    redirect(`${voltarPara}?erro=${encodeURIComponent(mensagem)}`);

  if (!podeEnviarAoCentralSync(montagem)) {
    comErro(
      ehDesmontagemOuAssistencia(montagem.numeroPedido)
        ? "Desmontagem e assistência não viram confirmação de montagem no CentralSync — lá isso marcaria a entrega original como montada de novo. Acerte esse serviço direto com a loja."
        : "Esta montagem não é de uma loja ligada ao CentralSync, então não há o que enviar para lá. Se for, marque \"Loja atendida pelo CentralSync\" no cadastro dela em Lojas."
    );
    return;
  }
  if (montagem.status !== "CONCLUIDO") {
    comErro("Marque a montagem como concluída antes de enviar a confirmação ao CentralSync.");
    return;
  }

  const motivo = formData ? String(formData.get("motivoSemComprovante") || "").trim() : "";

  // A loja confere justamente a foto e as duas assinaturas. Mandar isso
  // vazio criava um aviso inútil do outro lado -- e marcava a montagem como
  // já enviada aqui, escondendo o problema.
  const faltando = [
    montagem.fotoProdutoUrl ? null : "a foto do produto montado",
    montagem.assinaturaMontador ? null : "a assinatura de quem montou",
    montagem.assinaturaCliente ? null : "a assinatura do cliente",
  ].filter((item): item is string => item !== null);

  if (faltando.length > 0 && !motivo) {
    comErro(
      `Falta ${faltando.join(", ")} para enviar ao CentralSync. Anexe-os ou informe um motivo na tela da montagem para enviar sem eles.`
    );
    return;
  }

  const envio = await avisarCentralSync({
    deliveryId: idDaEntregaNoCentralSync(montagem),
    montadorNome: nomeParaCentralSync(montagem),
    assemblerSignature: montagem.assinaturaMontador || "",
    customerSignature: montagem.assinaturaCliente || "",
    photo: montagem.fotoProdutoUrl || "",
    reason: motivo || undefined,
  });

  // A mensagem que sobe para a tela diz o que aconteceu de verdade (chave,
  // tempo esgotado, recusa do outro lado). A montagem continua na fila do
  // painel de qualquer jeito -- nada é marcado como enviado sem confirmação.
  if (!envio.ok) {
    comErro(envio.motivo);
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
  const session = await requireUsuario();

  const montagem = await prisma.montagem.findUnique({
    where: { id },
    include: { loja: true },
  });
  if (!montagem) return { ok: false, erro: "Montagem não encontrada." };
  if (session.role !== "MONTADOR" || montagem.montadorId !== session.sub) {
    return { ok: false, erro: "Você não tem acesso a esta montagem." };
  }

  const tipoAnalise = TipoOcorrenciaSchema.safeParse(String(formData.get("tipo") || ""));
  if (!tipoAnalise.success) {
    return { ok: false, erro: "Selecione o que aconteceu na visita." };
  }
  const tipo = tipoAnalise.data;
  const observacao = String(formData.get("observacao") || "").trim();

  let fotoUrl: string | undefined;
  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    if (!foto.type.startsWith("image/")) {
      return { ok: false, erro: "O arquivo da foto precisa ser uma imagem." };
    }
    if (foto.size > TAMANHO_MAXIMO_UPLOAD) {
      return {
        ok: false,
        erro: `A foto é muito grande (máximo ${TAMANHO_MAXIMO_UPLOAD_TEXTO}).`,
      };
    }
    const envio = await enviarArquivo(
      `ocorrencias/${id}-${Date.now()}.${extensaoDe(foto)}`,
      foto
    );
    if (!envio.ok) return { ok: false, erro: envio.erro };
    fotoUrl = envio.url;
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

// A inversão é feita no próprio UPDATE (`NOT "coluna"`), e não com
// ler-depois-escrever: dois cliques quase simultâneos liam o mesmo valor e
// gravavam o mesmo resultado, então um dos cliques simplesmente sumia. Como
// é SQL cru, `updatedAt` (que o Prisma preenche sozinho no update normal)
// precisa ser escrito à mão.
export async function alternarPagamentoLojaAction(id: string) {
  await requireAdmin();

  const linhas = await prisma.$executeRaw`
    UPDATE "Montagem"
       SET "pagoPelaLoja" = NOT "pagoPelaLoja", "updatedAt" = NOW()
     WHERE "id" = ${id}
  `;
  if (linhas === 0) redirect("/admin/montagens");

  revalidarMontagem(id);
  redirect(`/admin/montagens/${id}`);
}

export async function alternarPagamentoMontadorAction(id: string) {
  await requireAdmin();

  const linhas = await prisma.$executeRaw`
    UPDATE "Montagem"
       SET "pagoAoMontador" = NOT "pagoAoMontador", "updatedAt" = NOW()
     WHERE "id" = ${id}
  `;
  if (linhas === 0) redirect("/admin/montagens");

  // O pagamento afeta diretamente o que o montador vê no painel dele (o
  // valor "a receber" some da lista assim que marcado como pago).
  revalidarMontagem(id);
  redirect(`/admin/montagens/${id}`);
}

export async function excluirMontagemAction(id: string) {
  await requireAdmin();

  // Lê os arquivos antes de apagar a linha: depois do delete não há mais
  // como saber o que ficou órfão no Blob. As ocorrências somem por cascata
  // no banco, mas as fotos delas não.
  const arquivos = await prisma.montagem.findUnique({
    where: { id },
    select: {
      fotoProdutoUrl: true,
      manualUrl: true,
      ocorrencias: { select: { fotoUrl: true } },
    },
  });

  await prisma.montagem.delete({ where: { id } });

  if (arquivos) {
    await apagarArquivos([
      arquivos.fotoProdutoUrl,
      arquivos.manualUrl,
      ...arquivos.ocorrencias.map((o) => o.fotoUrl),
    ]);
  }

  revalidarMontagem(id);
  redirect(
    `/admin/montagens?sucesso=${encodeURIComponent("Montagem excluída.")}`
  );
}
