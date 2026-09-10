import type { ReactNode } from "react";
import { criarSolicitacaoAction } from "@/lib/actions/agendamentos";
import { Alerta, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { PERIODO_LABEL, PeriodoAgendamentoSchema } from "@/lib/validacao";

export const metadata = {
  title: "Agendar montagem · MontaFácil",
  description:
    "Preencha seus dados e o que precisa ser montado. Entramos em contato para confirmar o horário.",
};

function LayoutAgendamento({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-gold to-gold-hover text-xl font-bold text-white shadow-sm shadow-gold/30">
            D
          </span>
          <p className="text-lg font-bold uppercase tracking-wide text-navy font-display">
            MontaFácil
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; enviado?: string }>;
}) {
  const { erro, enviado } = await searchParams;

  if (enviado) {
    return (
      <LayoutAgendamento>
        <Card className="text-center">
          <p className="mb-2 text-base font-semibold text-slate-900">
            Pedido enviado! ✅
          </p>
          <p className="text-sm text-slate-600">
            Recebemos seus dados. Entramos em contato pelo telefone que você
            informou para confirmar o dia e o horário da montagem.
          </p>
          <a
            href="/agendar"
            className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:underline"
          >
            Enviar outro pedido
          </a>
        </Card>
      </LayoutAgendamento>
    );
  }

  return (
    <LayoutAgendamento>
      <Card>
        <p className="mb-1 text-base font-semibold text-slate-900">
          Agendar uma montagem
        </p>
        <p className="mb-5 text-sm text-slate-500">
          Preencha os dados abaixo. Confirmamos o dia e o horário com você pelo
          WhatsApp antes de fechar.
        </p>

        {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

        <form action={criarSolicitacaoAction} className="space-y-4">
          <Field label="Seu nome">
            <Input name="clienteNome" required maxLength={120} placeholder="Ex: Maria Souza" />
          </Field>

          <Field label="Telefone (WhatsApp)">
            <Input
              name="clienteTelefone"
              required
              maxLength={40}
              inputMode="tel"
              placeholder="(73) 91234-5678"
            />
          </Field>

          <Field label="Endereço completo" hint="Rua, número, bairro, cidade e um ponto de referência.">
            <Textarea
              name="clienteEndereco"
              required
              rows={2}
              maxLength={300}
              placeholder="Rua das Flores, 120, Centro, Itabuna — perto da praça"
            />
          </Field>

          <Field label="O que precisa ser montado?">
            <Textarea
              name="produto"
              required
              rows={2}
              maxLength={300}
              placeholder="Ex: guarda-roupa 6 portas e uma cômoda"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dia de preferência (opcional)">
              <Input type="date" name="dataPreferida" />
            </Field>
            <Field label="Turno (opcional)">
              <Select name="periodo" defaultValue="QUALQUER">
                {PeriodoAgendamentoSchema.options.map((p) => (
                  <option key={p} value={p}>
                    {PERIODO_LABEL[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Alguma observação? (opcional)">
            <Textarea
              name="observacoes"
              rows={2}
              maxLength={600}
              placeholder="Ex: o apartamento não tem elevador"
            />
          </Field>

          <SubmitButton className="w-full" pendingText="Enviando…">
            Enviar pedido
          </SubmitButton>
        </form>
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        Enviar este formulário não confirma a montagem — confirmamos com você
        antes.
      </p>
    </LayoutAgendamento>
  );
}
