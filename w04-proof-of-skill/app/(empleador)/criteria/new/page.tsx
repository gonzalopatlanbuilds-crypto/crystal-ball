import CriteriaBuilder from "@/components/CriteriaBuilder";
import { createCriteriaSet } from "../actions";

export default function NuevoRolPage() {
  return <CriteriaBuilder action={createCriteriaSet} textoBoton="Guardar set de criterios" />;
}
