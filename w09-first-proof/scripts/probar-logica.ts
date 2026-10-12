// Prueba mecánica de lib/caso.ts y lib/validacion.ts (sin base de datos).
// Uso: npm run test:logica
import { CALCULOS, chequear } from "../lib/caso.ts";
import { leerNumero, validarEntrega } from "../lib/validacion.ts";
import { elegirEvidencia, etiquetaIntento } from "../lib/intentos.ts";
import { revisarObservaciones } from "../lib/guardia-observaciones.ts";
import { mapaCriterios, NO_PRUEBA, nombreRevisor, QUIEN_PUEDE_VERLO, REAL_Y_SIMULADO, SI_MUESTRA } from "../lib/expediente.ts";
import { validarRevision } from "../lib/validacion-revision.ts";

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

// Número de intento. La evidencia es siempre el intento 1, aunque haya
// reenvíos posteriores (y vengan primero en la lista, como en el
// dashboard, que ordena de más reciente a más antigua).
const intentos = [
  { id: "c", attempt_number: 3 },
  { id: "b", attempt_number: 2 },
  { id: "a", attempt_number: 1 },
];
check("elegirEvidencia devuelve el intento 1 aunque existan el 2 y el 3",
  elegirEvidencia(intentos)?.id === "a", elegirEvidencia(intentos));
check("elegirEvidencia: solo el intento 1 → ese",
  elegirEvidencia([{ id: "a", attempt_number: 1 }])?.id === "a");
check("elegirEvidencia: intento 1 borrado → null, no promueve el 2",
  elegirEvidencia([{ id: "c", attempt_number: 3 }, { id: "b", attempt_number: 2 }]) === null);
check("elegirEvidencia: sin entregas → null", elegirEvidencia([]) === null);
check("intento 1 no lleva etiqueta", etiquetaIntento(1) === null);
check("intento 2 → 'Intento 2: reenvío'", etiquetaIntento(2) === "Intento 2: reenvío");
check("intento 3 → 'Intento 3: reenvío'", etiquetaIntento(3) === "Intento 3: reenvío");

// Guardia de observaciones de IA (textos escritos a mano; la prueba con
// salidas reales de Haiku está en scripts/probar-observaciones.ts).
const pasa = (obs: unknown) => revisarObservaciones(obs).length === 0;
const buenas = [
  "Menciona que el margen bruto bajó entre T1 y T2.",
  "No cuantifica el cambio en las cuentas por cobrar.",
  "Propone revisar primero las condiciones de crédito a clientes.",
];
check("guardia: observaciones descriptivas pasan", pasa(buenas), revisarObservaciones(buenas));
check("guardia: cifras de la hoja de datos pasan", pasa(["Menciona que los ingresos pasaron de 4,200,000 a 4,620,000.", "Usa la fórmula con 90 días."]),
  revisarObservaciones(["Menciona que los ingresos pasaron de 4,200,000 a 4,620,000.", "Usa la fórmula con 90 días."]));
check("guardia: 'Señala' con acento cuenta como verbo válido", pasa(["Señala que la cobranza es más lenta.", "No compara T1 con T2."]));
const dosTrim = ["Señala que el margen bruto disminuyó entre los dos trimestres.", "No compara T1 con T2."];
check("guardia: 'entre los dos trimestres' no cuenta como cifra", pasa(dosTrim), revisarObservaciones(dosTrim));
const especifica = ["No especifica qué elemento revisaría primero.", "Menciona que el margen bruto disminuyó."];
check("guardia: 'No especifica' es verbo válido (salida real descartada en ronda 3)", pasa(especifica), revisarObservaciones(especifica));
const noventa = ["Usa la fórmula de noventa días.", "Identifica un aumento en los días de cobranza."];
check("guardia: 'noventa' (fórmula) y 'un aumento' pasan", pasa(noventa), revisarObservaciones(noventa));
const malas: [string, unknown][] = [
  ["puntaje", ["Menciona el margen. Calificación: alta.", "No cuantifica nada."]],
  ["10 de 10", ["Menciona todo, merece 10 de 10.", "No cuantifica nada."]],
  ["aprobado", ["Menciona el margen, por lo que queda aprobado.", "No cuantifica nada."]],
  ["rechazado", ["Menciona poco; se rechaza.", "No cuantifica nada."]],
  ["juicio 'buena'", ["Explica de forma buena el cambio.", "No cuantifica nada."]],
  ["juicio 'excelente'", ["Describe excelente análisis.", "No cuantifica nada."]],
  ["'incorrecto'", ["Menciona un margen incorrecto.", "No cuantifica nada."]],
  ["'error'", ["Identifica un error en la cobranza.", "No cuantifica nada."]],
  ["contratación", ["Propone que se le contrate.", "No cuantifica nada."]],
  ["empleo", ["Menciona experiencia de empleo.", "No cuantifica nada."]],
  ["vacante", ["Relaciona el caso con la vacante.", "No cuantifica nada."]],
  ["recomienda", ["Incluye razones; se recomienda avanzar.", "No cuantifica nada."]],
  ["porcentaje inventado", ["Menciona que el margen bajó 2 puntos.", "No cuantifica nada."]],
  ["cifra derivada (32%)", ["Menciona un margen de 32% en T1.", "No cuantifica nada."]],
  ["cifra derivada (22.5)", ["Menciona 22.5 días de cobranza.", "No cuantifica nada."]],
  ["no empieza con verbo", ["El texto es claro.", "No cuantifica nada."]],
  ["solo una", ["Menciona el margen."]],
  ["cinco", ["Menciona a.", "Menciona b.", "Menciona c.", "Menciona d.", "Menciona e."].map((x) => x + " del caso")],
  ["no es lista", "Menciona el margen."],
  ["muy larga", ["Menciona " + "el margen ".repeat(30), "No cuantifica nada."]],
  // Encontrados en la prueba real con Haiku (ver DECISIONS.md):
  ["cifra en palabras: 'diez por ciento'", ["Menciona que los ingresos crecieron aproximadamente diez por ciento.", "No cuantifica nada."]],
  ["cifra en palabras: 'dos puntos porcentuales'", ["Señala que el margen bruto disminuyó en dos puntos porcentuales.", "No cuantifica nada."]],
  ["cifra en palabras: 'treinta días'", ["Menciona treinta días de cobranza.", "No cuantifica nada."]],
  ["'experiencia laboral'", ["Incluye información sobre experiencia laboral.", "No cuantifica nada."]],
];
for (const [nombre, obs] of malas) {
  check(`guardia rechaza: ${nombre}`, !pasa(obs), revisarObservaciones(obs));
}

// Feature 4: mapa de criterios (matching logic) y validación de revisión.
const sinRevision = mapaCriterios(null);
check("criterios: C1 siempre lo juzga el sistema",
  sinRevision[0].id === "C1" && sinRevision[0].juzgadoPor === "Sistema (automático)" && !sinRevision[0].pendiente);
check("criterios: sin revisión, C2 y C3 quedan pendientes", sinRevision.slice(1).every((f) => f.pendiente && /Pendiente/.test(f.juzgadoPor)));
const conRevision = mapaCriterios("Ana Revisora");
check("criterios: con revisión, C2 y C3 los juzga esa persona",
  conRevision.slice(1).every((f) => !f.pendiente && f.juzgadoPor === "Revisión humana: Ana Revisora"));
check("criterios: cada uno apunta a su evidencia", conRevision.every((f) => /Bloque \d/.test(f.evidencia)));
check("criterios: ningún texto resume a la persona en un número",
  conRevision.every((f) => !/\d+\s*(de|\/)\s*\d+/.test(`${f.texto} ${f.evidencia} ${f.juzgadoPor}`)));
check("nombreRevisor sin nombre → genérico",
  nombreRevisor("  ") === "Persona revisora del piloto" && nombreRevisor(null) === "Persona revisora del piloto");
check("bloque NO prueba: dice que no se envió a ningún empleador", NO_PRUEBA.some((t) => /ningún empleador/.test(t)));
// Bug de la pasada mecánica (F5): la copia del revisor le hablaba como al candidato.
check("vista revisor: no dice 'tu entrega' ni 'tus respuestas'",
  !/\btu entrega\b|\btus respuestas\b|\btu explicación\b/i.test(`${QUIEN_PUEDE_VERLO.revisor} ${REAL_Y_SIMULADO.revisor}`));
check("vista candidato: sí le habla al candidato", /tu entrega/.test(QUIEN_PUEDE_VERLO.candidato));
// Prueba de persona (F5): "sí muestra" no puede prometer empleo ni entrevistas.
check("SI_MUESTRA no promete empleo, entrevista ni contratación",
  [...SI_MUESTRA.candidato, ...SI_MUESTRA.revisor].every((t) => !/emple|entrevist|contrat|vacante|garantiz/i.test(t)));

const base = {
  idsObservaciones: ["o1", "o2"],
  decisiones: { o1: "confirmada", o2: "descartada" } as Record<string, string>,
  motivos: { o2: "No aparece en el texto." } as Record<string, string>,
  conflictoTipo: "ninguno",
  conflictoTexto: "",
  recomendacion: "conversar",
  nota: "Explica bien; falta cuantificar.",
};
const rv = validarRevision(base);
check("revisión válida",
  rv.ok && rv.datos.conflicto === "Ninguno" && rv.datos.decisiones.o2.motivo === "No aparece en el texto." && !("motivo" in rv.datos.decisiones.o1), rv);
check("revisión: falta decidir una observación", !validarRevision({ ...base, decisiones: { o1: "confirmada" } }).ok);
check("revisión: decisión inventada", !validarRevision({ ...base, decisiones: { o1: "aprobada", o2: "descartada" } }).ok);
const conMotivoEnConfirmada = validarRevision({ ...base, motivos: { o1: "x" } });
check("revisión: el motivo de una confirmada se ignora", conMotivoEnConfirmada.ok && !("motivo" in conMotivoEnConfirmada.datos.decisiones.o1));
check("revisión: motivo > 120", !validarRevision({ ...base, motivos: { o2: "x".repeat(121) } }).ok);
check("revisión: conflicto sin declarar", !validarRevision({ ...base, conflictoTipo: "" }).ok);
check("revisión: 'sí tengo conflicto' sin texto", !validarRevision({ ...base, conflictoTipo: "si", conflictoTexto: "  " }).ok);
const conConflicto = validarRevision({ ...base, conflictoTipo: "si", conflictoTexto: "Fui su compañero" });
check("revisión: conflicto con texto", conConflicto.ok && conConflicto.datos.conflicto === "Fui su compañero");
check("revisión: no existe 'rechazar'", !validarRevision({ ...base, recomendacion: "rechazar" }).ok);
check("revisión: nota vacía", !validarRevision({ ...base, nota: "   " }).ok);
check("revisión: nota de 401", !validarRevision({ ...base, nota: "x".repeat(401) }).ok);
check("revisión: sin observaciones de IA no pide decisiones", validarRevision({ ...base, idsObservaciones: [], decisiones: {} }).ok);

console.log(`\n${ok} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
