"use client";

import { useState } from "react";
import PantallaOferta from "./PantallaOferta";
import PantallaResultado from "./PantallaResultado";
import PantallaSoporte from "./PantallaSoporte";
import { evaluarOferta, type DatosOferta, type ResultadoVerificacion } from "@/lib/verificacion";

type Paso = "oferta" | "resultado" | "soporte";

export default function VerificaWizard() {
  const [paso, setPaso] = useState<Paso>("oferta");
  const [datos, setDatos] = useState<DatosOferta | null>(null);
  const [resultado, setResultado] = useState<ResultadoVerificacion | null>(null);

  function manejarContinuarOferta(datosOferta: DatosOferta) {
    setDatos(datosOferta);
    setResultado(evaluarOferta(datosOferta));
    setPaso("resultado");
  }

  function reiniciar() {
    setDatos(null);
    setResultado(null);
    setPaso("oferta");
  }

  if (paso === "oferta" || !datos) {
    return <PantallaOferta onContinuar={manejarContinuarOferta} valoresIniciales={datos ?? undefined} />;
  }

  if (paso === "resultado" && resultado) {
    return (
      <PantallaResultado
        datos={datos}
        resultado={resultado}
        onContinuar={() => setPaso("soporte")}
        onVolver={() => setPaso("oferta")}
      />
    );
  }

  if (paso === "soporte" && resultado) {
    return <PantallaSoporte datos={datos} resultado={resultado} onReiniciar={reiniciar} />;
  }

  return null;
}
