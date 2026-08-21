import type { AvisoSimulado } from "@/lib/fixtures";
import { generarMensajeSolicitud } from "@/lib/mensaje";

export type EstadoEnvio = "enviando" | "exito" | "error";

type Props = {
  aviso: AvisoSimulado;
  datosObjetados: string[];
  estado: EstadoEnvio;
  mensajeError?: string;
  onReintentar: () => void;
};

export default function PantallaConfirmacion({
  aviso,
  datosObjetados,
  estado,
  mensajeError,
  onReintentar,
}: Props) {
  const mensaje = generarMensajeSolicitud(aviso, datosObjetados);

  if (estado === "enviando") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
        <p className="text-base text-zinc-600">Enviando tu solicitud...</p>
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-zinc-900">
          No pudimos enviar tu solicitud
        </h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {mensajeError ?? "Ocurrió un error inesperado. Intenta de nuevo."}
        </div>
        <button
          type="button"
          onClick={onReintentar}
          className="w-full rounded-full bg-zinc-900 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Tu solicitud fue enviada
        </h1>
        <p className="mt-2 text-base text-zinc-600">
          Guardamos tu solicitud de revisión humana con el siguiente texto:
        </p>
      </div>

      <pre className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-sans text-sm text-zinc-700">
        {mensaje}
      </pre>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Importante</p>
        <p className="mt-1">
          Este envío es una simulación para fines de esta demo — no se
          conecta con un banco real. En un caso real, El Traductor solo
          traduce y redacta tu solicitud: la decisión final siempre la toma
          la entidad financiera, no esta plataforma.
        </p>
      </div>
    </div>
  );
}
