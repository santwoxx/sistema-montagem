import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const estilosBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none text-base px-5 py-4 sm:px-4 sm:py-3 active:scale-95";

const variantes = {
  primario:
    "bg-gold text-navy shadow-sm shadow-gold/20 hover:bg-gold-hover hover:shadow-md hover:shadow-gold/25",
  secundario:
    "bg-white text-navy border-2 border-navy hover:bg-navy hover:text-white",
  perigo: "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md",
  sucesso:
    "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-md",
  fantasma: "text-slate-600 hover:bg-navy/5 hover:text-navy",
};

type Variante = keyof typeof variantes;

export function Button({
  variante = "primario",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={cx(estilosBase, variantes[variante], "cursor-pointer", className)}
      {...props}
    />
  );
}

export function LinkButton({
  variante = "primario",
  className,
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variante?: Variante;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(estilosBase, variantes[variante], className)}
      {...props}
    >
      {children}
    </Link>
  );
}

const controleClasses =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-4 sm:px-3.5 sm:py-3 text-base text-slate-900 placeholder:text-slate-500 transition-colors focus:border-navy focus:outline-none focus:ring-4 focus:ring-gold/30";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controleClasses, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(controleClasses, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(controleClasses, "bg-white", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx("mb-1.5 block text-sm font-medium text-slate-700", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1.5 text-sm text-slate-600 leading-snug">{hint}</p> : null}
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm shadow-navy/5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Alerta({
  tipo = "erro",
  children,
}: {
  tipo?: "erro" | "sucesso";
  children: ReactNode;
}) {
  const estilos =
    tipo === "erro"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <div className={cx("mb-4 rounded-xl border px-4 py-3 text-sm", estilos)}>
      {children}
    </div>
  );
}

const coresIcone: Record<string, string> = {
  "text-gray-900": "bg-navy/5 text-navy",
  "text-amber-600": "bg-gold/10 text-gold",
  "text-blue-600": "bg-navy/10 text-navy-light",
  "text-red-600": "bg-red-50 text-red-600",
  "text-emerald-600": "bg-emerald-50 text-emerald-600",
};

export function StatCard({
  titulo,
  valor,
  cor = "text-gray-900",
  sub,
  icone,
}: {
  titulo: string;
  valor: string;
  cor?: string;
  sub?: string;
  icone?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{titulo}</p>
          <p className={cx("mt-1.5 text-2xl font-bold tracking-tight", cor)}>{valor}</p>
          {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
        </div>
        {icone ? (
          <span
            className={cx(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base",
              coresIcone[cor] ?? "bg-navy/5 text-navy"
            )}
          >
            {icone}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy sm:text-2xl font-display">
          {titulo}
        </h1>
        {descricao ? <p className="mt-1 text-sm text-slate-500">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-10 text-center text-base text-slate-600">
      {children}
    </div>
  );
}

export function Modal({
  aberto,
  onClose,
  titulo,
  children,
}: {
  aberto: boolean;
  onClose: () => void;
  titulo?: string;
  children: ReactNode;
}) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 flex flex-col rounded-2xl bg-white shadow-xl shadow-navy/10 overflow-hidden">
        {titulo ? (
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-bold text-navy font-display">{titulo}</h3>
          </div>
        ) : null}
        
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
