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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
