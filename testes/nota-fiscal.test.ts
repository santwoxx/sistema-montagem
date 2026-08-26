import { describe, expect, it } from "vitest";
import { interpretarTextoNota, interpretarXmlDeNota } from "@/lib/nota-fiscal";

const XML_NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00"><NFe><infNFe Id="NFe29260800011122000199550010000004041000004049" versao="4.00">
<ide><cUF>29</cUF><nNF>404</nNF><serie>1</serie><dhEmi>2026-08-12T09:14:00-03:00</dhEmi></ide>
<emit><CNPJ>00011122000199</CNPJ><xNome>CENTRAL MOVEIS LTDA</xNome></emit>
<dest><CNPJ>11122233344</CNPJ><xNome>MARIA SOUZA DA SILVA</xNome><fone>7399991234</fone>
<enderDest><xLgr>Rua das Flores</xLgr><nro>128</nro><xBairro>Centro</xBairro><xMun>Itabuna</xMun><UF>BA</UF><CEP>45600000</CEP></enderDest>
</dest>
<det nItem="1"><prod><xProd>GUARDA ROUPA 6 PORTAS</xProd></prod></det>
<det nItem="2"><prod><xProd>COMODA 4 GAVETAS</xProd></prod></det>
<total><ICMSTot><vProd>2999.00</vProd><vNF>2999.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

// Texto como o OCR entrega: as colunas da tabela viram corridas de espaço na
// mesma linha, e o canhoto do topo repete trechos que confundem a leitura.
const TEXTO_DANFE = `RECEBEMOS DE CENTRAL MOVEIS LTDA OS PRODUTOS CONSTANTES DA NOTA FISCAL
DATA DE RECEBIMENTO   IDENTIFICACAO E ASSINATURA DO RECEBEDOR   NF-e No 000.000.404
CENTRAL MOVEIS LTDA
Av. do Cinquentenario, 812 - Centro
Itabuna - BA
DANFE
DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA
0 - ENTRADA
1 - SAIDA
No 000.000.404
SERIE 1
CHAVE DE ACESSO
2926 0800 0111 2200 0199 5500 1000 0004 0410 0000 4049
NATUREZA DA OPERACAO
VENDA DE MERCADORIA
INSCRICAO ESTADUAL   CNPJ
123456789          00.011.122/0001-99
DESTINATARIO / REMETENTE
NOME / RAZAO SOCIAL                        CNPJ/CPF          DATA DA EMISSAO
MARIA SOUZA DA SILVA                       111.222.333-44    12/08/2026
ENDERECO                                   BAIRRO / DISTRITO      CEP
Rua das Flores, 128                        Centro                 45.600-000
MUNICIPIO                     FONE / FAX          UF
Itabuna                       (73) 99999-1234     BA
CALCULO DO IMPOSTO
BASE DE CALCULO DO ICMS   VALOR DO ICMS   VALOR TOTAL DOS PRODUTOS
0,00                      0,00            2.999,00
VALOR DO FRETE   OUTRAS DESPESAS   VALOR TOTAL DA NOTA
0,00             0,00              2.999,00
DADOS DO PRODUTO / SERVICO
COD PROD   DESCRICAO DO PRODUTO / SERVICO   NCM/SH   CST   CFOP   UNID   QTD
000310     GUARDA ROUPA 6 PORTAS BRANCO     94036000  000   5102   UN     1
           COM ESPELHO
DADOS ADICIONAIS`;

describe("leitura do XML da NFe", () => {
  it("extrai cliente, endereço, produtos, valor e emitente", () => {
    expect(interpretarXmlDeNota(XML_NFE)).toEqual({
      clienteNome: "MARIA SOUZA DA SILVA",
      clienteTelefone: "7399991234",
      clienteEndereco: "Rua das Flores, 128, Centro, Itabuna, BA",
      descricaoServico: "GUARDA ROUPA 6 PORTAS; COMODA 4 GAVETAS",
      valorServico: "2999,00",
      numeroPedido: "404",
      lojaNomeSugerida: "CENTRAL MOVEIS LTDA",
      lojaCnpjSugerido: "00011122000199",
    });
  });

  it("converte o valor para o formato brasileiro", () => {
    // O XML traz 2999.00; o formulário espera vírgula decimal.
    expect(interpretarXmlDeNota(XML_NFE).valorServico).toBe("2999,00");
  });

  it("avisa quando o XML não é uma nota fiscal", () => {
    const r = interpretarXmlDeNota("<config><banco>producao</banco></config>");
    expect(r.erro).toMatch(/não parece ser uma nota fiscal/i);
    expect(r.clienteNome).toBeUndefined();
  });
});

describe("leitura do DANFE por OCR", () => {
  const lido = interpretarTextoNota(TEXTO_DANFE);

  it("recupera o nome mesmo com o CPF grudado na mesma linha", () => {
    // A coluna do documento vem colada no nome no texto do OCR. Como o
    // filtro de nome recusa qualquer coisa com dígito, sem cortar o CPF
    // antes o campo chegava vazio.
    expect(lido.clienteNome).toBe("MARIA SOUZA DA SILVA");
  });

  it("junta endereço, bairro e município sem as corridas de espaço", () => {
    expect(lido.clienteEndereco).toBe("Rua das Flores, 128 Centro, Itabuna");
  });

  it("lê o número da nota impresso com separador de milhar", () => {
    // "Nº 000.000.404" precisa virar 404 -- o mesmo número que o <nNF> do
    // XML da mesma nota traz. Antes parava no primeiro grupo e gravava
    // "000" como número do pedido em toda nota lida por foto.
    expect(lido.numeroPedido).toBe("404");
    expect(lido.numeroPedido).toBe(interpretarXmlDeNota(XML_NFE).numeroPedido);
  });

  it("pega o valor total da nota, não a base de cálculo", () => {
    expect(lido.valorServico).toBe("2.999,00");
  });

  it("pega o telefone do destinatário, não o da loja", () => {
    expect(lido.clienteTelefone).toBe("(73) 99999-1234");
  });

  it("junta a descrição do produto quebrada em duas linhas", () => {
    expect(lido.descricaoServico).toBe("GUARDA ROUPA 6 PORTAS BRANCO COM ESPELHO");
  });

  it("identifica a loja pelo CNPJ do emitente", () => {
    // É o CNPJ que resolve a loja (resolverOuCriarLojaAction procura por ele
    // primeiro), então é o campo que precisa estar certo.
    expect(lido.lojaCnpjSugerido).toBe("00011122000199");
    expect(lido.lojaCnpjSugerido).toBe(interpretarXmlDeNota(XML_NFE).lojaCnpjSugerido);
  });

  it("devolve o texto lido para o admin conferir o que não reconheceu", () => {
    expect(lido.textoOriginal).toBe(TEXTO_DANFE);
  });

  it("avisa quando não há texto reconhecível", () => {
    expect(interpretarTextoNota("   ").erro).toMatch(/não consegui reconhecer texto/i);
  });

  it("nunca inventa nome a partir de lixo de OCR", () => {
    // Palavra com maiúscula no meio ("eNFICA") é assinatura de erro de
    // leitura; um nome errado é pior que um campo vazio.
    const r = interpretarTextoNota(
      "DESTINATARIO / REMETENTE\nNOME / RAZAO SOCIAL\neNFICA x9 |||\nENDERECO\nRua A, 1"
    );
    expect(r.clienteNome).toBeUndefined();
  });
});
