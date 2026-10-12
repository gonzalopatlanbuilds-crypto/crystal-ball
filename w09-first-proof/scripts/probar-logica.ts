// Prueba mecánica de lib/caso.ts y lib/validacion.ts (sin base de datos).
// Uso: npm run test:logica
import { CALCULOS, chequear } from "../lib/caso.ts";
import { leerNumero, validarEntrega } from "../lib/validacion.ts";

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

// Las respuestas correctas salen de los datos; deben ser las del packet.
const correctos = Object.fromEntries(CALCULOS.map((c) => [c.clave, c.correcto]));
check("respuestas correctas = 10.0 / 30.0 / 30.0 (cálculo a mano del packet)",
  correctos.growth === 10 && correctos.margin === 30 && correctos.dso === 30, correctos);

const estados = (r: Record<string, unknown>) => chequear(r as never).map((x) => x.estado).join(",");
check("10, 30, 30 → todo correcto", estados({ growth: 10, margin: 30, dso: 30 }) === "correcto,correcto,correcto");
check("strings de numeric de Supabase ('10.00')", estados({ growth: "10.00", margin: "30.00", dso: "30.00" }) === "correcto,correcto,correcto");
check("tolerancia ±0.05 incluye los bordes (9.95, 30.05)", estados({ growth: 9.95, margin: 30.05, dso: 29.95 }) === "correcto,correcto,correcto");
check("fuera de tolerancia (9.94, 30.06)", estados({ growth: 9.94, margin: 30.06, dso: 30 }) === "no_coincide,no_coincide,correcto");
check("vacíos → sin_respuesta", estados({ growth: null, margin: "", dso: undefined }) === "sin_respuesta,sin_respuesta,sin_respuesta");
check("errores típicos (margen T1 32, días T1 22.5)", estados({ growth: 10, margin: 32, dso: 22.5 }) === "correcto,no_coincide,no_coincide");
const r = chequear({ growth: 11, margin: 30, dso: 30 });
check("no_coincide trae el valor correcto", r[0].correcto === 10 && r[0].respuesta === 11);
check("el resultado no tiene total ni puntaje",
  !r.some((x) => Object.keys(x).some((k) => /score|total|puntaje|calificacion/i.test(k))));

check("leerNumero '10,5' → 10.5", JSON.stringify(leerNumero("10,5")) === '{"valor":10.5}');
check("leerNumero '30 %' → 30", JSON.stringify(leerNumero("30 %")) === '{"valor":30}');
check("leerNumero '' → null", JSON.stringify(leerNumero("  ")) === '{"valor":null}');
for (const malo of ["abc", "1e3", "NaN", "Infinity", "1,234.5", "10..5", "--3", "0x10"]) {
  check(`leerNumero rechaza '${malo}'`, "error" in leerNumero(malo));
}

const expl = "Las ventas subieron 10%, pero el margen bajó de 32% a 30% y ahora cobramos en 30 días en vez de 22.5. Revisaría primero los descuentos.";
const v = (o: Partial<Record<string, string>>) => validarEntrega({ growth: "10.0", margin: "30.0", dso: "30.0", explanation: expl, ...o });

const bien = v({});
check("entrega válida (texto del mockup)", bien.ok && bien.datos.answer_growth === 10, bien);
check("explicación de 79 caracteres → error", !v({ explanation: "x".repeat(79) }).ok);
check("explicación de 80 caracteres → ok", v({ explanation: "x".repeat(80) }).ok);
check("explicación de 801 → error", !v({ explanation: "x".repeat(801) }).ok);
check("80 caracteres con espacios alrededor cuentan sin espacios", !v({ explanation: `   ${"x".repeat(79)}   ` }).ok);
check("emoji cuenta 1 carácter (como char_length de Postgres)", v({ explanation: "🙂".repeat(80) }).ok);
const dsoNeg = v({ dso: "-1" });
check("días de cobranza negativos → error solo en ese campo",
  !dsoNeg.ok && Object.keys(dsoNeg.errores).join() === "dso", dsoNeg);
check("crecimiento 1001 → error", !v({ growth: "1001" }).ok);
check("respuestas vacías se aceptan (el chequeo dice 'sin respuesta')",
  (() => { const x = v({ growth: "", margin: "", dso: "" }); return x.ok && x.datos.answer_growth === null; })());
const red = v({ growth: "10.004" });
check("se redondea a 2 decimales como numeric(9,2)", red.ok && red.datos.answer_growth === 10, red);
const varios = v({ growth: "abc", explanation: "corta" });
check("varios errores a la vez, cada uno en su campo",
  !varios.ok && "growth" in varios.errores && "explanation" in varios.errores, varios);

console.log(`\n${ok} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
