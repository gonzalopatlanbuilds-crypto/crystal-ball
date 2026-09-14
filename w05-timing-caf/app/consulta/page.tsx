import ConsultaForm from "@/components/ConsultaForm";
import { buscarTamizaje } from "@/app/consulta/actions";

export default function ConsultaPage() {
  return <ConsultaForm action={buscarTamizaje} />;
}
