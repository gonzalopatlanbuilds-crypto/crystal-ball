"use client";

import type { DatosOferta, ResultadoVerificacion } from "@/lib/verificacion";

interface Props {
  datos: DatosOferta;
  resultado: ResultadoVerificacion;
  onContinuar: () => void;
  onVolver: () => void;
}

const ESTILO_SEMAFORO: Record<
  ResultadoVerificacion["color"],
  { fondo: string; texto: string; borde: string; titulo: string }
> = {
  rojo: {
    fondo: "bg-red-50",
    texto: "text-red-800",
    borde: "border-red-300",
    titulo: "Señales de alerta encontradas",
  },
  amarillo: {
    fondo: "bg-amber-50",
    texto: "text-amber-800",
    borde: "border-amber-300",
    titulo: "No se pudo verificar lo suficiente",
  },
  verde: {
    fondo: "bg-green-50",
    texto: "text-green-800",
    borde: "border-green-300",
    titulo: "Señales positivas — sin garantía",
  },
};

export default function PantallaResultado({ datos, resultado, onContinuar, onVolver }: Props) {
  const estilo = ESTILO_SEMAFORO[resultado.color];

  return (
    <div className="mx-auto max-w-2xl w-full">
      <button onClick={onVolver} className="text-sm text-zinc-500 hover:text-zinc-700">
        ← Editar los datos de la oferta
      </button>

      <h1 className="mt-3 text-2xl font-semibold text-zinc-900">Resultado</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {datos.empresa} · {datos.promotor}
      </p>

      <div className={`mt-4 rounded-xl border ${estilo.borde} ${estilo.fondo} p-4`}>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              resultado.color === "rojo"
                ? "bg-red-500"
                : resultado.color === "amarillo"
                  ? "bg-amber-500"
                  : "bg-green-500"
            }`}
          />
          <p className={`font-semibold ${estilo.texto}`}>{estilo.titulo}</p>
        </div>
        <p className={`mt-2 text-sm ${estilo.texto}`}>{resultado.disclaimer}</p>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold text-zinc-900">Qué se verificó y qué no</h2>
        <ul className="mt-2 space-y-3">
          {resultado.senales.map((senal) => (
            <li key={senal.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-zinc-800">{senal.etiqueta}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    senal.verificado
                      ? "bg-green-100 text-green-800"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {senal.verificado ? "Verificado" : "No verificado"}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600">{senal.evidencia}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Fuente: {senal.fuente === "real" ? "cálculo real" : "lista de ejemplo (simulada)"}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold text-zinc-900">
          ¿Cuánto costaría verificar esto de verdad, hoy?
        </h2>
        <p className="mt-1 text-sm text-zinc-500">{resultado.notaCosto}</p>
        <ul className="mt-2 space-y-2">
          {resultado.desgloseCosto.map((item) => (
            <li key={item.concepto} className="rounded-lg border border-zinc-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-zinc-800">{item.concepto}</p>
                <p className="shrink-0 text-zinc-600">{item.costoEstimado}</p>
              </div>
              <p className="mt-1 text-zinc-500">{item.motivo}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-zinc-500">
          Estas herramientas existen, pero se venden a bancos e instituciones,
          no a personas. Por eso Verifica Antes solo puede ofrecerte señales
          parciales, no una verificación completa.
        </p>
      </div>

      <button
        onClick={onContinuar}
        className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-800"
      >
        Continuar
      </button>
    </div>
  );
}
