import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303, no el 307 por defecto: un 307 preserva el método original (este
  // botón es un <form method="post">), así que el navegador reintentaría
  // con POST /login — y /login se sirve estática en Vercel, sin ninguna
  // función atendiendo ese método, lo que devolvía 404. 303 fuerza GET en
  // el siguiente request, como cualquier patrón POST-redirect-GET.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
