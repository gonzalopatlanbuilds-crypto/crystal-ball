import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormularioSupuesto from "@/components/FormularioSupuesto";
import { BotonEliminarSupuesto } from "@/components/BotonesSupuesto";
import type { FilaSupuesto } from "@/lib/leer-supuestos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarSupuestoPage({ params }: PageProps<"/modelo/supuestos/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: f } = await supabase
    .from("assumptions")
    .select("id, key, value_num, unit, status, source_url, source_date, note")
    .eq("id", id)
    .maybeSingle<FilaSupuesto>();
  if (!f) notFound();

  return (
    <section className="space-y-6">
      <div>
        <Link href="/modelo/supuestos" className="text-sm text-[#0b5e52] underline">
          ← Volver a supuestos
        </Link>
        <h1 className="mt-2 text-xl font-bold text-zinc-900">Editar supuesto</h1>
      </div>
      <FormularioSupuesto
        id={f.id}
        inicial={{
          key: f.key,
          // Coma decimal, como se escribe en México.
          value_num: String(Number(f.value_num)).replace(".", ","),
          status: f.status,
          source_url: f.source_url ?? "",
          source_date: f.source_date ?? "",
          note: f.note ?? "",
        }}
      />
      <BotonEliminarSupuesto id={f.id} />
    </section>
  );
}
