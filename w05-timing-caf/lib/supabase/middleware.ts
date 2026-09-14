import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// "/" es la landing pública (elige operador CAF o consulta de paciente),
// no requiere sesión. "/consulta" es todo el árbol de consulta pública del
// paciente — folio + apellido, sin login, sin cuenta, sin app — así que
// vive fuera de cualquier grupo de rutas protegido por auth desde el
// primer commit, nunca por accidente.
const RUTAS_PUBLICAS_EXACTAS = ["/"];
const RUTAS_PUBLICAS_PREFIJO = ["/login", "/auth/callback", "/consulta"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Sin credenciales configuradas dejamos pasar la request tal cual:
    // las páginas server-side lanzarán el error explícito de configuración.
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const esRutaPublica =
    RUTAS_PUBLICAS_EXACTAS.includes(pathname) ||
    RUTAS_PUBLICAS_PREFIJO.some((ruta) => pathname.startsWith(ruta));

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
