function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Exibição somente-leitura de uma nota de 0 a 5 estrelas. */
export function Estrelas({
  valor,
  tamanho = "text-base",
  className,
}: {
  valor: number;
  tamanho?: string;
  className?: string;
}) {
  const cheias = Math.round(valor);
  return (
    <span
      className={cx("inline-flex items-center leading-none", tamanho, className)}
      aria-label={`${valor.toFixed(1)} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= cheias ? "text-gold" : "text-slate-300"}>
          ★
        </span>
      ))}
    </span>
  );
}
