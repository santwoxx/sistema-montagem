// Utilitários de CNPJ compartilhados entre as ações de loja e de importação
// de notas. Fica fora de um arquivo "use server" de propósito: arquivos com
// a diretiva "use server" só podem exportar funções assíncronas (viram
// Server Actions), então funções auxiliares síncronas como estas moram aqui.

// Guarda o CNPJ só com dígitos, sem pontuação, pra comparar de forma
// confiável (a formatação varia entre o que o usuário digita e o que a
// importação de notas lê). Retorna null se não sobrar um CNPJ válido (14
// dígitos).
export function normalizarCnpj(valor: string | null | undefined): string | null {
  const digitos = String(valor || "").replace(/\D/g, "");
  return digitos.length === 14 ? digitos : null;
}

export function ehErroCnpjDuplicado(error: unknown) {
  const codigo = (error as { code?: string })?.code;
  const alvo = (error as { meta?: { target?: string[] } })?.meta?.target;
  return codigo === "P2002" && (alvo ?? []).includes("cnpj");
}
