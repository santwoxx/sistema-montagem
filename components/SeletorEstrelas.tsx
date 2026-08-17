"use client";

import { useState } from "react";

/** Seletor interativo de 1 a 5 estrelas, usado no formulário público de avaliação. */
export function SeletorEstrelas({
  name,
  valor,
  onChange,
}: {
  name: string;
  valor: number;
  onChange: (valor: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const destacadas = hover || valor;

  return (
    <div>
      <input type="hidden" name={name} value={valor} readOnly />
      <div
        className="flex gap-1 text-5xl leading-none"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label="Nota de 1 a 5 estrelas"
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={valor === i}
            aria-label={`${i} estrela${i > 1 ? "s" : ""}`}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            className={
              "cursor-pointer transition-transform active:scale-90 " +
              (destacadas >= i ? "text-gold" : "text-slate-300")
            }
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
