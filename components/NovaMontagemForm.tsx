"use client";

import { useMemo, useState } from "react";
import { Card, Field, Input, Select, StatCard, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ImportarNotaCard } from "@/components/ImportarNotaCard";
import { NotasPendentesCard, type NotaPendenteResumo } from "@/components/NotasPendentesCard";
import { resolverOuCriarLojaAction, type ResultadoResolucaoLoja } from "@/lib/actions/importar";
import { pareceIdDoCentralSync } from "@/lib/centralsync";
import { formatarMoeda, paraInputDate, paraNumeroBr } from "@/lib/format";
import { comprimirImagem, trocarArquivoDoInput } from "@/lib/imagem";

// Mesmo teto do servidor (lib/upload.ts): acima disso o Next recusa o envio
// inteiro, então é melhor avisar aqui, com o arquivo ainda na tela.
const TAMANHO_MAXIMO_MANUAL = 3 * 1024 * 1024;

// Comissão combinada à parte com o CentralSync — sempre 8% de montagem e 2%
// de assistência nos pedidos vindos de lá, independente do que a loja ou a
// tabela de comissão por montador (ComissaoLoja/comissaoPadrao) diriam.
//
// Estes dois números são metade de um acerto que vive nos dois sistemas: o
// CentralSync calcula a despesa de montagem dele com os mesmos 8% + 2%
// (DARIO_COMMISSION_PERCENT / DARIO_ASSISTANCE_PERCENT em
// config/darioMontador.ts). Estava 1% aqui e 2% lá, então o que a Central
// Móveis era cobrada nunca batia com o relatório dela. Mexer em um lado sem
// o outro traz a divergência de volta.
//
// A base já vem certa de lá: o CentralSync manda em `valorServico` só o
// valor dos itens que o cliente comprou COM montagem (sem frete e sem a taxa
// de montagem que a loja cobrou), não o total da nota -- o total vai nas
// observações da nota pendente, para conferência.
const COMISSAO_MONTADOR_CENTRALSYNC = "8";
const COMISSAO_ASSISTENCIA_CENTRALSYNC = "2";

type Loja = { id: string; nome: string; percentualAssistencia?: number };
type Montador = { id: string; nome: string; comissaoPadrao?: number };
type Comissao = { montadorId: string; lojaId: string; percentual: number };

export function NovaMontagemForm({
  action,
  lojas,
  montadores,
  comissoes,
  notasPendentes,
  valoresIniciais,
  modoEdicao,
}: {
  action: (formData: FormData) => void;
  lojas: Loja[];
  montadores: Montador[];
  comissoes: Comissao[];
  notasPendentes?: NotaPendenteResumo[];
  valoresIniciais?: {
    lojaId?: string;
    montadorId?: string;
    clienteNome?: string;
    clienteTelefone?: string;
    clienteEndereco?: string;
    numeroPedido?: string;
    descricaoServico?: string;
    valorServico?: string;
    percentualAssistencia?: string;
    percentualMontador?: string;
    dataAgendada?: string;
    observacoes?: string;
    status?: string;
    manualUrl?: string;
    manualNomeArquivo?: string;
    notaUrl?: string;
  };
  modoEdicao?: boolean;
}) {
  const [lojasDisponiveis, setLojasDisponiveis] = useState(lojas);
  const [lojaId, setLojaId] = useState(valoresIniciais?.lojaId ?? "");
  const [montadorId, setMontadorId] = useState(valoresIniciais?.montadorId ?? "");
  const [valorServico, setValorServico] = useState(valoresIniciais?.valorServico ?? "");
  const [percentual, setPercentual] = useState(valoresIniciais?.percentualMontador ?? "0");
  const [percentualEditado, setPercentualEditado] = useState(false);
  const [percentualAssistencia, setPercentualAssistencia] = useState(
    valoresIniciais?.percentualAssistencia ?? "0"
  );
  const [percentualAssistenciaEditado, setPercentualAssistenciaEditado] = useState(false);

  const [clienteNome, setClienteNome] = useState(valoresIniciais?.clienteNome ?? "");
  const [clienteTelefone, setClienteTelefone] = useState(valoresIniciais?.clienteTelefone ?? "");
  const [clienteEndereco, setClienteEndereco] = useState(valoresIniciais?.clienteEndereco ?? "");
  const [numeroPedido, setNumeroPedido] = useState(valoresIniciais?.numeroPedido ?? "");
  const [descricaoServico, setDescricaoServico] = useState(
    valoresIniciais?.descricaoServico ?? ""
  );
  const [dataAgendada, setDataAgendada] = useState(valoresIniciais?.dataAgendada ?? "");
  const [observacoes, setObservacoes] = useState(valoresIniciais?.observacoes ?? "");
  const [notaUrl, setNotaUrl] = useState(valoresIniciais?.notaUrl ?? "");
  const [notaPendenteId, setNotaPendenteId] = useState("");
  // O "Nº do pedido" é um campo de texto comum na tela, mas quando vale
  // "del-…" ele é a chave que liga esta montagem à entrega no CentralSync:
  // trocá-lo pelo número do pedido da loja (que é o que o rótulo e o exemplo
  // sugerem) apaga a integração em silêncio -- a montagem some da fila de
  // envio do painel e o botão da tela dela deixa de existir. Por isso ele
  // nasce travado nesse caso, com um jeito explícito de destravar para quem
  // realmente precisar corrigir o número.
  const [numeroDestravado, setNumeroDestravado] = useState(false);
  const [manualPreparando, setManualPreparando] = useState(false);
  const [manualAviso, setManualAviso] = useState<string | null>(null);

  async function aoEscolherManual(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const arquivo = input.files?.[0];
    setManualAviso(null);
    if (!arquivo) return;

    // Foto de manual costuma ter texto miúdo, então reduz menos que as
    // fotos de comprovante — o montador precisa conseguir ler.
    if (arquivo.type.startsWith("image/")) {
      setManualPreparando(true);
      try {
        const menor = await comprimirImagem(arquivo, { ladoMaximo: 2200, qualidade: 0.85 });
        if (menor !== arquivo) trocarArquivoDoInput(input, menor);
      } finally {
        setManualPreparando(false);
      }
    }

    const final = input.files?.[0];
    if (final && final.size > TAMANHO_MAXIMO_MANUAL) {
      setManualAviso(
        "Este arquivo passa de 3 MB e não vai subir. Envie um PDF menor (ou uma foto das páginas que interessam)."
      );
    }
  }

  // Compartilhado entre a importação por OCR/XML e as notas pendentes do
  // CentralSync: seleciona a loja resolvida/recém-cadastrada e garante que
  // ela apareça na lista mesmo que tenha acabado de ser criada agora.
  function aplicarLojaResolvida(loja: ResultadoResolucaoLoja) {
    setLojaId(loja.lojaId);
    setLojasDisponiveis((atual) =>
      atual.some((l) => l.id === loja.lojaId) ? atual : [...atual, { id: loja.lojaId, nome: loja.nome }]
    );
  }

  async function usarNotaPendente(nota: NotaPendenteResumo) {
    setClienteNome(nota.clienteNome);
    setClienteTelefone(nota.clienteTelefone ?? "");
    setClienteEndereco(nota.clienteEndereco);
    setNumeroPedido(nota.numeroPedido ?? "");
    setDescricaoServico(nota.descricaoServico);
    setObservacoes(nota.observacoes ?? "");
    if (nota.notaUrl) setNotaUrl(nota.notaUrl);
    setDataAgendada(paraInputDate(nota.dataAgendada));
    if (nota.valorServico) {
      setValorServico(nota.valorServico.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    }
    setNotaPendenteId(nota.id);

    // Resolve a loja ANTES de calcular a comissão do montador — senão a
    // comissão é calculada com lojaId ainda vazio/antigo, ignora a tabela
    // de comissão por loja (ComissaoLoja) e cai sempre no comissaoPadrao
    // genérico do montador, mesmo quando existe uma taxa específica para
    // essa loja.
    let lojaResolvidaId = lojaId;
    if (nota.lojaNomeSugerida) {
      try {
        const loja = await resolverOuCriarLojaAction(
          nota.lojaNomeSugerida,
          nota.lojaCnpjSugerido ?? undefined
        );
        if (loja) {
          aplicarLojaResolvida(loja);
          lojaResolvidaId = loja.lojaId;
        }
      } catch (e) {
        console.error("Falha ao resolver/cadastrar loja da nota pendente:", e);
        // Não trava o preenchimento: os outros campos já foram aplicados,
        // o admin pode escolher a loja manualmente na lista.
      }
    }

    // Assistência depende só da loja (não do montador), então é aplicada
    // aqui direto, independente de a nota ter um montador sugerido ou não.
    aplicarPercentualAssistencia(lojaResolvidaId);

    if (nota.montadorSugeridoId) {
      selecionarLojaOuMontador(lojaResolvidaId, nota.montadorSugeridoId);
    }

    // Pedido do CentralSync: sobrepõe o que veio da loja/tabela de comissão
    // acima com a taxa fixa combinada (8% montagem + 2% assistência), a não
    // ser que o admin já tenha ajustado esses campos manualmente antes de
    // usar a nota.
    if (pareceIdDoCentralSync(nota.numeroPedido)) {
      if (!percentualEditado) setPercentual(COMISSAO_MONTADOR_CENTRALSYNC);
      if (!percentualAssistenciaEditado) setPercentualAssistencia(COMISSAO_ASSISTENCIA_CENTRALSYNC);
    }
  }

  // Todo pedido tem assistência, não só comissão do montador — esse
  // percentual é fixo por loja (Loja.percentualAssistencia), não varia por
  // montador, e é sempre recalculado no servidor a partir do valor do
  // serviço (ver criarMontagemAction/atualizarMontagemAction).
  function aplicarPercentualAssistencia(novoLojaId: string) {
    if (percentualAssistenciaEditado) return;
    const loja = lojasDisponiveis.find((l) => l.id === novoLojaId);
    setPercentualAssistencia(String(loja?.percentualAssistencia ?? 0));
  }

  function selecionarLojaOuMontador(novoLojaId: string, novoMontadorId: string) {
    setLojaId(novoLojaId);
    setMontadorId(novoMontadorId);
    aplicarPercentualAssistencia(novoLojaId);
    if (!percentualEditado && novoMontadorId) {
      if (novoMontadorId === "ADM") {
        setPercentual("0");
        return;
      }
      const encontrado = comissoes.find(
        (c) => c.lojaId === novoLojaId && c.montadorId === novoMontadorId
      );
      const montador = montadores.find((m) => m.id === novoMontadorId);
      const comissao = encontrado ? encontrado.percentual : (montador?.comissaoPadrao ?? 0);
      setPercentual(String(comissao));
    }
  }

  // readOnly (e não disabled): campo desabilitado não vai no FormData, e a
  // ação grava `numeroPedido: numeroPedido || null` -- ou seja, travar com
  // disabled apagaria justamente o número que se quer proteger.
  const numeroTravado = pareceIdDoCentralSync(numeroPedido) && !numeroDestravado;

  const valorServicoCalculado = useMemo(() => {
    return paraNumeroBr(valorServico) || 0;
  }, [valorServico]);

  const valorMontadorCalculado = useMemo(() => {
    const p = paraNumeroBr(percentual) || 0;
    return (valorServicoCalculado * p) / 100;
  }, [valorServicoCalculado, percentual]);

  const valorAssistenciaCalculado = useMemo(() => {
    const p = paraNumeroBr(percentualAssistencia) || 0;
    return (valorServicoCalculado * p) / 100;
  }, [valorServicoCalculado, percentualAssistencia]);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Não deixa enviar enquanto a imagem do manual ainda está sendo
        // reduzida (subiria a original e estouraria o limite da action).
        if (manualPreparando) e.preventDefault();
      }}
      className="space-y-6"
    >
      <input type="hidden" name="notaPendenteId" value={notaPendenteId} />
      <input type="hidden" name="notaUrl" value={notaUrl} />

      {!modoEdicao && notasPendentes && notasPendentes.length > 0 ? (
        <NotasPendentesCard notas={notasPendentes} onUsar={usarNotaPendente} />
      ) : null}

      {!modoEdicao ? (
        <Card className="bg-slate-50">
          <h2 className="mb-1 text-base font-semibold text-slate-900">
            Importar nota (opcional)
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Envie o XML da nota fiscal eletrônica, ou uma foto/imagem da nota
            impressa (DANFE), para preencher o formulário automaticamente. Se
            a loja da nota ainda não estiver cadastrada, o sistema cadastra
            ela sozinho. Depois é só completar o que faltar e conferir os
            dados antes de salvar.
          </p>
          <ImportarNotaCard
            onDados={(resultado) => {
              if (resultado.clienteNome) setClienteNome(resultado.clienteNome);
              if (resultado.clienteTelefone) setClienteTelefone(resultado.clienteTelefone);
              if (resultado.clienteEndereco) setClienteEndereco(resultado.clienteEndereco);
              if (resultado.numeroPedido) setNumeroPedido(resultado.numeroPedido);
              if (resultado.descricaoServico) setDescricaoServico(resultado.descricaoServico);
              if (resultado.valorServico) setValorServico(resultado.valorServico);
              if (resultado.notaUrl) setNotaUrl(resultado.notaUrl);
            }}
            onLojaResolvida={aplicarLojaResolvida}
          />
        </Card>
      ) : null}
      
      {notaUrl ? (
        <Card className="bg-sky-50 border-sky-100">
          <p className="text-sm font-medium text-sky-900">
            ✅ Foto da nota anexada
          </p>
          <a
            href={notaUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex text-sm text-sky-700 hover:underline"
          >
            Visualizar arquivo importado
          </a>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Loja e montador
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loja">
            <Select
              name="lojaId"
              required
              value={lojaId}
              onChange={(e) => selecionarLojaOuMontador(e.target.value, montadorId)}
            >
              <option value="">Selecione a loja</option>
              {lojasDisponiveis.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Montador" hint="Você pode deixar em branco e atribuir depois.">
            <Select
              name="montadorId"
              value={montadorId}
              onChange={(e) => selecionarLojaOuMontador(lojaId, e.target.value)}
            >
              <option value="">A definir</option>
              <option value="ADM">A própria empresa (ADM)</option>
              {montadores.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field
            label="Manual / instrução para o montador (opcional)"
            hint="Imagem, PDF ou outro arquivo, até 3 MB — o montador vê isso na tela da montagem."
          >
            <input
              type="file"
              name="manual"
              onChange={aoEscolherManual}
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-medium file:text-navy hover:file:bg-gold-hover"
            />
          </Field>
          {manualPreparando ? (
            <p className="mt-2 text-sm text-slate-500">Preparando o arquivo…</p>
          ) : null}
          {manualAviso ? (
            <p className="mt-2 text-sm font-medium text-red-600">{manualAviso}</p>
          ) : null}
          {valoresIniciais?.manualUrl ? (
            <p className="mt-2 text-sm text-slate-500">
              Arquivo atual:{" "}
              <a
                href={valoresIniciais.manualUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-600 hover:underline"
              >
                {valoresIniciais.manualNomeArquivo || "ver arquivo"}
              </a>
              . Enviar um novo arquivo substitui o atual.
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Dados do cliente
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do cliente">
            <Input
              name="clienteNome"
              required
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              placeholder="Ex: Maria Souza"
            />
          </Field>
          <Field label="Telefone do cliente">
            <Input
              name="clienteTelefone"
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(e.target.value)}
              placeholder="(11) 91234-5678"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Endereço completo">
              <Input
                name="clienteEndereco"
                required
                value={clienteEndereco}
                onChange={(e) => setClienteEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
              />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          Serviço e valores
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field
              label="Nº do pedido (opcional)"
              hint={
                numeroTravado
                  ? "Número da entrega no CentralSync — é por ele que os dois sistemas se reconhecem. Mudar aqui tira esta montagem da fila de envio."
                  : undefined
              }
            >
              <Input
                name="numeroPedido"
                value={numeroPedido}
                onChange={(e) => setNumeroPedido(e.target.value)}
                readOnly={numeroTravado}
                placeholder="Ex: 12345"
                className={numeroTravado ? "bg-slate-100 text-slate-600" : undefined}
              />
            </Field>
            {numeroTravado ? (
              <button
                type="button"
                onClick={() => setNumeroDestravado(true)}
                className="mt-1.5 text-sm font-medium text-slate-500 underline hover:text-navy"
              >
                Destravar assim mesmo
              </button>
            ) : null}
          </div>
          <Field label="Data agendada (opcional)">
            <Input
              type="date"
              name="dataAgendada"
              value={dataAgendada}
              onChange={(e) => setDataAgendada(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descrição do serviço">
              <Textarea
                name="descricaoServico"
                required
                rows={2}
                value={descricaoServico}
                onChange={(e) => setDescricaoServico(e.target.value)}
                placeholder="Ex: Montagem de guarda-roupa 6 portas + cômoda"
              />
            </Field>
          </div>
          <Field label="Valor total do serviço (R$)">
            <Input
              type="text"
              inputMode="decimal"
              name="valorServico"
              required
              value={valorServico}
              onChange={(e) => setValorServico(e.target.value)}
              placeholder="Ex: 250,00"
            />
          </Field>
          <Field
            label="Comissão do montador (%)"
            hint="Preenchido automaticamente conforme a loja e o montador escolhidos. Pode ajustar."
          >
            <Input
              type="text"
              inputMode="decimal"
              name="percentualMontador"
              value={percentual}
              onChange={(e) => {
                setPercentual(e.target.value);
                setPercentualEditado(true);
              }}
              disabled={montadorId === "ADM"}
            />
          </Field>
          <Field
            label="Assistência (%)"
            hint="Preenchido automaticamente conforme a loja escolhida (cadastro da loja). Pode ajustar."
          >
            <Input
              type="text"
              inputMode="decimal"
              name="percentualAssistencia"
              value={percentualAssistencia}
              onChange={(e) => {
                setPercentualAssistencia(e.target.value);
                setPercentualAssistenciaEditado(true);
              }}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard
            titulo="Valor a receber (desta nota)"
            valor={formatarMoeda(valorServicoCalculado)}
            sub="O que a loja deve pela montagem"
            cor="text-emerald-600"
            icone="🏬"
          />
          <StatCard
            titulo="Valor estimado para o montador"
            valor={formatarMoeda(valorMontadorCalculado)}
            sub={`Comissão de ${percentual || 0}%`}
            icone="👷"
          />
          <StatCard
            titulo="Assistência (fica com a empresa)"
            valor={formatarMoeda(valorAssistenciaCalculado)}
            sub={`Assistência de ${percentualAssistencia || 0}%`}
            icone="🛠️"
          />
        </div>
      </div>

      {valoresIniciais?.status !== undefined ? (
        <div>
          <Field label="Status">
            <Select name="status" defaultValue={valoresIniciais.status || "PENDENTE"}>
              <option value="PENDENTE">Pendente</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="CONCLUIDO">Concluído</option>
              <option value="CANCELADO">Cancelado</option>
            </Select>
          </Field>
        </div>
      ) : null}

      <div>
        <Field label="Observações (opcional)">
          <Textarea
            name="observacoes"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Detalhes adicionais para o montador"
          />
        </Field>
      </div>

      <SubmitButton pendingText="Salvando…">Salvar montagem</SubmitButton>
    </form>
  );
}
