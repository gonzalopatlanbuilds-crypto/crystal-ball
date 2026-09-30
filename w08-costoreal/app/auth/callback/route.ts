import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Cada salida de error queda en los logs de Vercel con un motivo distinto:
// antes todas terminaban en /login sin rastro y sin mensaje en pantalla,
// así que "regresa a /login al primer intento" no se podía diagnosticar
// (ver DECISIONS.md, bug de login en producción).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorSupabase = searchParams.get("error");

  if (errorSupabase) {
    console.error("auth/callback: Supabase devolvió error", {
      origin,
      error: errorSupabase,
      code: searchParams.get("error_code"),
      description: searchParams.get("error_description"),
    });
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (!code) {
    console.error("auth/callback: llegó sin ?code", { origin });
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // El flujo PKCE guarda el code_verifier en una cookie del dominio donde
  // se hizo clic en "Iniciar sesión". Si el callback cae en otro dominio
  // (otra URL de Vercel), la cookie no está y el intercambio falla. Solo
  // se registran NOMBRES de cookies, nunca valores.
  const nombresCookies = (await cookies()).getAll().map((c) => c.name);
  const hayVerifier = nombresCookies.some((n) => n.endsWith("-code-verifier"));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth/callback: exchangeCodeForSession falló", {
      origin,
      hayVerifier,
      cookiesSb: nombresCookies.filter((n) => n.startsWith("sb-")),
      status: error.status,
      code: error.code,
      message: error.message,
    });
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // "/" decide si manda a /onboarding (sin perfil todavía) o a /dashboard.
  return NextResponse.redirect(`${origin}/`);
}
