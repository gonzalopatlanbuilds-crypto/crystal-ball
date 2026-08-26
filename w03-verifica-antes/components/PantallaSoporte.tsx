"use client";

import { useState } from "react";
import type { DatosOferta, ResultadoVerificacion } from "@/lib/verificacion";
import { guardarSolicitudApoyo } from "@/lib/solicitudApoyo";

interface Props {
  datos: DatosOferta;
  resultado: ResultadoVerificacion;
  onReiniciar: () => void;
}

export default function PantallaSoporte({ datos, resultado, onReiniciar }: Props) {
  const [solicitado, setSolicitado] = useState(false);

  function manejarSolicitud() {
    guardarSolicitudApoyo(datos, resultado);
    setSolicitado(true);
  }

  return (
    <div className="mx-auto max-w-2xl w-full">
      <h1 className="text-2xl font-semibold text-zinc-900">Apoyo humano</h1>
      <p className="mt-2 text-zinc-600">
        Un humano puede ayudarte a interpretar las señales que encontramos
        sobre <strong>{datos.empresa}</strong> y{" "}
        <strong>{datos.promotor}</strong> — pero nadie en este equipo
        autoriza, avala ni certifica que una inversión sea segura.
      </p>

      <div className="mt-4 rounded-lg border border-zinc-200 p-4">
        <p className="text-sm font-medium text-zinc-800">Resumen de lo encontrado:</p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-600">
          {resultado.senales.map((senal) => (
            <li key={senal.id}>
              • {senal.etiqueta}: {senal.verificado ? "verificado" : "no verificado"}
            </li>
          ))}
        </ul>
      </div>

      {!solicitado ? (
        <button
          onClick={manejarSolicitud}
          className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-800"
        >
          Solicitar apoyo humano
        </button>
      ) : (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Tu solicitud quedó guardada en este navegador. En una versión real,
          un humano la revisaría y se pondría en contacto contigo — ese
          contacto tampoco decidiría por ti si invertir o no.
        </div>
      )}

      <div className="mt-6 rounded-lg border border-zinc-300 bg-zinc-100 p-4 text-center">
        <p className="font-semibold text-zinc-900">Tú decides. Nunca decimos &ldquo;seguro&rdquo;.</p>
      </div>

      <button
        onClick={onReiniciar}
        className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2.5 font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Verificar otra oferta
      </button>
    </div>
  );
}
