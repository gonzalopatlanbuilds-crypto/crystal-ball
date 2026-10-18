// Prueba mecánica de la lógica pura (sin base de datos).
// Uso: npm run test:logica
import { crearOrgSchema, normalizarJoinCode, unirseOrgSchema } from "../lib/orgs.ts";
import {
  CATALOGO,
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

console.log(`\n${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
