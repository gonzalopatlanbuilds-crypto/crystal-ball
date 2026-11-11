import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForms from "@/components/OnboardingForms";
import Aviso from "@/components/Aviso";

export default async function OnboardingPage() {
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

  if (error) {
    console.error("OnboardingPage: no se pudo leer el perfil", error);
  }

  if (profile) {
    redirect("/validador");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
      <h1 className="text-lg font-bold text-zinc-900">Un último paso</h1>
      <Aviso className="mt-2" />
      <p className="mt-4 text-sm text-zinc-600">
        Crea tu organización: tú cargas la evidencia y tú revisas los
        hallazgos. Si ya existe, únete con su código. Cada organización
        solo ve su propia evidencia, hallazgos y decisiones.
      </p>
      <div className="mt-6">
        <OnboardingForms />
      </div>
    </main>
  );
}
