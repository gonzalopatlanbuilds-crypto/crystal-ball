"use client";

import { useState } from "react";
import { avisoSimuladoMarisol } from "@/lib/fixtures";
import PantallaRechazo from "./PantallaRechazo";
import PantallaConsentimiento from "./PantallaConsentimiento";
import PantallaConfirmacion from "./PantallaConfirmacion";

type Paso = 1 | 2 | 3;

const TITULOS_PASO: Record<Paso, string> = {
  1: "Rechazo explicado",
  2: "Elige qué objetar",
  3: "Confirmación",
};

export default function TraductorWizard() {
  const [paso, setPaso] = useState<Paso>(1);

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
          onRegresar={() => setPaso(1)}
          onEnviar={() => setPaso(3)}
        />
      )}
      {paso === 3 && <PantallaConfirmacion />}
    </div>
  );
}
