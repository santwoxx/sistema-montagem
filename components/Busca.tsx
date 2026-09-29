import Form from "next/form";
import { Button, Card, Input } from "@/components/ui";

/** Campo de busca do topo das páginas /admin/busca e /montador/busca. */
export function FormularioBusca({
  action,
  termo,
  placeholder,
}: {
  action: string;
  termo: string;
  placeholder: string;
}) {
  return (
    <Card className="mb-6">
      <Form action={action} role="search" className="flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={termo}
          required
          enterKeyHint="search"
          autoFocus={!termo}
          aria-label="Buscar"
          placeholder={placeholder}
        />
        <Button type="submit">Buscar</Button>
      </Form>
    </Card>
  );
}

export function TituloSecao({ titulo, quantidade }: { titulo: string; quantidade: number }) {
  return (
    <h2 className="mb-3 text-base font-semibold text-gray-900">
      {titulo} <span className="font-normal text-slate-500">({quantidade})</span>
    </h2>
  );
}
