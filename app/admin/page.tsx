import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  confirmarEnvioCentralSyncAction,
  dispensarEnvioCentralSyncAction,
  dispensarFilaCentralSyncAction,
} from "@/lib/actions/montagens";
import { PREFIXO_PEDIDO_CENTRALSYNC, PREFIXOS_SERVICO_SEM_MONTAGEM } from "@/lib/centralsync";
import { emCentavos, valorDevidoPelaLoja } from "@/lib/financeiro";
import { formatarData, formatarDataHora, formatarMoeda, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import { intervaloDoMes, mesAtual } from "@/lib/datas";
import { obterUrlBase } from "@/lib/url";
import { Alerta, Badge, Button, Card, LinkButton, PageHeader, StatCard, Vazio } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { FormConfirmar } from "@/components/FormConfirmar";
import { AcoesCliente } from "@/components/AcoesCliente";
import { LinkAgendamento } from "@/components/LinkAgendamento";
import { nomeDaOrigem } from "@/lib/servico";

// Teto de tempo das Server Actions desta página (a plataforma lê isto do
// build). O envio ao CentralSync espera uma Cloud Function que quase sempre
// parte fria e tenta duas vezes (ver avisarCentralSync): com o teto padrão
// de 10s da Vercel, a função era cortada no meio e o admin recebia um erro
// da plataforma, sem a mensagem explicando o que houve. 60s é o máximo
// aceito em qualquer plano, e só é usado se a chamada realmente demorar.
export const maxDuration = 60;

// Quantas montagens da fila do CentralSync a tela lista de uma vez.
const LIMITE_FILA = 10;

// Teto da lista "Próximas montagens". Era 6, e o cartão "Pendentes" logo
// acima contava todas: com 11 em aberto a tela mostrava 6 e não dizia que
// havia mais -- as outras cinco simplesmente não existiam para quem olhava.
// O teto agora só existe para a página não virar um rolo sem fim, e quando
// ele corta a tela avisa (ver o rodapé da lista).
const LIMITE_PROXIMAS = 50;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { erro, sucesso } = await searchParams;

  // setHours() usaria o fuso do servidor (UTC na Vercel), começando o mês
  // às 21h do último dia do mês anterior no horário de Itabuna.
  const { inicio: inicioMes, fim: fimMes } = intervaloDoMes(mesAtual());

  // O mês do faturamento é o das montagens CONCLUÍDAS no mês. Antes o valor
  // era somado por `createdAt` enquanto a contagem ao lado ("X concluída(s)
  // no mês") já era por `concluidoEm` -- o mesmo cartão misturava duas
  // definições de mês, e nenhuma delas batia com o painel do montador.
  const concluidasNoMes = {
    status: "CONCLUIDO",
    concluidoEm: { gte: inicioMes, lt: fimMes },
  } as const;

  const [
    pendentes,
    emAndamento,
    naoAtribuidas,
    aReceberAgg,
    aReceberParticularAgg,
    aPagarAgg,
    faturamentoMesAgg,
    concluidasMes,
    montadoresAtivos,
    proximas,
    notasPendentesCount,
    solicitacoesCount,
    filaCentralSync,
  ] = await Promise.all([
    prisma.montagem.count({ where: { status: "PENDENTE" } }),
    prisma.montagem.count({ where: { status: "EM_ANDAMENTO" } }),
    prisma.montagem.count({
      where: { montadorId: null, status: { not: "CANCELADO" } },
    }),
    prisma.montagem.aggregate({
      _sum: { valorServico: true, valorAssistencia: true },
      where: { pagoPelaLoja: false, status: { not: "CANCELADO" }, lojaId: { not: null } },
    }),
    // Particular não tem acerto de 8%: o cliente deve a nota inteira. Somar
    // junto com as de loja e aplicar uma regra só devolvia 8% de um valor
    // que é 100% da empresa.
    prisma.montagem.aggregate({
      _sum: { valorServico: true },
      where: { pagoPelaLoja: false, status: { not: "CANCELADO" }, lojaId: null },
    }),
    prisma.montagem.aggregate({
      _sum: { valorMontador: true },
      where: { pagoAoMontador: false, status: "CONCLUIDO" },
    }),
    prisma.montagem.aggregate({
      _sum: { valorServico: true, valorAssistencia: true },
      where: concluidasNoMes,
    }),
    prisma.montagem.count({ where: concluidasNoMes }),
    prisma.user.count({ where: { role: "MONTADOR", ativo: true } }),
    prisma.montagem.findMany({
      where: {
        status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
      },
      orderBy: [{ dataAgendada: "asc" }, { createdAt: "desc" }],
      take: LIMITE_PROXIMAS,
      select: {
        id: true,
        clienteNome: true,
        // Endereço e telefone ficam na própria lista: é daqui que sai a
        // rota do dia, e abrir montagem por montagem só para ver para onde
        // ir (e para quem ligar) era o passo a mais de sempre.
        clienteEndereco: true,
        clienteTelefone: true,
        // O que vai ser montado e por quanto. Sem isso o cartão dizia só
        // para onde ir, e decidir a ordem do dia (ou ver se a montagem
        // compensa a viagem) exigia abrir uma por uma.
        descricaoServico: true,
        valorServico: true,
        dataAgendada: true,
        status: true,
        loja: { select: { nome: true } },
        montador: { select: { nome: true } },
      },
    }),
    prisma.notaPendente.count(),
    // Pedidos que os clientes mandaram pelo link público (/agendar) e que
    // ainda não viraram montagem nem foram recusados.
    prisma.solicitacaoAgendamento.count({
      where: { atendidaEm: null, recusadaEm: null },
    }),
    // Fila de montagens do CentralSync já concluídas aqui e ainda não
    // enviadas para a loja. As assinaturas ficam de fora do select de
    // propósito: são imagens em base64 (campos Text grandes) e aqui só
    // interessa se existem, não o conteúdo — quem responde isso é a
    // consulta `filaComAssinaturas` logo abaixo, que devolve só ids.
    prisma.montagem.findMany({
      where: {
        status: "CONCLUIDO",
        notificadoCentralSyncEm: null,
        // Removida da fila pelo próprio admin (botão "Remover da fila"):
        // continua na lista de montagens e com o botão de envio na tela
        // dela, só não ocupa mais espaço aqui. Ver
        // dispensarEnvioCentralSyncAction.
        dispensadoCentralSyncEm: null,
        // Precisa dizer o mesmo que podeEnviarAoCentralSync
        // (lib/centralsync.ts). Se a fila daqui e a checagem de lá
        // discordarem, a montagem some do painel mesmo com o botão da tela
        // dela funcionando -- ou aparece aqui e o clique volta com erro.
        OR: [
          // Pedido vindo da integração. "insensitive" porque o número fica
          // num campo que o admin pode reescrever.
          { numeroPedido: { startsWith: PREFIXO_PEDIDO_CENTRALSYNC, mode: "insensitive" } },
          // Desmontagem e assistência que a integração mandou, quando a loja
          // é a do CentralSync. Vão como avulsas e chegam lá rotuladas (ver
          // nomeParaCentralSync). Montagem lançada à mão fica de fora mesmo
          // nessa loja: é serviço particular e não volta para a Central
          // Móveis.
          ...PREFIXOS_SERVICO_SEM_MONTAGEM.map((prefixo) => ({
            numeroPedido: { startsWith: prefixo, mode: "insensitive" as const },
            loja: { integraCentralSync: true },
          })),
        ],
      },
      orderBy: { concluidoEm: "asc" },
      // 11 para saber que passou de 10 sem gastar um count() a mais.
      take: LIMITE_FILA + 1,
      select: {
        id: true,
        clienteNome: true,
        numeroPedido: true,
        concluidoEm: true,
        fotoProdutoUrl: true,
        feitoPorAdm: true,
        montador: { select: { nome: true } },
        loja: { select: { nome: true } },
      },
    }),
  ]);

  const totalEmAberto = pendentes + emAndamento;

  const filaVisivel = filaCentralSync.slice(0, LIMITE_FILA);
  const temMaisNaFila = filaCentralSync.length > LIMITE_FILA;

  // Quais dessas montagens têm as duas assinaturas.
  //
  // A tela liberava o botão "Enviar ao CentralSync" só de existir a foto,
  // mas a ação também exige as duas assinaturas -- então uma montagem
  // concluída pelo painel (sem passar pelo app do montador) mostrava o
  // botão, e o clique voltava com erro. Aqui a pergunta é respondida sem
  // carregar as imagens: a consulta filtra por "não nulo" e devolve só ids.
  const idsDaFila = filaVisivel.map((m) => m.id);
  const filaComAssinaturas = idsDaFila.length
    ? await prisma.montagem.findMany({
        where: {
          id: { in: idsDaFila },
          assinaturaMontador: { not: null },
          assinaturaCliente: { not: null },
        },
        select: { id: true },
      })
    : [];
  const temAssinaturas = new Set(filaComAssinaturas.map((m) => m.id));

  const aReceberDasLojas = emCentavos(
    valorDevidoPelaLoja({
      valorServico: aReceberAgg._sum.valorServico || 0,
      valorAssistencia: aReceberAgg._sum.valorAssistencia || 0,
    }) + (aReceberParticularAgg._sum.valorServico || 0)
  );

  return (
    <div>
      <PageHeader
        titulo="Painel geral"
        descricao="Visão rápida das montagens e das finanças da sua empresa."
        acoes={
          <>
            <LinkButton href="/admin/rota" variante="secundario">
              🗺️ Rota do dia
            </LinkButton>
            <LinkButton href="/admin/montagens/nova">+ Nova montagem</LinkButton>
          </>
        }
      />

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {sucesso ? <Alerta tipo="sucesso">{sucesso}</Alerta> : null}

      {notasPendentesCount > 0 ? (
        <Link href="/admin/montagens/nova" className="mb-6 block">
          <Card className="border-gold/40 bg-gold/5 transition-shadow hover:shadow-md">
            <p className="font-semibold text-slate-900">
              📥 {notasPendentesCount} pedido{notasPendentesCount > 1 ? "s" : ""} pendente
              {notasPendentesCount > 1 ? "s" : ""} do CentralSync
            </p>
            <p className="text-sm text-slate-500">
              Aguardando revisão para virar montagem. Toque para abrir.
            </p>
          </Card>
        </Link>
      ) : null}

      {solicitacoesCount > 0 ? (
        <Link href="/admin/montagens/nova" className="mb-6 block">
          <Card className="border-emerald-200 bg-emerald-50/50 transition-shadow hover:shadow-md">
            <p className="font-semibold text-slate-900">
              📅 {solicitacoesCount} pedido{solicitacoesCount > 1 ? "s" : ""} de
              agendamento do site
            </p>
            <p className="text-sm text-slate-500">
              O cliente preencheu os dados pelo link público. Confira e
              transforme em montagem.
            </p>
          </Card>
        </Link>
      ) : null}

      {filaVisivel.length > 0 ? (
        <Card className="mb-6 border-blue-200 bg-blue-50/40">
          <p className="font-semibold text-slate-900">
            {/* "montagem" + "ns" saía "montagemns" na tela quando havia mais
                de uma -- o plural troca a palavra inteira. */}
            📤 {temMaisNaFila ? `Mais de ${LIMITE_FILA}` : filaVisivel.length}{" "}
            {filaVisivel.length > 1 ? "montagens prontas" : "montagem pronta"} para
            enviar ao CentralSync
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Quem montou já concluiu aqui. Confira o comprovante e envie para a
            loja — só depois disso a montagem aparece lá para eles darem baixa.
          </p>

          <div className="mt-4 space-y-3">
            {filaVisivel.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {m.fotoProdutoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob externo (Vercel Blob), sem next/image configurado para esse domínio
                    <img
                      src={m.fotoProdutoUrl}
                      alt="Foto do produto montado"
                      className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-amber-300 bg-amber-50 text-lg">
                      ⚠️
                    </span>
                  )}
                  <div className="min-w-0">
                    <Link
                      href={`/admin/montagens/${m.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {m.clienteNome}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {m.feitoPorAdm
                        ? "Montado pela própria empresa"
                        : m.montador
                          ? `Montado por ${m.montador.nome}`
                          : "Sem montador designado"}
                      {m.concluidoEm ? ` · ${formatarDataHora(m.concluidoEm)}` : ""}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {m.numeroPedido
                        ? `Entrega ${m.numeroPedido}`
                        : `Lançada à mão · ${nomeDaOrigem(m.loja)}`}
                    </p>
                    {m.fotoProdutoUrl && temAssinaturas.has(m.id) ? null : (
                      <p className="text-xs font-medium text-amber-700">
                        {!m.fotoProdutoUrl && !temAssinaturas.has(m.id)
                          ? "Sem a foto e sem as assinaturas"
                          : !m.fotoProdutoUrl
                            ? "Sem foto do produto montado"
                            : "Sem as assinaturas"}{" "}
                        — abra a montagem para anexar antes de enviar.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {m.fotoProdutoUrl && temAssinaturas.has(m.id) ? (
                    <form action={confirmarEnvioCentralSyncAction.bind(null, m.id, "painel")}>
                      <SubmitButton className="px-3 py-2 text-sm" pendingText="Enviando…">
                        Enviar ao CentralSync
                      </SubmitButton>
                    </form>
                  ) : (
                    <LinkButton
                      href={`/admin/montagens/${m.id}`}
                      variante="secundario"
                      className="px-3 py-2 text-sm"
                    >
                      Abrir montagem
                    </LinkButton>
                  )}
                  {/* Saída da fila que não passa pela loja: montagem antiga,
                      teste, serviço acertado por fora. Só marca uma data --
                      ver dispensarEnvioCentralSyncAction. */}
                  <FormConfirmar
                    action={dispensarEnvioCentralSyncAction.bind(null, m.id, "painel")}
                    mensagem={`Tirar a montagem de ${m.clienteNome} desta fila, sem enviar nada para a loja? Nada é apagado: ela continua na lista de montagens, e a tela dela mantém o botão de enviar ao CentralSync — é de lá que dá para devolvê-la à fila.`}
                  >
                    <Button type="submit" variante="fantasma" className="px-3 py-2 text-sm">
                      Remover da fila
                    </Button>
                  </FormConfirmar>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <p className="text-sm text-slate-500">
              {temMaisNaFila
                ? "Há mais montagens esperando envio. Envie ou remova estas e recarregue a página para ver as próximas."
                : "Remover não avisa a loja e não apaga nada: só tira a montagem desta caixa."}
            </p>
            {/* Limpar a fila de uma vez. Os ids vão fixados com .bind, então
                a ação mexe só nestas montagens -- uma conclusão que chegar
                depois desta página carregar não é varrida junto. */}
            {filaVisivel.length > 1 ? (
              <FormConfirmar
                action={dispensarFilaCentralSyncAction.bind(null, idsDaFila)}
                mensagem={`Tirar desta fila as ${filaVisivel.length} montagens listadas, sem enviar nada para as lojas? Nada é apagado: todas continuam na lista de montagens, cada uma com o seu botão de envio.`}
              >
                <Button type="submit" variante="fantasma" className="px-3 py-2 text-sm">
                  Remover as {filaVisivel.length} da lista
                </Button>
              </FormConfirmar>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
        <StatCard titulo="Pendentes" valor={String(pendentes)} cor="text-amber-600" icone="⏳" />
        <StatCard titulo="Em andamento" valor={String(emAndamento)} cor="text-blue-600" icone="🔧" />
        <StatCard
          titulo="Sem montador"
          valor={String(naoAtribuidas)}
          cor="text-red-600"
          icone="❓"
        />
        <StatCard
          titulo="A receber (lojas e clientes)"
          valor={formatarMoeda(aReceberDasLojas)}
          sub="Loja: 8% + assistência · Particular: valor cheio"
          icone="🏬"
        />
        <StatCard
          titulo="A pagar aos montadores"
          valor={formatarMoeda(aPagarAgg._sum.valorMontador)}
          icone="👷"
        />
        <StatCard
          titulo="Faturamento do mês"
          valor={formatarMoeda(faturamentoMesAgg._sum.valorServico)}
          sub={`${concluidasMes} concluída(s) no mês · ${montadoresAtivos} montador(es) ativo(s)`}
          cor="text-emerald-600"
          icone="📈"
        />
      </div>

      <div className="mt-6">
        <LinkAgendamento url={`${await obterUrlBase()}/agendar`} />
      </div>

      <div className="mt-8">
        {/* A contagem vem dos mesmos cartões Pendentes + Em andamento lá de
            cima (o filtro da lista é exatamente esse), então o número do
            título e o dos cartões nunca discordam. */}
        <PageHeader
          titulo={`Próximas montagens (${totalEmAberto})`}
          descricao="Pendentes e em andamento, da data mais próxima para a mais distante."
        />
        {proximas.length === 0 ? (
          <Vazio>Nenhuma montagem pendente ou em andamento no momento.</Vazio>
        ) : (
          <div className="space-y-3">
            {/* O cartão inteiro não é mais um link: dentro dele agora há
                links próprios (Waze, ligar, WhatsApp), e âncora dentro de
                âncora não é HTML válido -- no celular o toque caía no link
                de fora e abria a montagem em vez de navegar. Quem abre a
                montagem é o nome do cliente, e o "Abrir montagem" no fim
                da linha de atalhos. */}
            {proximas.map((m) => (
              <Card key={m.id} className="transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/montagens/${m.id}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {m.clienteNome}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {nomeDaOrigem(m.loja)} · {m.montador ? m.montador.nome : "Sem montador"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {m.dataAgendada ? `Agendado para ${formatarData(m.dataAgendada)}` : "Sem data definida"}
                    </p>
                  </div>
                  <Badge className={STATUS_COLOR[m.status]}>
                    {STATUS_LABEL[m.status]}
                  </Badge>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Produto / serviço
                    </p>
                    <p className="text-sm font-semibold text-emerald-700">
                      {formatarMoeda(m.valorServico)}
                    </p>
                  </div>
                  {/* A descrição vem da nota (os produtos separados por ";")
                      ou digitada à mão, e pode ter mais de uma linha. */}
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-800">
                    {m.descricaoServico}
                  </p>
                </div>

                <p className="mt-3 text-sm text-slate-900">{m.clienteEndereco}</p>

                <AcoesCliente
                  endereco={m.clienteEndereco}
                  telefone={m.clienteTelefone}
                  className="mt-3"
                >
                  <Link
                    href={`/admin/montagens/${m.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-navy hover:underline"
                  >
                    🔧 Abrir montagem
                  </Link>
                </AcoesCliente>
              </Card>
            ))}
            {proximas.length < totalEmAberto ? (
              <p className="text-sm text-slate-500">
                Mostrando as {proximas.length} mais próximas de {totalEmAberto} em aberto.{" "}
                <Link href="/admin/montagens" className="font-medium text-navy hover:underline">
                  Ver todas em Montagens
                </Link>
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
