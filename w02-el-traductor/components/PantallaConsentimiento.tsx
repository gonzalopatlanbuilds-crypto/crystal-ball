import type { AvisoSimulado } from "@/lib/fixtures";

type Props = {
  aviso: AvisoSimulado;
  seleccion: string[];
  onCambiarSeleccion: (seleccion: string[]) => void;
  onRegresar: () => void;
  onEnviar: () => void;
};

export default function PantallaConsentimiento({
  aviso,
  seleccion,
  onCambiarSeleccion,
  onRegresar,
  onEnviar,
}: Props) {
  function alternarDato(id: string) {
    if (seleccion.includes(id)) {
      onCambiarSeleccion(seleccion.filter((item) => item !== id));
    } else {
      onCambiarSeleccion([...seleccion, id]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Elige qué datos quieres objetar
        </h1>
        <p className="mt-2 text-base text-zinc-600">
          Marca los datos con los que no estás de acuerdo. Se incluirán en tu
          solicitud de revisión humana.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {aviso.datosUsados.map((dato) => {
          const marcado = seleccion.includes(dato.id);
          return (
            <li key={dato.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  marcado
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternarDato(dato.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-zinc-900"
                />
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">
                    {dato.etiqueta}: {dato.valor}
                  </span>
                  <span className="mt-1 block text-sm text-zinc-600">
                    {dato.explicacion}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Tu derecho, según la LFPDPPP</p>
        <p className="mt-1">
          La Ley Federal de Protección de Datos Personales en Posesión de los
          Particulares (LFPDPPP) te da derecho a acceder, rectificar,
          cancelar u oponerte al uso de tus datos personales (derechos
          ARCO). Puedes pedir que una persona revise tu caso, no solo un
          sistema automático.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRegresar}
          className="w-full rounded-full border border-zinc-300 px-6 py-4 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          Regresar
        </button>
        <button
          type="button"
          onClick={onEnviar}
          className="w-full rounded-full bg-zinc-900 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Enviar solicitud
        </button>
      </div>
    </div>
  );
}
