import { describe, expect, it } from "vitest";
import {
  agruparClientes,
  correspondeABusca,
  descreverData,
  digitosDeTelefone,
  escaparLike,
  LETRAS_ACENTUADAS,
  LETRAS_SEM_ACENTO,
  lerTermo,
  palavrasDaBusca,
  semAcento,
  type MontagemDeCliente,
} from "@/lib/busca";

describe("palavras da busca", () => {
  it("tira acento, maiúscula e espaço sobrando", () => {
    expect(palavrasDaBusca("  João   da CONCEIÇÃO ")).toEqual(["joao", "da", "conceicao"]);
  });

  it("não repete palavra e limita a quantidade", () => {
    expect(palavrasDaBusca("maria Maria MARIA")).toEqual(["maria"]);
    expect(palavrasDaBusca("a b c d e f g h")).toHaveLength(6);
  });

  it("não devolve nada para busca vazia", () => {
    expect(palavrasDaBusca("   ")).toEqual([]);
  });

  it("lê o termo da URL mesmo repetido e corta o exagero", () => {
    expect(lerTermo(["  sofá ", "outro"])).toBe("sofá");
    expect(lerTermo(undefined)).toBe("");
    expect(lerTermo("x".repeat(500))).toHaveLength(100);
  });
});

describe("tabela de acentos do SQL", () => {
  // O SQL usa translate() com estas duas listas; se elas desalinharem, a
  // busca no banco e a busca em JS passam a discordar.
  it("tem as duas listas do mesmo tamanho", () => {
    expect([...LETRAS_ACENTUADAS]).toHaveLength([...LETRAS_SEM_ACENTO].length);
  });

  it("dá o mesmo resultado que semAcento, em minúscula e em maiúscula", () => {
    expect(semAcento(LETRAS_ACENTUADAS)).toBe(LETRAS_SEM_ACENTO);
    expect(semAcento(LETRAS_ACENTUADAS.toUpperCase())).toBe(LETRAS_SEM_ACENTO);
  });
});

describe("telefone na busca", () => {
  it("reconhece pedaço de telefone em qualquer formato", () => {
    expect(digitosDeTelefone("98803-6706")).toBe("988036706");
    expect(digitosDeTelefone("(73)")).toBeNull();
    expect(digitosDeTelefone("apto101")).toBeNull();
  });

  it("trata telefone digitado com espaço como uma palavra só", () => {
    expect(palavrasDaBusca("(73) 98803-6706")).toEqual(["(73)98803-6706"]);
    expect(correspondeABusca(palavrasDaBusca("(73) 98803-6706"), {
      textos: ["Maria"],
      telefones: ["73988036706"],
    })).toBe(true);
    // Com letra no meio, continua sendo busca por palavras.
    expect(palavrasDaBusca("rua 12 casa 3")).toEqual(["rua", "12", "casa", "3"]);
  });

  it("acha o telefone gravado formatado digitando só os dígitos", () => {
    const campos = { textos: ["Ana"], telefones: ["(73) 98803-6706"] };
    expect(correspondeABusca(["73988036706"], campos)).toBe(true);
    expect(correspondeABusca(["88036706"], campos)).toBe(true);
    expect(correspondeABusca(["99999999"], campos)).toBe(false);
  });
});

describe("correspondeABusca", () => {
  const cliente = {
    textos: ["José Conceição", "Rua das Flores, 12 - Centro"],
    telefones: [],
  };

  it("ignora acento e maiúscula", () => {
    expect(correspondeABusca(palavrasDaBusca("jose conceicao"), cliente)).toBe(true);
  });

  it("aceita palavras em campos diferentes e em qualquer ordem", () => {
    expect(correspondeABusca(palavrasDaBusca("centro jose"), cliente)).toBe(true);
  });

  it("exige todas as palavras", () => {
    expect(correspondeABusca(palavrasDaBusca("jose bairro-novo"), cliente)).toBe(false);
  });

  it("não bate com busca vazia", () => {
    expect(correspondeABusca([], cliente)).toBe(false);
  });
});

describe("escaparLike", () => {
  it("trata % e _ digitados como texto", () => {
    expect(escaparLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("descreverData", () => {
  const criada = new Date("2026-03-10T15:00:00.000Z");
  const agendada = new Date("2026-03-15T15:00:00.000Z");
  const concluida = new Date("2026-03-16T15:00:00.000Z");

  it("prefere a conclusão, depois o agendamento, depois o cadastro", () => {
    expect(descreverData({ concluidoEm: concluida, dataAgendada: agendada, createdAt: criada })).toBe(
      "Concluída em 16/03/2026"
    );
    expect(descreverData({ concluidoEm: null, dataAgendada: agendada, createdAt: criada })).toBe(
      "Agendada para 15/03/2026"
    );
    expect(descreverData({ concluidoEm: null, dataAgendada: null, createdAt: criada })).toBe(
      "Cadastrada em 10/03/2026"
    );
  });
});

describe("agruparClientes", () => {
  function montagem(dados: Partial<MontagemDeCliente>): MontagemDeCliente {
    return {
      clienteNome: "Maria Souza",
      clienteTelefone: null,
      clienteEndereco: "Rua A, 1",
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      responsavel: null,
      ...dados,
    };
  }

  it("junta as montagens do mesmo cliente, mesmo com grafia diferente", () => {
    const clientes = agruparClientes(
      [
        montagem({ clienteNome: "Maria Souza", responsavel: "Carlos", createdAt: new Date("2026-05-01") }),
        montagem({ clienteNome: "MARIA  SOUZA", clienteTelefone: "73 99999-0000" }),
        montagem({ clienteNome: "Mária Souza" }),
      ],
      palavrasDaBusca("maria")
    );

    expect(clientes).toHaveLength(1);
    expect(clientes[0]).toMatchObject({
      nome: "Maria Souza",
      montagens: 3,
      ultimoResponsavel: "Carlos",
      ultimaEm: new Date("2026-05-01"),
      // A mais recente não tinha telefone: vem da próxima que tem.
      telefone: "73 99999-0000",
    });
  });

  it("guarda o último montador que realmente atendeu", () => {
    const [cliente] = agruparClientes(
      [montagem({ responsavel: null }), montagem({ responsavel: "Ana" })],
      palavrasDaBusca("maria")
    );
    expect(cliente?.ultimoResponsavel).toBe("Ana");
  });

  it("não lista como cliente quem só apareceu porque a busca bateu no montador", () => {
    const clientes = agruparClientes(
      [montagem({ clienteNome: "Pedro Lima", responsavel: "Carlos" })],
      palavrasDaBusca("carlos")
    );
    expect(clientes).toEqual([]);
  });
});
