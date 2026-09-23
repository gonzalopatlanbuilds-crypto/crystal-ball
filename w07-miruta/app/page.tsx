import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Una sola audiencia (el conductor) y ningún concepto de organización —
// a diferencia de w06, aquí "/" solo decide sesión sí/no: sin sesión a
// /login, con sesión a /dashboard. No hay /onboarding.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/dashboard");
}
