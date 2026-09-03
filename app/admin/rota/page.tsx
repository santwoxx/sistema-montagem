import Form from "next/form";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Vazio } from "@/components/ui";
import { AcoesCliente } from "@/components/AcoesCliente";
import {
  dividirEmTrechos,
  linkEmbedRota,
  linkRotaGoogleMaps,
  MAX_PARADAS_POR_TRECHO,
} from "@/lib/mapas";
import {
  formatarData,
  formatarMoeda,
  linkWhatsapp,
  paraInputDate,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/format";
import { intervaloDoDia } from "@/lib/datas";
import type { Prisma } from "@prisma/client";

// O dia agendado é gravado como meio-dia no fuso do negócio (ver paraData em
// lib/actions/montagens.ts), e intervaloDoDia vai da meia-noite à meia-noite
// seguinte nesse mesmo fuso -- então as montagens do dia caem dentro do
// intervalo independentemente do fuso em que o servidor esteja rodando.

export default async function RotaPage({
  searchParams,
}: {
  searchParams: Promise<{
    data?: string;
    montadorId?: string;
    origem?: string;
    semData?: string;
  }>;
}) {
  const params = await searchParams;

  const hoje = paraInputDate(new Date());
  const data = params.data || hoje;
  const montadorId = params.montadorId ?? "";
  const origem = (params.origem ?? "").trim();
  const incluirSemData = params.semData === "1";

  const intervalo = intervaloDoDia(data) ?? intervaloDoDia(hoje)!;

  const where: Prisma.MontagemWhereInput = {
    status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
    ...(incluirSemData
      ? {
          OR: [
            { dataAgendada: { gte: intervalo.inicio, lt: intervalo.fim } },
            { dataAgendada: null },
          ],
        }
      : { dataAgendada: { gte: intervalo.inicio, lt: intervalo.fim } }),
  };
  if (montadorId) where.montadorId = montadorId === "nenhum" ? null : montadorId;

  const [montadores, paradas] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MONTADOR", ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, telefone: true },
    }),
    prisma.montagem.findMany({
      where,
      // Mesma ordem em que as paradas entram na rota: quem tem hora marcada
      // primeiro, depois as demais pela ordem de cadastro.
      orderBy: [{ dataAgendada: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        clienteNome: true,
        clienteTelefone: true,
        clienteEndereco: true,
        descricaoServico: true,
        valorServico: true,
        dataAgendada: true,
        status: true,
        feitoPorAdm: true,
        loja: { select: { nome: true } },
        montador: { select: { nome: true } },
      },
    }),
  ]);

  const trechos = dividirEmTrechos(
    paradas.map((m) => m.clienteEndereco),
    origem
  );
  const chaveMaps = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Só faz sentido mandar a rota por WhatsApp quando ela é de uma pessoa só
  // — uma lista com as paradas de todo mundo não ajuda ninguém.
  const montadorFiltrado =
    montadorId && montadorId !== "nenhum"
      ? montadores.find((m) => m.id === montadorId)
      : undefined;

  const mensagemRota = [
    `🗺️ *Rota de ${formatarData(intervalo.inicio)}*`,
    "",
    ...paradas.map((m, i) =>
      [
        `${i + 1}. ${m.clienteNome}`,
        `   ${m.clienteEndereco}`,
        m.clienteTelefone ? `   📞 ${m.clienteTelefone}` : null,
        `   🔧 ${m.descricaoServico}`,
      ]
        .filter(Boolean)
        .join("\n")
    ),
    "",
    trechos.length > 0 ? `Abrir no mapa: ${linkRotaGoogleMaps(trechos[0])}` : "",
  ].join("\n");

  return (
    <div>
      <PageHeader
        titulo="Rota do dia"
        descricao="Endereços dos clientes na ordem da agenda, prontos para abrir no Google Maps."
      />

      <Card className="mb-6">
        <Form action="/admin/rota" className="grid gap-3 sm:grid-cols-2">
          <Field label="Dia">
            <Input type="date" name="data" defaultValue={data} />
          </Field>
          <Field label="Montador">
            <Select name="montadorId" defaultValue={montadorId}>
              <option value="">Todos os montadores</option>
              <option value="nenhum">Sem montador</option>
              {montadores.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Ponto de partida (opcional)"
              hint="De onde a equipe sai — a loja, o depósito ou sua casa. Em branco, o Google usa a localização atual do aparelho."
            >
              <Input
                name="origem"
                defaultValue={origem}
                placeholder="Ex: Av. do Cinquentenário, 812, Itabuna - BA"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              name="semData"
              value="1"
              defaultChecked={incluirSemData}
              className="h-4 w-4 rounded border-slate-300"
            />
            Incluir também as montagens sem data agendada
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Montar rota</Button>
            <Link href="/admin/rota" className="ml-3 text-sm text-slate-500 hover:underline">
              Limpar
            </Link>
          </div>
        </Form>
      </Card>

      {paradas.length === 0 ? (
        <Vazio>
          Nenhuma montagem pendente para {formatarData(intervalo.inicio)} com esses
          filtros.
        </Vazio>
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {paradas.length} parada{paradas.length > 1 ? "s" : ""} em{" "}
                  {formatarData(intervalo.inicio)}
                </p>
                <p className="text-sm text-slate-500">
                  {trechos.length > 1
                    ? `O Google Maps aceita até ${MAX_PARADAS_POR_TRECHO} paradas por rota, então a lista foi dividida em ${trechos.length} trechos — cada um começa onde o anterior terminou.`
                    : "Abra a rota completa no Google Maps e siga na ordem da lista abaixo."}
                </p>
              </div>
              {montadorFiltrado?.telefone ? (
                <a
                  href={linkWhatsapp(montadorFiltrado.telefone, mensagemRota)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline"
                >
                  💬 Mandar a rota para {montadorFiltrado.nome.split(" ")[0]}
                </a>
              ) : null}
            </div>

            <div className="mt-4 space-y-4">
              {trechos.map((trecho, i) => {
                const embed = linkEmbedRota(trecho, chaveMaps);
                return (
                  <div key={i}>
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={linkRotaGoogleMaps(trecho)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-medium text-navy transition-colors hover:bg-gold-hover"
                      >
                        📍 Abrir {trechos.length > 1 ? `trecho ${i + 1}` : "rota"} no Google Maps
                      </a>
                      {trechos.length > 1 ? (
                        <span className="text-xs text-slate-500">
                          paradas {i * MAX_PARADAS_POR_TRECHO + 1} a{" "}
                          {i * MAX_PARADAS_POR_TRECHO + trecho.paradas.length}
                        </span>
                      ) : null}
                    </div>
                    {embed ? (
                      <iframe
                        title={`Mapa da rota${trechos.length > 1 ? ` — trecho ${i + 1}` : ""}`}
                        src={embed}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                        className="mt-3 aspect-video w-full rounded-xl border border-slate-200"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {!chaveMaps ? (
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                Dica: cadastrando a variável NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, o
                mapa com a rota desenhada aparece aqui dentro da tela. Sem ela,
                os botões acima continuam abrindo a rota no Google Maps
                normalmente.
              </p>
            ) : null}
          </Card>

          <div className="space-y-3">
            {paradas.map((m, i) => (
              <Card key={m.id}>
                <div className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/admin/montagens/${m.id}`}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          {m.clienteNome}
                        </Link>
                        <p className="text-sm text-slate-500">
                          {m.loja.nome} ·{" "}
                          {m.feitoPorAdm
                            ? "A própria empresa (ADM)"
                            : m.montador
                              ? m.montador.nome
                              : "Sem montador"}
                        </p>
                      </div>
                      <Badge className={STATUS_COLOR[m.status]}>
                        {STATUS_LABEL[m.status]}
                      </Badge>
                    </div>

                    <p className="mt-2 text-sm text-slate-900">{m.clienteEndereco}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {m.descricaoServico} · {formatarMoeda(m.valorServico)}
                      {m.dataAgendada ? "" : " · sem data agendada"}
                    </p>

                    <AcoesCliente
                      endereco={m.clienteEndereco}
                      telefone={m.clienteTelefone}
                      className="mt-3"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
