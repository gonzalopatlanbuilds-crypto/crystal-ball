// Prueba mecánica de la lógica pura (sin base de datos).
// Uso: npm run test:logica
import { crearOrgSchema, normalizarJoinCode, unirseOrgSchema } from "../lib/orgs.ts";
import {
  calcularModelo,
  estadoMasDebil,
  igualesProfundo,
  pruebaIndependencia,
  type Cifra,
  type ResultadoModelo,
  type Supuesto,
} from "../lib/modelo.ts";
import {
  CATALOGO,
  CLAVES,
  type EstadoSupuesto,
  formatearValor,
  leerFecha,
  leerNumero,
  leerUrl,
  SEMBRADOS,
  validarSupuesto,
  type ValoresSupuesto,
} from "../lib/supuestos.ts";
import { calcularViabilidad, queFalta } from "../lib/viabilidad.ts";
import { TIPOS_EVIDENCIA, validarEvidencia, type ValoresEvidencia } from "../lib/pagador.ts";
import { construirLibro, leerLibro, QUE_DATOS_GUARDAMOS } from "../lib/libro.ts";
import { sqlLibroPublico } from "../lib/libro-publico.ts";
import { AVISO_PUBLICO } from "../lib/avisos.ts";
import { entradaAuditor } from "../lib/auditor.ts";
import { numerosEnTexto, revisarObservacionesIA } from "../lib/guardia-auditor.ts";
import { chequeoPorReglas } from "../lib/chequeo-reglas.ts";

let ok = 0;
let fail = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  if (cond) {
    ok++;
    console.log("PASS", nombre);
  } else {
    fail++;
    console.log("FAIL", nombre, JSON.stringify(detalle));
  }
}

// ---------- Feature 1: código de organización ----------
check("normaliza 'abc234' → 'ABC-234'", normalizarJoinCode("abc234") === "ABC-234");
check("normaliza ' abc-234 ' → 'ABC-234'", normalizarJoinCode(" abc-234 ") === "ABC-234");
check("normaliza 'ab c2 34' → 'ABC-234'", normalizarJoinCode("ab c2 34") === "ABC-234");
const unirse = (v: string) => unirseOrgSchema.safeParse({ joinCode: v });
check("código válido se acepta", unirse("xk7-m2p").success);
for (const malo of ["", "ABC-23", "ABC-2345", "AB0-234", "AB1-234", "ABC_234", "<script>"]) {
  check(`código '${malo}' rechazado (forma ABC-234, sin 0 ni 1)`, !unirse(malo).success);
}
const crear = (v: string) => crearOrgSchema.safeParse({ name: v });
check("nombre de org de 1 carácter rechazado", !crear("x").success);
check("nombre de org de solo espacios rechazado", !crear("    ").success);
check("nombre de org de 120 caracteres aceptado", crear("x".repeat(120)).success);
check("nombre de org de 121 caracteres rechazado", !crear("x".repeat(121)).success);

// ---------- Feature 2: validación de supuestos ----------
check("leerNumero '150' → 150", JSON.stringify(leerNumero("150")) === '{"valor":150}');
check("leerNumero '2,5' → 2.5 (coma decimal)", JSON.stringify(leerNumero("2,5")) === '{"valor":2.5}');
check("leerNumero '2.5' → 2.5", JSON.stringify(leerNumero("2.5")) === '{"valor":2.5}');
check("leerNumero '3 %' → 3", JSON.stringify(leerNumero("3 %")) === '{"valor":3}');
check("leerNumero '0,035' → 0.035 (empieza en 0: no es separador de miles)", JSON.stringify(leerNumero("0,035")) === '{"valor":0.035}');
for (const malo of ["", "abc", "1e3", "NaN", "Infinity", "-Infinity", "0x10", "10..5", "--3", "1,234.5", "1.234,5", "2,000", "1.500", "2,000,000", "1 000"]) {
  check(`leerNumero rechaza '${malo}'`, "error" in leerNumero(malo), leerNumero(malo));
}
const miles = leerNumero("2,000");
check("'2,000' pide escribirlo sin separador (sugiere 2000)", "error" in miles && miles.error.includes("2000"), miles);
check("leerNumero rechaza más de 4 decimales", "error" in leerNumero("1,23456"));

const HOY = new Date(Date.UTC(2026, 9, 18));
check("leerFecha '' → null", JSON.stringify(leerFecha("", HOY)) === '{"valor":null}');
check("leerFecha '2026-09-01' → ok", JSON.stringify(leerFecha("2026-09-01", HOY)) === '{"valor":"2026-09-01"}');
for (const malo of ["2026-02-30", "2026-13-01", "01/09/2026", "2026-9-1", "1989-12-31", "2026-10-20", "mañana"]) {
  check(`leerFecha rechaza '${malo}'`, "error" in leerFecha(malo, HOY), leerFecha(malo, HOY));
}
check("leerUrl acepta https://", JSON.stringify(leerUrl(" https://ejemplo.org/estudio ")) === '{"valor":"https://ejemplo.org/estudio"}');
for (const malo of ["ejemplo.org", "javascript:alert(1)", "ftp://x.org", "https://" + "x".repeat(500)]) {
  check(`leerUrl rechaza '${malo.slice(0, 30)}'`, "error" in leerUrl(malo));
}

const base: ValoresSupuesto = { key: "costo_hora", value_num: "150", status: "invented", source_url: "", source_date: "", note: "" };
const vs = (o: Partial<ValoresSupuesto>) => validarSupuesto({ ...base, ...o }, HOY);
const okInv = vs({});
check("invented sin fuente → ok, unidad la pone el catálogo", okInv.ok && okInv.datos.unit === "MXN/hora" && okInv.datos.source_url === null, okInv);
check("weak sin fuente → ok", vs({ status: "weak" }).ok);
const sinFuente = vs({ status: "sustained" });
check("sustained sin URL ni fecha → error en ambos campos",
  !sinFuente.ok && !!sinFuente.errores.source_url && !!sinFuente.errores.source_date, sinFuente);
const sinFecha = vs({ status: "sustained", source_url: "https://ejemplo.org" });
check("sustained sin fecha → error solo en la fecha", !sinFecha.ok && Object.keys(sinFecha.errores).join() === "source_date", sinFecha);
const conFuente = vs({ status: "sustained", source_url: "https://ejemplo.org", source_date: "2026-09-01" });
check("sustained con URL y fecha → ok", conFuente.ok && conFuente.datos.source_date === "2026-09-01", conFuente);
check("clave fuera del catálogo → error", !vs({ key: "comision" }).ok);
check("estado inventado ('aprobado') → error", !vs({ status: "aprobado" }).ok);
check("valor negativo → error de rango", !vs({ value_num: "-1" }).ok);
check("conversión 101% → error de rango", !vs({ key: "conversion_suscripcion", value_num: "101" }).ok);
check("conversión 3,5% → ok", vs({ key: "conversion_suscripcion", value_num: "3,5" }).ok);
check("estudiantes 2000,5 → error (debe ser entero)", !vs({ key: "estudiantes_anio", value_num: "2000,5" }).ok);
check("horas 745 al mes → error (un mes tiene ≤ 744)", !vs({ key: "horas_mantenimiento_mes", value_num: "745" }).ok);
check("nota de 501 caracteres → error", !vs({ note: "x".repeat(501) }).ok);
check("nota de 500 caracteres → ok", vs({ note: "x".repeat(500) }).ok);
check("nota vacía → null", (() => { const x = vs({ note: "   " }); return x.ok && x.datos.note === null; })());
const varios = vs({ value_num: "1e3", status: "sustained", source_url: "x" });
check("varios errores a la vez, cada uno en su campo",
  !varios.ok && !!varios.errores.value_num && !!varios.errores.source_url && !!varios.errores.source_date, varios);
check("todos los máximos del catálogo ≤ 10,000,000 (constraint assumptions_value_range)",
  Object.values(CATALOGO).every((d) => d.min >= 0 && d.max <= 10_000_000));
check("sembrados = 7, todos dentro de su rango", SEMBRADOS.length === 7 &&
  SEMBRADOS.every((x) => x.value_num >= CATALOGO[x.key].min && x.value_num <= CATALOGO[x.key].max));
check("formatearValor: 2000 → '2,000', 3 → '3%'", formatearValor("estudiantes_anio", 2000) === "2,000" && formatearValor("conversion_suscripcion", "3.0000") === "3%");

// ---------- Feature 3: modelo determinista ----------
// Los valores sembrados del mockup (todos inventados). Unidades: estudiantes
// por año, conversión en porcentaje, precio en MXN por mes (DECISIONS.md,
// "Fórmula del ingreso por suscripción: sin /12").
const SEMBRADOS_MODELO: Supuesto[] = SEMBRADOS.map((s) => ({ ...s, status: "invented" as const }));
const valor = (c: Cifra) => (c.calculable ? c.valor : null);
const estado = (c: Cifra) => (c.calculable ? c.estado : null);

const m = calcularModelo(SEMBRADOS_MODELO);
check("valores sembrados: costo 7,500 / ingreso 2,940 / faltante 4,560 (mockup, sin /12)",
  valor(m.costoMensual) === 7500 && valor(m.ingresoMensual) === 2940 && valor(m.faltante) === 4560, m);
check("líneas de costo del mockup público: mantenimiento 6,000 / correcciones 1,000 / infraestructura 500",
  valor(m.mantenimiento) === 6000 && valor(m.correcciones) === 1000 && valor(m.infraestructura) === 500, m);
check("60 suscriptores (2,000 × 3%), exacto", valor(m.suscriptores) === 60, m.suscriptores);
check("costo por estudiante atendido: 7,500 × 12 ÷ 2,000 = 45 al año", valor(m.costoPorEstudianteAnual) === 45, m.costoPorEstudianteAnual);
check("10:1 sin pérdida evitada → no calculable, y cumple = null",
  !m.diezAUno.razon.calculable && m.diezAUno.cumple === null, m.diezAUno);
check("10:1 sin insumo dice 'falta el valor evitado'",
  !m.diezAUno.razon.calculable && m.diezAUno.razon.motivo === "falta el valor evitado", m.diezAUno.razon);
check("umbral visible aunque falte el insumo: pago anual 588, umbral 5,880",
  valor(m.diezAUno.pagoAnualSuscriptor) === 588 && valor(m.diezAUno.umbral) === 5880, m.diezAUno);
check("todo lo derivado de insumos inventados es 'invented'",
  [m.costoMensual, m.ingresoMensual, m.faltante, m.costoPorEstudianteAnual, m.diezAUno.umbral].every((c) => estado(c) === "invented"));

const conPerdida = (v: number) => calcularModelo([...SEMBRADOS_MODELO, { key: "perdida_evitada_suscriptor_anio", value_num: v, status: "invented" }]);
check("pérdida evitada 5,880 → razón 10, cumple (borde incluido)", (() => { const r = conPerdida(5880).diezAUno; return valor(r.razon) === 10 && r.cumple === true; })());
check("pérdida evitada 5,879 → no cumple", conPerdida(5879).diezAUno.cumple === false);
// 10 × (40.06 × 12) en punto flotante = 4807.200000000001 (> 4807.2).
const precioDecimal = (v: number) => calcularModelo([...SEMBRADOS_MODELO.map((s) => (s.key === "precio_mensual" ? { ...s, value_num: 40.06 } : s)),
  { key: "perdida_evitada_suscriptor_anio", value_num: v, status: "invented" }]).diezAUno.cumple;
check("precio 40,06: pérdida 4,807.2 = 10 × 480.72 exacto → cumple (sin error de punto flotante)", precioDecimal(4807.2) === true);
check("precio 40,06: pérdida 4,807.19 → no cumple", precioDecimal(4807.19) === false);
check("pérdida evitada 0 → razón 0, no cumple (el 0 sí es un dato)", (() => { const r = conPerdida(0).diezAUno; return valor(r.razon) === 0 && r.cumple === false; })());

// Independencia: sponsor A, B y ninguno → resultado idéntico (deep equal),
// con los sembrados, con insumos faltantes y con 300 casos al azar
// (PRNG con semilla fija: la prueba es reproducible).
const SPONSORS: unknown[] = [undefined, null, "Patrocinador simulado A", "Patrocinador simulado B", { nombre: "B", paga: 1e6 }, 0, ""];
const independiente = (s: Supuesto[]) => {
  const base = calcularModelo(s);
  return SPONSORS.every((sponsor) => igualesProfundo(base, calcularModelo(s, { sponsor })));
};
check("sponsor A / B / ninguno: deep equal con los sembrados", independiente(SEMBRADOS_MODELO));
check("pruebaIndependencia() (la que muestra la página) da OK con los sembrados", pruebaIndependencia(SEMBRADOS_MODELO));
check("independencia también con insumos faltantes", independiente(SEMBRADOS_MODELO.slice(2)));
check("independencia con lista vacía", independiente([]));
check("igualesProfundo sí detecta una diferencia (la prueba no es trivial)",
  !igualesProfundo(calcularModelo(SEMBRADOS_MODELO), conPerdida(1)));

let semilla = 20261018;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const ESTADOS_M: EstadoSupuesto[] = ["sustained", "weak", "invented"];
const FUERZA: Record<string, number> = { invented: 0, weak: 1, sustained: 2 };
const casos: Supuesto[][] = [];
for (let i = 0; i < 300; i++) {
  casos.push(
    CLAVES.filter(() => azar() > 0.15).map((key) => ({
      key,
      value_num: azar() < 0.1 ? 0 : Math.round(azar() * 5000 * 100) / 100,
      status: ESTADOS_M[Math.floor(azar() * 3)],
    }))
  );
}
check("independencia en 300 casos al azar (con faltantes y ceros)", casos.every(independiente));

// Herencia del estado: ninguna cifra derivada es más fuerte que su insumo
// más débil, en los 300 casos.
const cifras = (r: ResultadoModelo): Cifra[] => [r.mantenimiento, r.correcciones, r.infraestructura, r.costoMensual, r.suscriptores,
  r.ingresoMensual, r.faltante, r.costoPorEstudianteAnual, r.diezAUno.pagoAnualSuscriptor, r.diezAUno.umbral, r.diezAUno.razon];
const herenciaOk = casos.every((s) => cifras(calcularModelo(s)).every((c) => {
  if (!c.calculable) return true;
  const debil = Math.min(...c.insumos.map((k) => FUERZA[s.find((x) => x.key === k)!.status]));
  return FUERZA[c.estado] === debil && c.insumos.length > 0;
}));
check("estado derivado = el más débil de sus insumos, en 300 casos", herenciaOk);
const unoInventado = SEMBRADOS_MODELO.map((s) => ({ ...s, status: "sustained" as EstadoSupuesto }));
unoInventado[3] = { ...unoInventado[3], status: "invented" }; // conversión
const mi = calcularModelo(unoInventado);
check("un solo insumo inventado (conversión) → ingreso y faltante 'invented'",
  estado(mi.ingresoMensual) === "invented" && estado(mi.faltante) === "invented", mi);
check("…pero el costo (que no usa la conversión) sigue 'sustained'", estado(mi.costoMensual) === "sustained", mi.costoMensual);
const unoDebil = unoInventado.map((s) => (s.key === "conversion_suscripcion" ? { ...s, status: "weak" as EstadoSupuesto } : s));
check("con conversión 'weak' y lo demás sustentado → ingreso 'weak'", estado(calcularModelo(unoDebil).ingresoMensual) === "weak");
check("todo sustentado → ingreso 'sustained'", estado(calcularModelo(unoInventado.map((s) => ({ ...s, status: "sustained" as EstadoSupuesto }))).ingresoMensual) === "sustained");
check("estadoMasDebil", estadoMasDebil(["sustained", "weak"]) === "weak" && estadoMasDebil(["weak", "invented", "sustained"]) === "invented" && estadoMasDebil([]) === "invented");

// Vacíos y ceros: "no calculable", nunca un número.
const vacio = calcularModelo([]);
check("sin supuestos → todas las cifras no calculables", cifras(vacio).every((c) => !c.calculable) && vacio.diezAUno.cumple === null, vacio);
const sinEst = (v: number | null) => calcularModelo(SEMBRADOS_MODELO.filter((s) => s.key !== "estudiantes_anio")
  .concat(v === null ? [] : [{ key: "estudiantes_anio", value_num: v, status: "invented" }]));
const cero = sinEst(0);
check("0 estudiantes → ingreso, suscriptores, faltante y costo por estudiante no calculables",
  !cero.ingresoMensual.calculable && !cero.suscriptores.calculable && !cero.faltante.calculable && !cero.costoPorEstudianteAnual.calculable, cero);
check("0 estudiantes → el motivo lo dice", !cero.ingresoMensual.calculable && cero.ingresoMensual.motivo.includes("estudiantes al año es 0"), cero.ingresoMensual);
check("0 estudiantes → el costo sí se calcula (no depende de ellos)", valor(cero.costoMensual) === 7500);
check("sin estudiantes → motivo 'falta estudiantes al año'", (() => { const c = sinEst(null).ingresoMensual; return !c.calculable && c.faltan.join() === "estudiantes_anio"; })());
const precio0 = calcularModelo(SEMBRADOS_MODELO.map((s) => (s.key === "precio_mensual" ? { ...s, value_num: 0 } : s)));
check("precio 0 → umbral 10:1 e ingreso no calculables", !precio0.diezAUno.umbral.calculable && !precio0.ingresoMensual.calculable, precio0.diezAUno);
const conv0 = calcularModelo(SEMBRADOS_MODELO.map((s) => (s.key === "conversion_suscripcion" ? { ...s, value_num: 0 } : s)));
check("conversión 0% → ingreso 0 (un dato válido: nadie se suscribe) y faltante 7,500",
  valor(conv0.ingresoMensual) === 0 && valor(conv0.faltante) === 7500, conv0);
const sinHoras = calcularModelo(SEMBRADOS_MODELO.filter((s) => s.key !== "horas_mantenimiento_mes"));
check("sin horas → mantenimiento, costo total, faltante y costo por estudiante no calculables",
  !sinHoras.mantenimiento.calculable && !sinHoras.costoMensual.calculable && !sinHoras.faltante.calculable && !sinHoras.costoPorEstudianteAnual.calculable, sinHoras);
check("sin horas → correcciones e infraestructura sí", valor(sinHoras.correcciones) === 1000 && valor(sinHoras.infraestructura) === 500);
check("sin horas → el faltante dice qué falta", !sinHoras.faltante.calculable && sinHoras.faltante.faltan.join() === "horas_mantenimiento_mes", sinHoras.faltante);
const nan = calcularModelo(SEMBRADOS_MODELO.map((s) => (s.key === "costo_hora" ? { ...s, value_num: NaN } : s)));
check("valor NaN cuenta como faltante, nunca como número", !nan.mantenimiento.calculable && !nan.costoMensual.calculable, nan.mantenimiento);
check("ingreso mayor que el costo → faltante negativo (sobra), calculable",
  valor(calcularModelo(SEMBRADOS_MODELO.map((s) => (s.key === "conversion_suscripcion" ? { ...s, value_num: 10 } : s))).faltante) === 7500 - 9800);

// Pureza: no muta la entrada y es determinista.
const congelados = Object.freeze(SEMBRADOS_MODELO.map((s) => Object.freeze({ ...s })));
let mutó = false;
try { calcularModelo(congelados); } catch { mutó = true; }
check("no muta la entrada (funciona con objetos congelados)", !mutó);
check("determinista: 2 llamadas → deep equal", igualesProfundo(calcularModelo(SEMBRADOS_MODELO), calcularModelo(SEMBRADOS_MODELO)));
check("el orden de los supuestos no cambia el resultado",
  igualesProfundo(calcularModelo(SEMBRADOS_MODELO), calcularModelo([...SEMBRADOS_MODELO].reverse())));

// ---------- Feature 4: viabilidad, evidencia y snapshot ----------
const TODOS_SUSTENTADOS: Supuesto[] = [
  ...SEMBRADOS_MODELO.map((s) => ({ ...s, status: "sustained" as EstadoSupuesto })),
  { key: "perdida_evitada_suscriptor_anio", value_num: 6000, status: "sustained" },
];
check("sin evidencia → NOT_DEMONSTRATED aunque todo esté sustentado y el 10:1 se cumpla",
  calcularViabilidad(false, TODOS_SUSTENTADOS) === "NOT_DEMONSTRATED");
check("sin evidencia → nunca SUPPORTED, en los 300 casos al azar",
  casos.every((s) => calcularViabilidad(false, s) === "NOT_DEMONSTRATED"));
check("evidencia + 8 sustentados + 10:1 cumplido → SUPPORTED", calcularViabilidad(true, TODOS_SUSTENTADOS) === "SUPPORTED");
check("evidencia + sembrados inventados → EVIDENCE_RECORDED_NOT_SUPPORTED",
  calcularViabilidad(true, SEMBRADOS_MODELO) === "EVIDENCE_RECORDED_NOT_SUPPORTED");
check("evidencia + uno 'weak' → no SUPPORTED",
  calcularViabilidad(true, TODOS_SUSTENTADOS.map((s, i) => (i === 0 ? { ...s, status: "weak" as EstadoSupuesto } : s))) === "EVIDENCE_RECORDED_NOT_SUPPORTED");
check("evidencia + todo sustentado pero 10:1 no cumplido (5,000 < 5,880) → no SUPPORTED",
  calcularViabilidad(true, TODOS_SUSTENTADOS.map((s) => (s.key === "perdida_evitada_suscriptor_anio" ? { ...s, value_num: 5000 } : s))) === "EVIDENCE_RECORDED_NOT_SUPPORTED");
check("evidencia + falta la pérdida evitada → no SUPPORTED",
  calcularViabilidad(true, TODOS_SUSTENTADOS.filter((s) => s.key !== "perdida_evitada_suscriptor_anio")) === "EVIDENCE_RECORDED_NOT_SUPPORTED");
check("la viabilidad tampoco depende del sponsor (no lo recibe)", calcularViabilidad.length === 2);
check("queFalta sin nada: evidencia, supuestos y 10:1", queFalta(false, SEMBRADOS_MODELO).length === 3, queFalta(false, SEMBRADOS_MODELO));
check("queFalta con todo listo: vacío", queFalta(true, TODOS_SUSTENTADOS).length === 0, queFalta(true, TODOS_SUSTENTADOS));

const ev = (o: Partial<ValoresEvidencia>) => validarEvidencia({ kind: "carta_intencion", description: "Universidad simulada pagaría la cobertura un semestre.", document_ref: "Folio SIM-001", recorded_on: "2026-10-01", ...o }, HOY);
check("evidencia válida → ok", ev({}).ok, ev({}));
check("tipo fuera de la lista ('comision') → error", !ev({ kind: "comision" }).ok);
check("descripción vacía → error bajo la descripción", (() => { const x = ev({ description: "   " }); return !x.ok && Object.keys(x.errores).join() === "description"; })());
check("descripción de 1001 → error", !ev({ description: "x".repeat(1001) }).ok);
check("referencia vacía → error", !ev({ document_ref: "" }).ok);
check("referencia de 301 → error", !ev({ document_ref: "x".repeat(301) }).ok);
check("fecha vacía → error", !ev({ recorded_on: "" }).ok);
check("fecha futura → error", !ev({ recorded_on: "2026-12-01" }).ok);
check("fecha inexistente → error", !ev({ recorded_on: "2026-02-30" }).ok);
const evVarios = ev({ kind: "", description: "", document_ref: "", recorded_on: "x" });
check("cuatro errores a la vez, cada uno en su campo", !evVarios.ok && Object.keys(evVarios.errores).length === 4, evVarios);
check("ningún tipo de evidencia se llama comisión/afiliado/referido",
  Object.keys(TIPOS_EVIDENCIA).every((k) => !/comisi|commission|afiliad|affiliat|referid|referral/i.test(k)));

const conUnidad = (s: Supuesto[]) => s.map((x) => ({ ...x, unit: CATALOGO[x.key as keyof typeof CATALOGO].unidad, source_url: null, source_date: null }));
const libro = construirLibro(conUnidad(SEMBRADOS_MODELO), [{ kind: "carta_intencion", simulada: true }, { kind: "carta_intencion", simulada: false }], "EVIDENCE_RECORDED_NOT_SUPPORTED");
check("snapshot: total 7,500, faltante 4,560, viabilidad igual a la recibida",
  valor(libro.costos.total) === 7500 && valor(libro.faltante) === 4560 && libro.viabilidad === "EVIDENCE_RECORDED_NOT_SUPPORTED", libro);
check("snapshot: evidencia como conteo y tipos, sin descripción ni referencia",
  libro.evidencia_pagador.registros === 2 && libro.evidencia_pagador.tipos.join() === "carta_intencion", libro.evidencia_pagador);
check("snapshot (formato 2): cuenta cuántas evidencias son simuladas (1 de 2)", libro.evidencia_pagador.simuladas === 1, libro.evidencia_pagador);
check("snapshot (formato 2): datos_simulados = true y el aviso dentro del contenido",
  libro.formato === 2 && libro.datos_simulados === true && libro.aviso_datos_simulados === AVISO_PUBLICO && /simulados/i.test(libro.aviso_datos_simulados ?? ""), libro);
const sinEvidencia = construirLibro(conUnidad(SEMBRADOS_MODELO), [], "NOT_DEMONSTRATED");
check("snapshot sin evidencia: registros 0, simuladas 0 (número, no ausente)", sinEvidencia.evidencia_pagador.registros === 0 && sinEvidencia.evidencia_pagador.simuladas === 0);
const v1 = JSON.parse(JSON.stringify(libro));
v1.formato = 1; delete v1.datos_simulados; delete v1.aviso_datos_simulados; delete v1.evidencia_pagador.simuladas;
check("leerLibro sigue leyendo un snapshot formato 1 (v1 ya publicado, inmutable)", leerLibro(v1) !== null);
check("'Qué datos guardamos' dice que todas las versiones publicadas son públicas",
  QUE_DATOS_GUARDAMOS.includes("Todas las versiones publicadas son públicas."));
check("sqlLibroPublico: filtra oficial, ordena por fecha desc y toma 1",
  /where oficial = true order by published_at desc, version desc limit 1$/.test(sqlLibroPublico()), sqlLibroPublico());
check("snapshot marcado como simulado y con independencia verificada", libro.simulado === true && libro.independencia_verificada === true);
const claves: string[] = [];
JSON.stringify(libro, (k, v) => { if (k) claves.push(k); return v; });
check("snapshot: ninguna clave de dato personal o texto libre (note, description, document_ref, recorded_by, email, name, id)",
  !claves.some((k) => /^(note|description|document_ref|recorded_by|email|display_name|name|org_id|id|user)$/i.test(k)), [...new Set(claves)]);
check("snapshot: ninguna clave de comisión/afiliado/referido",
  !claves.some((k) => /comisi|commission|afiliad|affiliat|referid|referral/i.test(k)));
check("snapshot: sin '@' (la base rechaza correos dentro del contenido)", !JSON.stringify(libro).includes("@"));
check("snapshot pesa < 64 KB (constraint published_ledger_content_size)", JSON.stringify(libro).length < 65536);
check("leerLibro acepta el snapshot real (ida y vuelta por JSON, como desde la base)", leerLibro(JSON.parse(JSON.stringify(libro))) !== null);
for (const [nombre, malo] of [["null", null], ["texto", "hola"], ["sin costos", { formato: 1, viabilidad: "SUPPORTED" }],
  ["formato futuro", { ...libro, formato: 3 }], ["cifra con valor texto", { ...libro, costos: { ...libro.costos, total: { calculable: true, valor: "7500", estado: "invented" } } }]] as [string, unknown][]) {
  check(`leerLibro rechaza un snapshot con forma inesperada (${nombre})`, leerLibro(malo) === null);
}

// ---------- Feature 5: guardia del auditor de IA y revisión por reglas ----------
const AUDITABLES = conUnidad(SEMBRADOS_MODELO).map((s) => ({ ...s, source_url: null as string | null, source_date: null as string | null }));
const entradaIA = entradaAuditor(AUDITABLES);
const clavesIA = [...CLAVES];
const g = (obs: unknown) => revisarObservacionesIA(obs, entradaIA, clavesIA);
check("entrada del auditor: claves, valores, estados y fuentes; NUNCA notas", entradaIA.includes("conversion_suscripcion") && entradaIA.includes("inventado") && !/"note"|"nota"/.test(entradaIA));
check("entrada del auditor: lista las claves sin registrar (pérdida evitada)", entradaIA.includes("perdida_evitada_suscriptor_anio"));
check("guardia: lista vacía pasa (la IA puede no encontrar nada)", g([]).length === 0);
check("guardia: observaciones descriptivas con cifras de la entrada pasan", g([
  { clave: "conversion_suscripcion", texto: "La conversión de 3% no tiene fuente." },
  { clave: "estudiantes_anio", texto: "Los 2,000 estudiantes al año están marcados como inventados." },
  { clave: "general", texto: "Ningún supuesto de la lista tiene URL ni fecha de fuente." },
]).length === 0, g([{ clave: "conversion_suscripcion", texto: "La conversión de 3% no tiene fuente." }]));
for (const [nombre, obs] of [
  ["cifra nueva (calculada)", { clave: "general", texto: "El costo mensual sería de 7,500 con estos datos." }],
  ["cifra nueva (60 suscriptores)", { clave: "conversion_suscripcion", texto: "Con 3% saldrían 60 suscriptores sin fuente." }],
  ["veredicto: viable", { clave: "general", texto: "Con estos supuestos el proyecto no es viable." }],
  ["veredicto: viabilidad", { clave: "general", texto: "La falta de fuentes afecta la viabilidad del modelo." }],
  ["veredicto: rentable", { clave: "precio_mensual", texto: "El precio de 49 no parece rentable." }],
  ["veredicto: recomendado", { clave: "general", texto: "Se recomienda buscar una fuente para la conversión." }],
  ["veredicto: garantizado", { clave: "general", texto: "Nada aquí está garantizado por una fuente." }],
  ["alianza: patrocinador", { clave: "general", texto: "Un patrocinador podría cubrir los costos sin fuente." }],
  ["alianza: convenio", { clave: "general", texto: "Falta un convenio que respalde estos supuestos." }],
  ["referidos", { clave: "general", texto: "El ingreso podría venir de comisiones por referido." }],
  ["cifra en palabras", { clave: "conversion_suscripcion", texto: "La conversión de tres por ciento no tiene fuente." }],
  ["clave inventada", { clave: "sponsor_bonus", texto: "Este supuesto no tiene fuente registrada." }],
  ["texto vacío", { clave: "general", texto: "corto" }],
  ["no es objeto", "La conversión no tiene fuente."],
] as [string, unknown][]) {
  check(`guardia rechaza: ${nombre}`, g([obs]).length > 0, g([obs]));
}
check("guardia acepta una clave del catálogo que no está registrada (pérdida evitada) — bug de la 1a corrida real", g([{ clave: "perdida_evitada_suscriptor_anio", texto: "Esta clave aparece sin registrar y no tiene valor ni fuente." }]).length === 0, g([{ clave: "perdida_evitada_suscriptor_anio", texto: "Esta clave aparece sin registrar y no tiene valor ni fuente." }]));
check("guardia rechaza contar supuestos ('Los 8 supuestos')", g([{ clave: "general", texto: "Los 8 supuestos citan la misma fuente genérica." }]).length > 0);
check("guardia rechaza 'conviene verificar' (no sugiere acciones)", g([{ clave: "general", texto: "La fecha se repite; conviene verificar que sea correcta." }]).length > 0);
check("entrada del auditor trae la fecha de hoy", /"fecha_de_hoy": "\d{4}-\d{2}-\d{2}"/.test(entradaIA));
check("guardia rechaza más de 6 observaciones", g(Array.from({ length: 7 }, () => ({ clave: "general", texto: "Ningún supuesto tiene fuente." }))).length > 0);
check("guardia rechaza algo que no es lista", g({ observaciones: [] }).length > 0);
check("guardia: un solo problema rechaza el lote entero", g([
  { clave: "general", texto: "Ningún supuesto tiene fuente." },
  { clave: "general", texto: "El proyecto es viable." },
]).length === 1);
check("numerosEnTexto: '2,000' → 2000, '3%' → 3, '49,5' → 49.5", JSON.stringify(numerosEnTexto("2,000 y 3% y 49,5")) === "[2000,3,49.5]");

const reglas = chequeoPorReglas(AUDITABLES);
check("reglas con los sembrados: 7 sin fuente + 1 que falta = 8 hallazgos", reglas.length === 8, reglas);
check("reglas: el que falta es la pérdida evitada", reglas.some((h) => h.clave === "perdida_evitada_suscriptor_anio" && h.texto.includes("no existe")));
const todosOk = [...AUDITABLES, { key: "perdida_evitada_suscriptor_anio", value_num: 1, unit: "MXN/suscriptor/año", status: "invented" as EstadoSupuesto, source_url: null, source_date: null }]
  .map((s) => ({ ...s, status: "sustained" as EstadoSupuesto, source_url: "https://ejemplo.org", source_date: "2026-09-01" }));
check("reglas con todo sustentado: 0 hallazgos", chequeoPorReglas(todosOk).length === 0);
check("reglas: la salida pasa la misma forma que la IA (clave + texto)", reglas.every((h) => typeof h.clave === "string" && typeof h.texto === "string"));

console.log(`\n${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
