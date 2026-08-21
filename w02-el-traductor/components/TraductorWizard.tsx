"use client";

import { useState } from "react";
import { avisoSimuladoMarisol } from "@/lib/fixtures";
import { generarMensajeSolicitud } from "@/lib/mensaje";
import { getSupabaseClient } from "@/lib/supabaseClient";
import PantallaRechazo from "./PantallaRechazo";
import PantallaConsentimiento from "./PantallaConsentimiento";
import PantallaConfirmacion, { type EstadoEnvio } from "./PantallaConfirmacion";

type Paso = 1 | 2 | 3;

const TITULOS_PASO: Record<Paso, string> = {
  1: "Rechazo explicado",
  2: "Elige qué objetar",
  3: "Confirmación",
};

export default function TraductorWizard() {
  const [paso, setPaso] = useState<Paso>(1);
  const [datosObjetados, setDatosObjetados] = useState<string[]>([]);
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>("enviando");
  const [mensajeError, setMensajeError] = useState<string>();

  async function enviarSolicitud() {
    setPaso(3);
    setEstadoEnvio("enviando");
    setMensajeError(undefined);

    try {
      const mensajeGenerado = generarMensajeSolicitud(
        avisoSimuladoMarisol,
        datosObjetados
      );

      const { error } = await getSupabaseClient()
        .from("solicitudes_revision")
        .insert({
          aviso_simulado: avisoSimuladoMarisol,
          datos_objetados: datosObjetados,
          mensaje_generado: mensajeGenerado,
        });

      if (error) throw error;

      setEstadoEnvio("exito");
    } catch {
      setEstadoEnvio("error");
      setMensajeError(
        "No se pudo guardar tu solicitud. Revisa tu conexión e intenta de nuevo."
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-8">
      <p className="mb-6 text-sm font-medium text-zinc-400">
        Paso {paso} de 3 · {TITULOS_PASO[paso]}
      </p>

      {paso === 1 && (
        <PantallaRechazo
          aviso={avisoSimuladoMarisol}
          onContinuar={() => setPaso(2)}
        />
      )}
      {paso === 2 && (
        <PantallaConsentimiento
          aviso={avisoSimuladoMarisol}
          seleccion={datosObjetados}
          onCambiarSeleccion={setDatosObjetados}
          onRegresar={() => setPaso(1)}
          onEnviar={enviarSolicitud}
        />
      )}
      {paso === 3 && (
        <PantallaConfirmacion
          aviso={avisoSimuladoMarisol}
          datosObjetados={datosObjetados}
          estado={estadoEnvio}
          mensajeError={mensajeError}
          onReintentar={enviarSolicitud}
        />
      )}
    </div>
  );
}
