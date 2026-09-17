import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForms from "@/components/OnboardingForms";

export default async function OnboardingPage() {
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

  if (profile) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-1 flex-col justify-center p-6">
      <h1 className="text-lg font-semibold text-zinc-900">Un último paso</h1>
      <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Datos simulados — ninguna escuela ni persona aquí es real.
      </p>
      <p className="mt-4 text-sm text-zinc-600">
        Toda la información de hallazgos y cierres se filtra por
        organización: solo quien esté en la misma escuela que tú puede
        verla.
      </p>
      <div className="mt-6">
        <OnboardingForms />
      </div>
    </main>
  );
}
