import type { AvisoSimulado } from "@/lib/fixtures";

type Props = {
  aviso: AvisoSimulado;
  onContinuar: () => void;
};

export default function PantallaRechazo({ aviso, onContinuar }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Tu solicitud de crédito no fue aprobada
        </h1>
        <p className="mt-2 text-base text-zinc-600">
          Aquí te explicamos, en palabras simples, qué información dice el
          banco que usó. Esto es un aviso simulado para fines de esta demo.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        <p>
          <span className="font-semibold text-zinc-800">Solicitante:</span>{" "}
          {aviso.nombreSolicitante}
        </p>
        <p>
          <span className="font-semibold text-zinc-800">Fecha:</span>{" "}
          {aviso.fechaSolicitud}
        </p>
        <p>
          <span className="font-semibold text-zinc-800">Entidad:</span>{" "}
          {aviso.entidadSimulada}
        </p>
        <p className="mt-2">{aviso.motivoGenerico}</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">
          Datos que probablemente usaron
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {aviso.datosUsados.map((dato) => (
            <li
              key={dato.id}
              className="rounded-lg border border-amber-200 bg-amber-50 p-4"
            >
              <p className="text-sm font-semibold text-amber-900">
                {dato.etiqueta}:{" "}
                <span className="font-normal">{dato.valor}</span>
              </p>
              <p className="mt-1 text-sm text-amber-800">{dato.explicacion}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
        <p className="font-semibold text-zinc-600">
          Ejemplo de lo que dice el aviso (no es un dato que este sistema use)
        </p>
        <p className="mt-1">{aviso.ejemploVinculos}</p>
      </div>

      <button
        type="button"
        onClick={onContinuar}
        className="mt-2 w-full rounded-full bg-zinc-900 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-zinc-700"
      >
        Ver qué puedo hacer
      </button>
    </div>
  );
}
