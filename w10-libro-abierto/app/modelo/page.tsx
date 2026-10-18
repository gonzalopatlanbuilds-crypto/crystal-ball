import { createClient } from "@/lib/supabase/server";

export default async function ModeloPage() {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("name, join_code").maybeSingle();

  return (
    <section>
      <h1 className="text-xl font-bold text-zinc-900">Modelo</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Aquí vivirán los supuestos, el resultado derivado y la viabilidad.
      </p>
      {org && (
        <p className="mt-4 text-xs text-zinc-500">
          Organización: {org.name} · código para tu equipo:{" "}
          <span className="font-mono">{org.join_code}</span>
        </p>
      )}
    </section>
  );
}
