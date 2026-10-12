import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { AVISO_DATOS_SIMULADOS, AVISO_PRACTICA } from "@/lib/avisos";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("org_id, orgs(name)")
    .eq("id", user.id)
    .maybeSingle<{ org_id: string; orgs: { name: string } | null }>();

  if (error) {
    console.error("AppLayout: no se pudo leer el perfil", error);
  }

  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <AppHeader email={user.email} orgName={profile.orgs?.name ?? "Tu organización"} />
      <div className="mx-auto w-full max-w-md px-4 pt-3">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {AVISO_PRACTICA}
        </p>
        <p className="mt-2 text-xs text-zinc-500">{AVISO_DATOS_SIMULADOS}</p>
      </div>
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-4">{children}</div>
    </div>
  );
}
