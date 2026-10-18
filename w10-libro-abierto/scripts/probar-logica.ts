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

console.log(`\n${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
