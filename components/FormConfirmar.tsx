"use client";

import { useState, useRef, type ReactNode } from "react";
import { Modal, Button } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function FormConfirmar({
  action,
  mensagem,
  children,
  className,
}: {
  action: (formData: FormData) => void;
  mensagem: string;
  children: ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <div
        className={className}
        onClick={(e) => {
          e.preventDefault();
          setAberto(true);
        }}
      >
        {children}
      </div>
      <Modal aberto={aberto} onClose={() => setAberto(false)} titulo="Confirmar ação">
        <p className="text-sm text-slate-600 mb-6">{mensagem}</p>
        <form action={action} ref={formRef} className="flex gap-3 justify-end">
          <Button
            type="button"
            variante="fantasma"
            onClick={() => setAberto(false)}
          >
            Cancelar
          </Button>
          <SubmitButton
            variante="perigo"
            pendingText="Confirmando…"
          >
            Confirmar
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}
