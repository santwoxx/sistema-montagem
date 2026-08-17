"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "perigo" | "sucesso" | "fantasma";

/**
 * Botão de submit que se auto-desabilita enquanto a Server Action do
 * formulário ao redor está em andamento — evita duplo clique / duplo envio
 * sem precisar de estado manual em cada formulário.
 */
export function SubmitButton({
  children,
  pendingText = "Enviando…",
  variante,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: string;
  variante?: Variante;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variante={variante}
      className={className}
      disabled={pending}
      {...props}
    >
      {pending ? pendingText : children}
    </Button>
  );
}
