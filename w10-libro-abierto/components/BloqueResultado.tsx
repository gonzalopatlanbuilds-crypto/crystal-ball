import EstadoBadge from "@/components/EstadoBadge";
import type { Cifra, ResultadoModelo } from "@/lib/modelo";

const mxn = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const razonFmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

// Cada cifra derivada lleva junto el estado de su insumo más débil. Si no
// es calculable, se dice por qué; nunca se muestra un número inventado.
function Linea({ etiqueta, cifra, formato, destacada }: {
  etiqueta: string;
  cifra: Cifra;
  formato: (v: number) => string;
  destacada?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className={destacada ? "font-bold text-red-800" : "text-zinc-900"}>
        {etiqueta}: {cifra.calculable ? formato(cifra.valor) : <span className="text-zinc-600">no calculable ({cifra.motivo})</span>}
      </span>
      {cifra.calculable && <EstadoBadge estado={cifra.estado} />}
    </li>
  );
}

export default function BloqueResultado({ r }: { r: ResultadoModelo }) {
  const f = r.faltante;
  const sobra = f.calculable && f.valor < 0;
  const { umbral, razon, cumple } = r.diezAUno;

  return (
    <section>
      <h2 className="text-base font-bold text-zinc-900">Resultado (derivado: estado = el más débil)</h2>
      <ul className="mt-2 space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[15px]">
        <Linea etiqueta="Costo total" cifra={r.costoMensual} formato={(v) => `MXN ${mxn.format(v)} / mes`} />
        <Linea etiqueta="Ingreso por suscripción" cifra={r.ingresoMensual} formato={(v) => `MXN ${mxn.format(v)} / mes`} />
        {f.calculable ? (
          <Linea
            etiqueta={sobra ? "Sobran" : "Faltan"}
            cifra={{ ...f, valor: Math.abs(f.valor) }}
            formato={(v) => `MXN ${mxn.format(v)} / mes`}
            destacada={!sobra && f.valor > 0}
          />
        ) : (
          <Linea etiqueta="Faltante" cifra={f} formato={(v) => `MXN ${mxn.format(v)}`} />
        )}
        <Linea
          etiqueta="Costo por estudiante atendido"
          cifra={r.costoPorEstudianteAnual}
          formato={(v) => `MXN ${mxn.format(v)} al año`}
        />
        <li className="border-t border-zinc-200 pt-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-zinc-900">
              Chequeo 10:1:{" "}
              {razon.calculable ? (
                <>
                  razón {razonFmt.format(razon.valor)} a 1 — {cumple ? "se cumple" : "no se cumple"}.
                </>
              ) : (
                <>no calculable ({razon.motivo}).</>
              )}
            </span>
            {razon.calculable && <EstadoBadge estado={razon.estado} />}
          </div>
          {umbral.calculable && (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-zinc-600">
              <span>
                Para cerrar el 10:1, cada suscriptor tendría que evitar MXN {mxn.format(umbral.valor)} al año.
              </span>
              <EstadoBadge estado={umbral.estado} />
            </div>
          )}
        </li>
      </ul>
      <p className="mt-2 text-xs text-zinc-500">
        Supone que cada suscriptor paga los 12 meses del año. El costo por estudiante no entra al 10:1.
      </p>
    </section>
  );
}
