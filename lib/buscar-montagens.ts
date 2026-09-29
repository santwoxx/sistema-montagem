import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  digitosDeTelefone,
  escaparLike,
  LETRAS_ACENTUADAS,
  LETRAS_SEM_ACENTO,
  palavrasDaBusca,
} from "@/lib/busca";

// Consulta da busca geral de montagens. As regras (o que é palavra, o que é
// telefone, o que "bate") estão em lib/busca.ts; aqui é só a tradução delas
// para SQL.
//
// SQL cru, e não o `contains` do Prisma, por dois motivos: o `contains` com
// `mode: "insensitive"` vira ILIKE, que diferencia acento ("joao" não
// encontrava "João"); e o telefone é gravado do jeito que chegou -- só
// comparando os dígitos dá para achar "(73) 98803-6706" digitando
// "73988036706".

const DE = LETRAS_ACENTUADAS + LETRAS_ACENTUADAS.toUpperCase();
const PARA = LETRAS_SEM_ACENTO + LETRAS_SEM_ACENTO;

/** A coluna em minúsculas e sem acento, igual a `semAcento` em lib/busca.ts. */
function semAcentoSql(coluna: Prisma.Sql) {
  return Prisma.sql`lower(translate(coalesce(${coluna}, ''), ${DE}, ${PARA}))`;
}

/** Onde cada palavra da busca é procurada. */
const CAMPOS_DE_TEXTO = [
  Prisma.sql`m."clienteNome"`,
  Prisma.sql`m."clienteEndereco"`,
  Prisma.sql`m."clienteTelefone"`,
  Prisma.sql`m."numeroPedido"`,
  Prisma.sql`m."descricaoServico"`,
  Prisma.sql`u."nome"`,
  Prisma.sql`l."nome"`,
];

/**
 * Ids das montagens que batem com a busca, da mais recente para a mais
 * antiga, até `limite`. `total` é quantas bateram ao todo, sem o limite.
 *
 * Toda palavra precisa aparecer em algum campo (cliente, endereço,
 * telefone, nº do pedido, serviço, montador ou loja). Com `montadorId`, só
 * as montagens daquele montador -- é a busca do painel do montador.
 */
export async function buscarIdsDeMontagens(
  termo: string,
  opcoes: { limite: number; montadorId?: string }
): Promise<{ ids: string[]; total: number }> {
  const palavras = palavrasDaBusca(termo);
  if (palavras.length === 0) return { ids: [], total: 0 };

  const condicoes = palavras.map((palavra) => {
    const padrao = `%${escaparLike(palavra)}%`;
    const alternativas = CAMPOS_DE_TEXTO.map(
      (campo) => Prisma.sql`${semAcentoSql(campo)} LIKE ${padrao}`
    );

    const digitos = digitosDeTelefone(palavra);
    if (digitos) {
      alternativas.push(
        Prisma.sql`regexp_replace(coalesce(m."clienteTelefone", ''), '[^0-9]', '', 'g') LIKE ${`%${digitos}%`}`
      );
    }

    return Prisma.sql`(${Prisma.join(alternativas, " OR ")})`;
  });

  if (opcoes.montadorId) {
    condicoes.push(Prisma.sql`m."montadorId" = ${opcoes.montadorId}`);
  }

  const linhas = await prisma.$queryRaw<Array<{ id: string; total: bigint }>>`
    SELECT m."id", count(*) OVER () AS "total"
    FROM "Montagem" m
    LEFT JOIN "User" u ON u."id" = m."montadorId"
    LEFT JOIN "Loja" l ON l."id" = m."lojaId"
    WHERE ${Prisma.join(condicoes, " AND ")}
    ORDER BY m."createdAt" DESC, m."id" DESC
    LIMIT ${opcoes.limite}
  `;

  return {
    ids: linhas.map((l) => l.id),
    total: linhas.length > 0 ? Number(linhas[0]!.total) : 0,
  };
}
