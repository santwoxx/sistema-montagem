import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { enviarAvaliacaoAction } from "@/lib/actions/avaliacoes";
import { AvaliarForm } from "@/components/AvaliarForm";
import { Estrelas } from "@/components/Estrelas";
import { Alerta, Card } from "@/components/ui";
import { formatarData } from "@/lib/format";

function LayoutAvaliacao({ children }: { children: ReactNode }) {
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

export default async function AvaliarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;

  // Página pública: carrega só o necessário. `include: { montador: true }`
  // trazia a linha inteira do usuário (inclusive o hash da senha) e as
  // assinaturas da montagem para renderizar um primeiro nome.
  const montagem = await prisma.montagem.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      montadorId: true,
      montador: { select: { nome: true } },
      avaliacao: {
        select: { estrelas: true, comentario: true, criadoEm: true },
      },
    },
  });

  if (!montagem || !montagem.montadorId || montagem.status !== "CONCLUIDO") {
    return (
      <LayoutAvaliacao>
        <Card className="text-center">
          <p className="text-slate-700">
            Este link de avaliação não está disponível. Se você acha que isso é
            um erro, entre em contato com quem fez a sua montagem.
          </p>
        </Card>
      </LayoutAvaliacao>
    );
  }

  if (montagem.avaliacao) {
    return (
      <LayoutAvaliacao>
        <Card className="text-center">
          <p className="mb-3 text-base font-semibold text-slate-900">
            Obrigado pela sua avaliação!
          </p>
          <div className="mb-2 flex justify-center">
            <Estrelas valor={montagem.avaliacao.estrelas} tamanho="text-3xl" />
          </div>
          {montagem.avaliacao.comentario ? (
            <p className="mt-3 text-sm text-slate-600">
              &ldquo;{montagem.avaliacao.comentario}&rdquo;
            </p>
          ) : null}
          <p className="mt-4 text-xs text-slate-400">
            Avaliado em {formatarData(montagem.avaliacao.criadoEm)}
          </p>
        </Card>
      </LayoutAvaliacao>
    );
  }

  return (
    <LayoutAvaliacao>
      <Card>
        <p className="mb-1 text-center text-base font-semibold text-slate-900">
          Como foi a montagem?
        </p>
        <p className="mb-5 text-center text-sm text-slate-500">
          Sua opinião ajuda a avaliar o trabalho de{" "}
          {montagem.montador?.nome.split(" ")[0]}.
        </p>
        {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
        <AvaliarForm
          action={enviarAvaliacaoAction.bind(null, montagem.id)}
          nomeMontador={montagem.montador?.nome.split(" ")[0] ?? "quem te atendeu"}
        />
      </Card>
    </LayoutAvaliacao>
  );
}
