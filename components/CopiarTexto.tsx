"use client";

import { useState } from "react";

/**
 * Botão que copia um texto (ex: endereço) para a área de transferência —
 * útil para colar em qualquer outro app de navegação além do Google Maps e
 * do Waze (Apple Maps, Uber, etc.).
 */
export function CopiarTexto({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o endereço abaixo:", texto);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:underline"
    >
      {copiado ? "✅ Copiado!" : `📋 ${rotulo}`}
    </button>
  );
}
