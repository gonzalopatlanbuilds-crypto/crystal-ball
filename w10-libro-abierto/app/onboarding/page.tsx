import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForms from "@/components/OnboardingForms";
import { AVISO_OPERADOR } from "@/lib/avisos";

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
    redirect("/modelo");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-1 flex-col justify-center p-4">
      <h1 className="text-lg font-bold text-zinc-900">Un último paso</h1>
      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {AVISO_OPERADOR}
      </p>
      <p className="mt-4 text-sm text-zinc-600">
        Quienes editan el modelo entran a la misma organización. Cada
        organización solo ve sus propios supuestos y evidencia.
      </p>
      <div className="mt-6">
        <OnboardingForms />
      </div>
    </main>
  );
}
