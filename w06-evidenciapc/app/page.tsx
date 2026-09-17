import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Una sola audiencia (coordinador/owner/verificador son el mismo tipo de
// cuenta, distinto solo por acción) — a diferencia de w05, "/" nunca
// renderiza nada, solo decide a dónde mandar a quien llega: sin sesión a
// /login, con sesión pero sin organización a /onboarding, si no a
// /dashboard.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  // Sin este log, un error real de RLS (ej. la política de "profiles" que
  // antes se referenciaba a sí misma — ver sql/schema.sql) llega aquí
  // como `data: null` indistinguible de "todavía no tiene perfil", y el
  // síntoma visible es un loop silencioso de vuelta a /onboarding aunque
  // el perfil sí exista.
  if (error) {
    console.error("Home: no se pudo leer el perfil", error);
  }

  if (!profile) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
