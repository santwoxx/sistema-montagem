"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui";

/** Abre a impressão do navegador, de onde também dá para salvar em PDF. */
export function BotaoImprimir({ children }: { children: ReactNode }) {
  return (
    <Button type="button" variante="secundario" onClick={() => window.print()}>
      {children}
    </Button>
  );
}
