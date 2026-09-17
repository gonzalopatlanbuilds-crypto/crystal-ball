import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FindingForm from "@/components/FindingForm";
import { crearHallazgo } from "@/app/(app)/findings/actions";

interface ProfileRow {
  id: string;
  display_name: string | null;
  email: string;
}

export default async function NewFindingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle<{ org_id: string }>();
  if (!profile) {
    redirect("/onboarding");
  }

  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("org_id", profile.org_id)
    .order("email")
    .returns<ProfileRow[]>();

  return (
    <FindingForm
      action={crearHallazgo}
      members={(members ?? []).map((m) => ({
        id: m.id,
        label: m.display_name ? `${m.display_name} (${m.email})` : m.email,
      }))}
    />
  );
}
