import ScreeningCaptureForm from "@/components/ScreeningCaptureForm";
import { crearTamizaje } from "@/app/(caf)/screenings/actions";

export default function NewScreeningPage() {
  return <ScreeningCaptureForm action={crearTamizaje} />;
}
