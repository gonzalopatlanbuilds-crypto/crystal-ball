"use client";

import { useActionState, useState } from "react";
import { cargarEjemplo, subirCsv, type CargaState } from "@/app/validador/actions";
import { TAMANO_MAX_BYTES } from "@/lib/csv";
import TablaRechazadas from "@/components/TablaRechazadas";

export default function FormularioCarga() {
  const [estado, subir, subiendo] = useActionState<CargaState, FormData>(subirCsv, undefined);
  const [estadoEj, ejemplo, cargandoEj] = useActionState<CargaState>(cargarEjemplo, undefined);
  const [nombre, setNombre] = useState<string | null>(null);
  const [avisoTamano, setAvisoTamano] = useState<string | null>(null);
  // Se muestra el resultado de la última acción que terminó.
  const [ultima, setUltima] = useState<"archivo" | "ejemplo">("archivo");
  const resultado = ultima === "archivo" ? estado : estadoEj;
  const ocupado = subiendo || cargandoEj;

  return (
    <div>
      <form action={subir} onSubmit={() => setUltima("archivo")}>
        <label className="relative block cursor-pointer rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center hover:border-[#0b5e52]">
          <span className="block text-sm text-zinc-700">Arrastra tu CSV o selecciona un archivo</span>
          <span className="mt-1 block truncate text-xs text-zinc-500">{nombre ?? `Máximo ${TAMANO_MAX_BYTES / 1024} KB`}</span>
          <input
            type="file"
            name="archivo"
            accept=".csv,text/csv"
            required
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setNombre(f?.name ?? null);
              // Solo un aviso temprano; el límite real lo revisa el servidor.
              setAvisoTamano(f && f.size > TAMANO_MAX_BYTES ? `Este archivo pesa más de ${TAMANO_MAX_BYTES / 1024} KB y será rechazado.` : null);
            }}
          />
        </label>
        {avisoTamano && <p className="mt-2 text-sm text-red-700">{avisoTamano}</p>}
        <button
          type="submit"
          disabled={ocupado}
          className="mt-3 w-full rounded-lg bg-[#0b5e52] px-4 py-3 text-sm font-semibold text-white hover:bg-[#094c43] disabled:opacity-50"
        >
          {subiendo ? "Validando…" : "Validar carga"}
        </button>
      </form>
      <form action={ejemplo} onSubmit={() => setUltima("ejemplo")} className="mt-2">
        <button
          type="submit"
          disabled={ocupado}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {cargandoEj ? "Cargando…" : "Cargar ejemplo (datos simulados)"}
        </button>
      </form>

      {resultado && (
        <div className="mt-4" aria-live="polite">
          {"error" in resultado ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{resultado.error}</div>
          ) : resultado.duplicada ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <strong>{resultado.archivo}</strong> tiene exactamente las mismas filas válidas que la última versión. No se
              guardó una versión nueva y no se crearon hallazgos.
            </div>
          ) : (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
              <strong>{resultado.archivo}</strong> se guardó como una versión nueva: {resultado.aceptadas}{" "}
              {resultado.aceptadas === 1 ? "fila aceptada" : "filas aceptadas"}
              {resultado.rechazadas.length > 0 && `, ${resultado.rechazadas.length} rechazadas (abajo, con su motivo)`}. Nada
              anterior se sobrescribió.
              {resultado.columnasIgnoradas.length > 0 && (
                <span className="mt-1 block text-xs">Columnas ignoradas: {resultado.columnasIgnoradas.join(", ")}.</span>
              )}
            </div>
          )}
          {resultado.rechazadas && resultado.rechazadas.length > 0 && <TablaRechazadas filas={resultado.rechazadas} />}
        </div>
      )}
    </div>
  );
}
