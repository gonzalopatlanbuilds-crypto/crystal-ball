import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CriteriaBuilder from "@/components/CriteriaBuilder";
import { updateCriteriaSet } from "../actions";

interface CriteriaSetRow {
  id: string;
  role_name: string;
  criteria: { label: string; weight: number }[];
}

export default async function EditarRolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: criteriaSet } = await supabase
    .from("criteria_sets")
    .select("id, role_name, criteria")
    .eq("id", id)
    .maybeSingle<CriteriaSetRow>();

  if (!criteriaSet) {
    notFound();
  }

  return (
    <CriteriaBuilder
      action={updateCriteriaSet.bind(null, criteriaSet.id)}
      valoresIniciales={{
        roleName: criteriaSet.role_name,
        criteria: Array.isArray(criteriaSet.criteria) ? criteriaSet.criteria : [],
      }}
      textoBoton="Guardar cambios"
    />
  );
}
