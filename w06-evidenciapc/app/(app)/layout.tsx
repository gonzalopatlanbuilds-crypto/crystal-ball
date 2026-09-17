import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";

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
      <div className="flex-1 bg-zinc-50">{children}</div>
    </div>
  );
}
