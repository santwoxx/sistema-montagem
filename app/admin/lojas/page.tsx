import { prisma } from "@/lib/prisma";
import { criarLojaAction, atualizarLojaAction, excluirLojaAction } from "@/lib/actions/lojas";
import { Alerta, Badge, Button, Card, Field, Input, PageHeader, Vazio } from "@/components/ui";
import { FormConfirmar } from "@/components/FormConfirmar";
import { SubmitButton } from "@/components/SubmitButton";
import { formatarCnpj } from "@/lib/format";

export default async function LojasPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { erro, sucesso } = await searchParams;

  const lojas = await prisma.loja.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { montagens: true } } },
  });

  return (
    <div>
      <PageHeader
        titulo="Lojas"
        descricao="Cadastre as lojas parceiras que enviam pedidos de montagem."
      />

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      {sucesso ? <Alerta tipo="sucesso">{sucesso}</Alerta> : null}

      <Card className="mb-8">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Nova loja</h2>
        <form action={criarLojaAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da loja">
            <Input name="nome" required placeholder="Ex: Móveis Rocha" />
          </Field>
          <Field label="Telefone">
            <Input name="telefone" placeholder="(11) 3333-4444" />
          </Field>
          <Field
            label="CNPJ (opcional)"
            hint="Usado pela importação de notas para reconhecer a loja automaticamente."
          >
            <Input name="cnpj" placeholder="00.000.000/0000-00" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Endereço (opcional)">
              <Input name="endereco" placeholder="Rua, número, bairro, cidade" />
            </Field>
          </div>
          <Field
            label="Assistência (%)"
            hint="Cobrado da loja em toda montagem, além da comissão do montador. Fica inteiro com a empresa."
          >
            <Input type="number" name="percentualAssistencia" min={0} max={100} step="0.5" defaultValue={0} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Cadastrando…">Cadastrar loja</SubmitButton>
          </div>
        </form>
      </Card>

      <h2 className="mb-4 text-base font-semibold text-gray-900">
        Lojas cadastradas ({lojas.length})
      </h2>

      {lojas.length === 0 ? (
        <Vazio>Nenhuma loja cadastrada ainda.</Vazio>
      ) : (
        <div className="space-y-3">
          {lojas.map((loja) => (
            <Card key={loja.id}>
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{loja.nome}</p>
                    <p className="text-sm text-gray-500">
                      {loja.telefone || "Sem telefone"}
                      {loja.endereco ? ` · ${loja.endereco}` : ""}
                      {loja.cnpj ? ` · CNPJ ${formatarCnpj(loja.cnpj)}` : ""}
                      {loja.percentualAssistencia ? ` · Assistência ${loja.percentualAssistencia}%` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {loja._count.montagens} montagem(ns)
                    </span>
                    <Badge
                      className={
                        loja.ativo
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-200 text-gray-600"
                      }
                    >
                      {loja.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                    <span className="text-sm text-blue-600">editar</span>
                  </div>
                </summary>

                <form
                  action={atualizarLojaAction.bind(null, loja.id)}
                  className="mt-4 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2"
                >
                  <Field label="Nome da loja">
                    <Input name="nome" defaultValue={loja.nome} required />
                  </Field>
                  <Field label="Telefone">
                    <Input name="telefone" defaultValue={loja.telefone ?? ""} />
                  </Field>
                  <Field
                    label="CNPJ"
                    hint="Usado pela importação de notas para reconhecer a loja automaticamente."
                  >
                    <Input name="cnpj" defaultValue={formatarCnpj(loja.cnpj)} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Endereço">
                      <Input name="endereco" defaultValue={loja.endereco ?? ""} />
                    </Field>
                  </div>
                  <Field
                    label="Assistência (%)"
                    hint="Cobrado da loja em toda montagem, além da comissão do montador. Fica inteiro com a empresa."
                  >
                    <Input
                      type="number"
                      name="percentualAssistencia"
                      min={0}
                      max={100}
                      step="0.5"
                      defaultValue={loja.percentualAssistencia}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      name="ativo"
                      defaultChecked={loja.ativo}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Loja ativa (aparece para escolha ao criar montagens)
                  </label>
                  <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                    <SubmitButton pendingText="Salvando…">Salvar alterações</SubmitButton>
                  </div>
                </form>

                {loja._count.montagens === 0 ? (
                  <FormConfirmar
                    action={excluirLojaAction.bind(null, loja.id)}
                    mensagem={`Excluir a loja "${loja.nome}"? Essa ação não pode ser desfeita.`}
                    className="mt-3 border-t border-gray-100 pt-3"
                  >
                    <Button type="submit" variante="perigo">
                      Excluir loja
                    </Button>
                  </FormConfirmar>
                ) : (
                  <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-slate-400">
                    Não é possível excluir: já tem {loja._count.montagens} montagem(ns)
                    registrada(s). Desative-a acima em vez disso.
                  </p>
                )}
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
