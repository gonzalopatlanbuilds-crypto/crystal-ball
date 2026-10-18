import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// "/" nunca renderiza nada, solo decide a dónde mandar a quien llega: sin
// sesión a /login, con sesión pero sin organización a /onboarding, si no a
// /modelo.
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

  if (!user) {
    redirect("/login");
  }

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

  if (!profile) {
    redirect("/onboarding");
  }

  redirect("/modelo");
}
