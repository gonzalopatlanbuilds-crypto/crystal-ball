import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import NavValidador from "@/components/NavValidador";
import { AVISO_SIMULADO } from "@/lib/avisos";

// Segunda puerta (la primera es el middleware): sin sesión → /login, sin
// organización → /onboarding.
export default async function ValidadorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("ValidadorLayout: no se pudo leer el perfil", error);
  }

  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <AppHeader email={user.email} />
      <NavValidador />
      <div className="mx-auto w-full max-w-3xl px-4 pt-4">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {AVISO_SIMULADO}
        </p>
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">{children}</div>
    </div>
  );
}
