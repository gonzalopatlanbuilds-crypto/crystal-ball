// Prueba mecánica de la lógica pura (sin base de datos).
// Uso: npm run test:logica
import { crearOrgSchema, normalizarJoinCode, unirseOrgSchema } from "../lib/orgs.ts";

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

console.log(`\n${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
