import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CafHeader from "@/components/CafHeader";

export default async function CafLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <CafHeader email={user.email} />
      <div className="flex-1 bg-zinc-50">{children}</div>
    </div>
  );
}
