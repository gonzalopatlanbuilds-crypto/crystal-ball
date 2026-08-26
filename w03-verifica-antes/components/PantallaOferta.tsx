"use client";

import { useState, type FormEvent } from "react";
import type { DatosOferta } from "@/lib/verificacion";

interface Props {
  onContinuar: (datos: DatosOferta) => void;
  valoresIniciales?: DatosOferta;
}

interface Errores {
  empresa?: string;
  promotor?: string;
  clabe?: string;
}

export default function PantallaOferta({ onContinuar, valoresIniciales }: Props) {
  const [empresa, setEmpresa] = useState(valoresIniciales?.empresa ?? "");
  const [promotor, setPromotor] = useState(valoresIniciales?.promotor ?? "");
  const [clabe, setClabe] = useState(valoresIniciales?.clabe ?? "");
  const [errores, setErrores] = useState<Errores>({});

  function validar(): Errores {
    const nuevosErrores: Errores = {};
    if (!empresa.trim()) {
      nuevosErrores.empresa = "Escribe el nombre de la empresa que te ofreció la inversión.";
    }
    if (!promotor.trim()) {
      nuevosErrores.promotor = "Escribe el nombre de la persona que te contactó.";
    }
    const clabeLimpia = clabe.trim();
    if (!clabeLimpia) {
      nuevosErrores.clabe = "Escribe la CLABE de la cuenta a la que te pidieron transferir.";
    } else if (!/^\d{18}$/.test(clabeLimpia)) {
      nuevosErrores.clabe = "Una CLABE tiene exactamente 18 dígitos numéricos.";
    }
    return nuevosErrores;
  }

  function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    const nuevosErrores = validar();
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) return;

    onContinuar({
      empresa: empresa.trim(),
      promotor: promotor.trim(),
      clabe: clabe.trim(),
    });
  }

  return (
    <div className="mx-auto max-w-lg w-full">
      <h1 className="text-2xl font-semibold text-zinc-900">Verifica Antes</h1>
      <p className="mt-2 text-zinc-600">
        Antes de transferir un peso, comparte los datos de la oferta que te
        llegó. Vemos qué se puede verificar y qué no — sin garantías, solo
        señales.
      </p>

      <form onSubmit={manejarEnvio} className="mt-6 space-y-5" noValidate>
        <div>
          <label htmlFor="empresa" className="block text-sm font-medium text-zinc-800">
            Nombre de la empresa
          </label>
          <input
            id="empresa"
            type="text"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
            placeholder="Ej. Inversiones Horizonte SA de CV"
          />
          {errores.empresa && (
            <p className="mt-1 text-sm text-red-600">{errores.empresa}</p>
          )}
        </div>

        <div>
          <label htmlFor="promotor" className="block text-sm font-medium text-zinc-800">
            Nombre del promotor
          </label>
          <input
            id="promotor"
            type="text"
            value={promotor}
            onChange={(e) => setPromotor(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
            placeholder="Ej. Laura Méndez Ibarra"
          />
          {errores.promotor && (
            <p className="mt-1 text-sm text-red-600">{errores.promotor}</p>
          )}
        </div>

        <div>
          <label htmlFor="clabe" className="block text-sm font-medium text-zinc-800">
            CLABE de la cuenta receptora
          </label>
          <input
            id="clabe"
            type="text"
            inputMode="numeric"
            value={clabe}
            onChange={(e) => setClabe(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 font-mono"
            placeholder="18 dígitos"
            maxLength={18}
          />
          {errores.clabe && (
            <p className="mt-1 text-sm text-red-600">{errores.clabe}</p>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-800"
        >
          Ver qué se puede verificar
        </button>
      </form>
    </div>
  );
}
