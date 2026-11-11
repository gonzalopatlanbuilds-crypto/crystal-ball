import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Aviso from "@/components/Aviso";
import BotonGoogle from "@/components/BotonGoogle";

const PASOS = [
  { titulo: "1. Subes un CSV", detalle: "Proveedor, SKU, peso, material, fecha, folio" },
  { titulo: "2. El motor compara", detalle: "Contra la última evidencia aceptada" },
  { titulo: "3. Tú decides", detalle: "Cada hallazgo pide tu confirmación, con nota" },
];

// Home pública (mockup assets/w12-mockup-home.png). Con sesión no se
// muestra: manda a /onboarding (sin organización) o a /validador.
export default async function Home({ searchParams }: PageProps<"/">) {
  // Si el redirectTo del login no está en la lista de Redirect URLs de
  // Supabase, Supabase manda el ?code a su "Site URL" (la raíz) en vez de
  // a /auth/callback, y aquí se perdía en silencio (w09). Se reenvía al
  // callback y queda registrado.
  const { code } = await searchParams;
  if (typeof code === "string" && code) {
    console.warn("Home: llegó ?code a la raíz — revisar Redirect URLs en Supabase");
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    // Sin este log, un error real de RLS llega aquí como `data: null`,
    // indistinguible de "todavía no tiene perfil" (loop silencioso a
    // /onboarding, bug de w06).
    if (error) {
      console.error("Home: no se pudo leer el perfil", error);
    }

    redirect(profile ? "/validador" : "/onboarding");
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Aviso />
        <h1 className="mt-6 text-2xl font-bold text-zinc-900">Evidencia de empaque que se sostiene sola</h1>
        <p className="mt-2 text-zinc-600">
          Carga los datos de tus proveedores. Detectamos lo que no encaja,
          antes de que alguien más lo haga.
        </p>
        <div className="mt-6">
          <BotonGoogle />
        </div>

        <h2 className="mt-10 border-t-4 border-zinc-100 pt-6 text-lg font-bold text-zinc-900">Cómo funciona</h2>
        <ol className="mt-3 grid gap-3">
          {PASOS.map((p) => (
            <li key={p.titulo} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="font-semibold text-zinc-900">{p.titulo}</p>
              <p className="text-sm text-zinc-600">{p.detalle}</p>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-lg font-bold text-zinc-900">Quién paga por esto</h2>
        <p className="mt-3 rounded-xl border border-[#0b5e52] bg-teal-50/50 px-4 py-3 text-sm text-[#0b5e52]">
          Las plataformas enterprise de este tipo cobran por cotización, fuera
          del alcance de un productor pequeño. Validator es para productores
          como Concept G.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/pricing" className="font-semibold text-[#0b5e52] underline">Ver precios y su evidencia</Link>
          {" · "}
          <Link href="/about" className="font-semibold text-[#0b5e52] underline">El caso 10:1</Link>
        </p>

        <h2 className="mt-8 text-lg font-bold text-zinc-900">Lo que Validator NUNCA hace</h2>
        <ul className="mt-3 space-y-1 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <li>[!] No certifica cumplimiento ni reciclaje.</li>
          <li>[!] No decide por ti: cada hallazgo lo confirmas tú.</li>
          <li>[!] No borra ni sobrescribe evidencia: cada carga es una versión nueva.</li>
        </ul>
      </main>
    </div>
  );
}
