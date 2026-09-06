import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Proof of Skill</h1>
            <p className="text-sm text-zinc-500">Sesión iniciada como {user.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          Todavía no hay criterios de contratación configurados para este empleador.
        </div>
      </div>
    </main>
  );
}
