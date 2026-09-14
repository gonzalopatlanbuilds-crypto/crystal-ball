"use client";

import { useActionState, useState } from "react";
import type { ScreeningFormState } from "@/app/(caf)/screenings/actions";
import {
  APELLIDO_MAX_LARGO,
  GLUCOSA_MAX,
  GLUCOSA_MIN,
  NOMBRE_MAX_LARGO,
  RANGOS_EDAD,
  SINTOMAS,
  type RangoEdadValue,
  type SintomaValue,
} from "@/lib/screenings";

interface Props {
  action: (state: ScreeningFormState, formData: FormData) => Promise<ScreeningFormState>;
}

function errorGlucosa(valor: string): string | null {
  if (valor.trim() === "") return "Escribe la lectura de glucosa.";
  if (!/^-?\d+$/.test(valor.trim())) {
    return "La glucosa debe ser un número entero, sin letras ni símbolos.";
  }
  const num = Number(valor);
  if (num < GLUCOSA_MIN || num > GLUCOSA_MAX) {
    return `Valor no plausible — debe estar entre ${GLUCOSA_MIN} y ${GLUCOSA_MAX} mg/dL.`;
  }
  return null;
}

export default function ScreeningCaptureForm({ action }: Props) {
  const [glucosa, setGlucosa] = useState("120");
  const [sintomas, setSintomas] = useState<SintomaValue[]>([]);
  const [ageBand, setAgeBand] = useState<RangoEdadValue>("40_59");
  const [state, formAction, pending] = useActionState<ScreeningFormState, FormData>(
    action,
    undefined
  );

  const invalidoGlucosa = errorGlucosa(glucosa);

  function toggleSintoma(value: SintomaValue) {
    setSintomas((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-2xl p-6">
      <input type="hidden" name="symptoms" value={JSON.stringify(sintomas)} />

      <h1 className="text-lg font-semibold text-zinc-900">Nuevo tamizaje</h1>
      <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Datos simulados — este flujo no captura un padecimiento real de nadie.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="patient_first_name">
            Nombre del paciente
          </label>
          <input
            id="patient_first_name"
            name="patient_first_name"
            maxLength={NOMBRE_MAX_LARGO}
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="patient_last_name">
            Apellido del paciente
          </label>
          <input
            id="patient_last_name"
            name="patient_last_name"
            maxLength={APELLIDO_MAX_LARGO}
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Junto con el folio, esto es lo que el paciente usará para consultar su resultado.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="patient_phone">
          Teléfono (opcional)
        </label>
        <input
          id="patient_phone"
          name="patient_phone"
          inputMode="numeric"
          placeholder="10 dígitos"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-6 rounded-xl bg-zinc-100 p-4">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="glucose_mgdl">
          Lectura de glucosa (mg/dL)
        </label>
        <input
          id="glucose_mgdl"
          name="glucose_mgdl"
          value={glucosa}
          onChange={(e) => setGlucosa(e.target.value)}
          inputMode="numeric"
          className="mt-1 w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        {invalidoGlucosa && <p className="mt-1.5 text-sm text-red-600">{invalidoGlucosa}</p>}
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-zinc-700">Cuestionario de riesgo</legend>

        <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="family_history" className="h-4 w-4" />
          Antecedente familiar de diabetes
        </label>

        <p className="mt-4 text-sm text-zinc-600">Síntomas presentes</p>
        <div className="mt-2 space-y-2">
          {SINTOMAS.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={sintomas.includes(s.value)}
                onChange={() => toggleSintoma(s.value)}
                className="h-4 w-4"
              />
              {s.label}
            </label>
          ))}
        </div>

        <p className="mt-4 text-sm text-zinc-600">Edad</p>
        <div className="mt-2 space-y-2">
          {RANGOS_EDAD.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="radio"
                name="age_band"
                value={r.value}
                checked={ageBand === r.value}
                onChange={() => setAgeBand(r.value)}
                className="h-4 w-4"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <button
          type="submit"
          disabled={pending || !!invalidoGlucosa}
          className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Generar folio"}
        </button>
      </div>

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
