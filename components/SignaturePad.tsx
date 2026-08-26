"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import SignaturePadLib from "signature_pad";
import { Button } from "@/components/ui";

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { label: string }>(
  function SignaturePad({ label }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePadLib | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pad = new SignaturePadLib(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
      });
      padRef.current = pad;

      function ajustarTamanho() {
        if (!canvas) return;
        // Teto de 2 na proporção de pixels. A assinatura é guardada como PNG
        // em base64 (campo Text no banco) e vai inteira no aviso ao
        // CentralSync -- e o tamanho dela cresce com o quadrado desta
        // proporção. Celular costuma reportar 3 ou mais, ou seja, a mesma
        // assinatura pesava algumas vezes mais quando colhida na rua do que
        // no computador. Em 2 o traço continua liso na tela do aparelho.
        const proporcao = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
        const { width, height } = canvas.getBoundingClientRect();
        const novaLargura = Math.round(width * proporcao);
        const novaAltura = Math.round(height * proporcao);
        // Evita reprocessar (e apagar o desenho) em resizes que não mudam o
        // tamanho de verdade — ex: teclado do celular abrindo/fechando pode
        // disparar "resize" sem a largura do canvas mudar.
        if (canvas.width === novaLargura && canvas.height === novaAltura) return;

        const dadosAnteriores = pad.toData();
        canvas.width = novaLargura;
        canvas.height = novaAltura;
        canvas.getContext("2d")?.scale(proporcao, proporcao);
        pad.fromData(dadosAnteriores);
      }

      ajustarTamanho();
      window.addEventListener("resize", ajustarTamanho);
      return () => {
        window.removeEventListener("resize", ajustarTamanho);
        pad.off();
      };
    }, []);

    useImperativeHandle(ref, () => ({
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toDataURL: () => padRef.current?.toDataURL("image/png") ?? "",
      clear: () => padRef.current?.clear(),
    }));

    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <Button
            type="button"
            variante="fantasma"
            className="!px-2 !py-1 text-xs"
            onClick={() => padRef.current?.clear()}
          >
            Limpar
          </Button>
        </div>
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none rounded-xl border border-slate-200 bg-white"
        />
      </div>
    );
  }
);
