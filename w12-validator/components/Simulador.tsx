"use client";

import { useState } from "react";
import { formatoMxn } from "@/lib/precios";
import {
  aTexto,
  borrarEscenario,
  calcular,
  ETIQUETA_ANUAL,
  guardarEscenario,
  leerCampos,
  leerEscenarios,
  NIVELES_SIM,
  NOMBRE_MAX,
  NOMBRE_NIVEL_SIM,
  recordarUltimo,
  SUPUESTOS_EJEMPLO,
  ultimoEscenario,
  type Almacen,
  type CamposTexto,
  type Escenario,
  type NivelSim,
} from "@/lib/simulador";

// Solo corre en el navegador (SimuladorCliente lo carga con ssr: false),
// así que puede leer localStorage al crear el estado.
function almacen(): Almacen | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function estadoInicial() {
  const a = almacen();
  const { escenarios, error } = leerEscenarios(a);
  const ultimo = ultimoEscenario(a, escenarios);
  return {
    campos: aTexto(ultimo?.supuestos ?? SUPUESTOS_EJEMPLO),
    escenarios,
    aviso: error,
    cargado: ultimo,
  };
}

const formatoClientes = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export default function Simulador() {
  const [inicial] = useState(estadoInicial);
  const [campos, setCampos] = useState<CamposTexto>(inicial.campos);
  const [escenarios, setEscenarios] = useState<Escenario[]>(inicial.escenarios);
  const [aviso, setAviso] = useState<string | null>(inicial.aviso);
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(
    inicial.cargado ? `Se cargó tu último escenario: «${inicial.cargado.nombre}».` : null,
  );

  const { supuestos, errores } = leerCampos(campos);
  const resultado = supuestos ? calcular(supuestos) : null;

  const set = (campo: "leadsMes" | "convDirectoReferidoPct" | "convReferidoPagadoPct", v: string) =>
    setCampos((c) => ({ ...c, [campo]: v }));
  const setNivel = (grupo: "precios" | "mezclaPct", n: NivelSim, v: string) =>
    setCampos((c) => ({ ...c, [grupo]: { ...c[grupo], [n]: v } }));

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supuestos) {
      setAviso("Corrige los supuestos marcados antes de guardar.");
      return;
    }
    const r = guardarEscenario(almacen(), escenarios, nombre, supuestos, crypto.randomUUID(), new Date());
    setAviso(r.error);
    if (!r.error) {
      setEscenarios(r.escenarios);
      setMensaje(`Escenario «${nombre.trim()}» guardado en este navegador.`);
      setNombre("");
    }
  }

  function cargar(esc: Escenario) {
    setCampos(aTexto(esc.supuestos));
    recordarUltimo(almacen(), esc.id);
    setAviso(null);
    setMensaje(`Se cargó «${esc.nombre}».`);
  }

  function borrar(esc: Escenario) {
    const r = borrarEscenario(almacen(), escenarios, esc.id);
    setAviso(r.error);
    if (!r.error) {
      setEscenarios(r.escenarios);
      setMensaje(`Se borró «${esc.nombre}».`);
    }
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-bold text-zinc-900">Supuestos</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Todo lo de esta sección es un supuesto editable, no una medición. Los
        valores iniciales son un ejemplo: cámbialos.
      </p>

      <div className="mt-3 grid gap-3">
        <Supuesto etiqueta="Leads directos por mes" sufijo="leads" error={errores.leadsMes}>
          <Entrada id="leadsMes" valor={campos.leadsMes} onChange={(v) => set("leadsMes", v)} decimal={false} />
        </Supuesto>
        <Supuesto etiqueta="Conversión directo → referido" sufijo="%" error={errores.convDirectoReferidoPct}>
          <Entrada id="convDirectoReferidoPct" valor={campos.convDirectoReferidoPct} onChange={(v) => set("convDirectoReferidoPct", v)} />
        </Supuesto>
        <Supuesto etiqueta="Conversión referido → pagado" sufijo="%" error={errores.convReferidoPagadoPct}>
          <Entrada id="convReferidoPagadoPct" valor={campos.convReferidoPagadoPct} onChange={(v) => set("convReferidoPagadoPct", v)} />
        </Supuesto>

        <fieldset className="rounded-xl border-2 border-dashed border-sky-400 bg-sky-50/40 px-4 py-3">
          <legend className="px-1 text-sm font-semibold text-sky-900">Precio por nivel y mezcla de clientes</legend>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Supuesto: editable, no medido</p>
          <div className="mt-2 grid gap-2">
            {NIVELES_SIM.map((n) => (
              <div key={n} className="grid grid-cols-[5.5rem_1fr_1fr] items-start gap-2 text-sm">
                <span className="pt-2 font-semibold text-zinc-900">{NOMBRE_NIVEL_SIM[n]}</span>
                <label className="block">
                  <span className="sr-only">Precio {NOMBRE_NIVEL_SIM[n]} en MXN por mes</span>
                  <span className="flex items-center gap-1">
                    <span className="text-zinc-600">$</span>
                    <Entrada id={`precio-${n}`} valor={campos.precios[n]} onChange={(v) => setNivel("precios", n, v)} />
                  </span>
                  <span className="text-xs text-zinc-500">MXN/mes</span>
                  {errores[`precio.${n}`] && <span className="block text-xs text-red-700">{errores[`precio.${n}`]}</span>}
                </label>
                <label className="block">
                  <span className="sr-only">Porcentaje de clientes en {NOMBRE_NIVEL_SIM[n]}</span>
                  <span className="flex items-center gap-1">
                    <Entrada id={`mezcla-${n}`} valor={campos.mezclaPct[n]} onChange={(v) => setNivel("mezclaPct", n, v)} />
                    <span className="text-zinc-600">%</span>
                  </span>
                  <span className="text-xs text-zinc-500">de los clientes</span>
                  {errores[`mezcla.${n}`] && <span className="block text-xs text-red-700">{errores[`mezcla.${n}`]}</span>}
                </label>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            Pro de lista es $4,500; pon $3,500 para simular el precio fundador.
            Enterprise es cotización: su precio es tuyo.
          </p>
          {errores.mezcla && <p className="mt-1 text-sm text-red-700">{errores.mezcla}</p>}
        </fieldset>
      </div>

      <h2 className="mt-8 text-lg font-bold text-zinc-900">Proyección</h2>
      {resultado ? (
        <div className="mt-3 rounded-xl border border-zinc-300 px-5 py-4">
          <p className="text-sm text-zinc-600">
            {campos.leadsMes} leads × {campos.convDirectoReferidoPct}% → {formatoClientes.format(resultado.referidosMes)} referidos ×{" "}
            {campos.convReferidoPagadoPct}% → <strong>{formatoClientes.format(resultado.pagadosMes)} clientes que pagan al mes</strong>
          </p>
          <ul className="mt-2 text-sm text-zinc-700">
            {NIVELES_SIM.filter((n) => resultado.porNivel[n].clientes > 0).map((n) => (
              <li key={n}>
                {NOMBRE_NIVEL_SIM[n]}: {formatoClientes.format(resultado.porNivel[n].clientes)} × {formatoMxn(Number(campos.precios[n].replace(/,/g, "")))} ={" "}
                {formatoMxn(resultado.porNivel[n].ingresoMes)}/mes
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-zinc-100 px-4 py-3">
              <dt className="text-sm text-zinc-600">Mensual</dt>
              <dd className="text-2xl font-bold text-zinc-900" data-prueba="mensual">{formatoMxn(resultado.mensual)}</dd>
            </div>
            <div className="rounded-lg bg-zinc-100 px-4 py-3">
              <dt className="text-sm text-zinc-600">{ETIQUETA_ANUAL}</dt>
              <dd className="text-2xl font-bold text-zinc-900" data-prueba="anual">{formatoMxn(resultado.anual)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-zinc-500">
            Proyección hecha con supuestos. No es evidencia ni un ingreso real.
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Corrige los supuestos marcados para ver la proyección.
        </p>
      )}

      <h2 className="mt-8 text-lg font-bold text-zinc-900">Escenarios guardados</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Se guardan solo en este navegador: no pasan a otro dispositivo y se
        pierden si borras los datos del sitio.
      </p>
      <form onSubmit={guardar} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">Nombre del escenario</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={NOMBRE_MAX}
            placeholder="Ej.: conservador, precio fundador"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base"
          />
        </label>
        <button type="submit" className="rounded-lg bg-[#0b5e52] px-4 py-2 font-semibold text-white hover:bg-[#094a41]">
          Guardar escenario
        </button>
      </form>
      <div aria-live="polite">
        {aviso && <p className="mt-2 text-sm text-red-700">{aviso}</p>}
        {mensaje && !aviso && <p className="mt-2 text-sm text-[#0b5e52]">{mensaje}</p>}
      </div>
      {escenarios.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Todavía no hay escenarios guardados en este navegador.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {[...escenarios].reverse().map((esc) => {
            const r = calcular(esc.supuestos);
            return (
              <li key={esc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-4 py-2">
                <span className="min-w-0">
                  <span className="block break-words font-semibold text-zinc-900">{esc.nombre}</span>
                  <span className="text-xs text-zinc-500">
                    {formatoMxn(r.mensual)}/mes · guardado {esc.guardadoEn.slice(0, 10)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => cargar(esc)} className="rounded-lg border border-[#0b5e52] px-3 py-1 text-sm font-semibold text-[#0b5e52]">
                    Cargar
                  </button>
                  <button type="button" onClick={() => borrar(esc)} className="rounded-lg border border-zinc-300 px-3 py-1 text-sm text-zinc-600">
                    Borrar
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Caja de un supuesto: borde punteado azul + etiqueta "Supuesto". Las
// cifras reales de /about van con borde sólido y chip: nunca se ven igual.
function Supuesto({ etiqueta, sufijo, error, children }: { etiqueta: string; sufijo: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-xl border-2 border-dashed border-sky-400 bg-sky-50/40 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">Supuesto: editable, no medido</span>
      <span className="mt-1 block font-semibold text-zinc-900">{etiqueta}</span>
      <span className="mt-1 flex items-center gap-2">
        {children}
        <span className="text-zinc-600">{sufijo}</span>
      </span>
      {error && <span className="mt-1 block text-sm text-red-700">{error}</span>}
    </label>
  );
}

function Entrada({ id, valor, onChange, decimal = true }: { id: string; valor: string; onChange: (v: string) => void; decimal?: boolean }) {
  return (
    <input
      id={id}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      inputMode={decimal ? "decimal" : "numeric"}
      className="w-full min-w-0 max-w-[9rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base"
    />
  );
}
