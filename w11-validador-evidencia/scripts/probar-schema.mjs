import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { leerCsv } from "../lib/csv.ts";
import { CSV_EJEMPLO, NOMBRE_EJEMPLO } from "../lib/ejemplo.ts";
import { detectarHallazgos } from "../lib/validador.ts";

// Prueba mecánica de sql/schema.sql en Postgres real (PGlite, WASM), sin
// Supabase: stub de roles anon/authenticated, auth.uid()/auth.jwt() y los
// default privileges que Supabase da a funciones y tablas nuevas (la causa
// del bug de anon en w08). No sustituye la prueba con la llave pública
// contra el proyecto real (scripts/probar-anon.sh).
//
// Uso: npm run test:schema
// Con BASE_URL=https://… (o http://localhost:3000) prueba además las rutas
// por HTTP: /login 200 sin sesión y /validador → /login.
const db = new PGlite();
const schema = fs.readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8");

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
grant select on auth.users to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
await db.exec(schema);
await db.exec(schema); // idempotente

const U = {
  A: "aaaaaaaa-0000-0000-0000-000000000001",
  B: "bbbbbbbb-0000-0000-0000-000000000002",
  C: "cccccccc-0000-0000-0000-000000000003",
};
for (const [k, id] of Object.entries(U)) await db.query(`insert into auth.users values ($1, $2)`, [id, `${k}@test.mx`]);

let ok = 0, fail = 0;
async function as(who, sql, params = []) {
  await db.exec(`reset role`);
  if (who === "anon") {
    await db.exec(`select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claims','',false); set role anon;`);
  } else {
    await db.query(`select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)`,
      [U[who], JSON.stringify({ email: `${who}@test.mx`, user_metadata: { full_name: `Persona ${who}` } })]);
    await db.exec(`set role authenticated`);
  }
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec(`reset role`); }
}
function check(name, cond, detail) {
  if (cond) { ok++; console.log("PASS", name); }
  else { fail++; console.log("FAIL", name, JSON.stringify(detail)); }
}
const negado = (r) => /permission denied/.test(r.error ?? "");
const vacioONegado = (r) => (r.rows && r.rows.length === 0) || negado(r);
const HASH = "a".repeat(64);
const FILA = { fila: 2, sku: "SIM-001", supplier: "Proveedor Simulado", weight_g: 10, material: "PET", packaging_revision_date: "2026-09-01", evidence_folio: "FOL-1" };

// ---------- Feature 1: organizaciones ----------
const a = await as("A", `select * from create_org('Empaques Simulados Uno')`);
const orgA = a.rows?.[0]?.org_id, code = a.rows?.[0]?.join_code;
check("A crea org con código ABC-234", !!orgA && /^[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(code), a);
check("B se une con código (minúsculas)", !(await as("B", `select * from join_org($1)`, [code.toLowerCase()])).error);
const c = await as("C", `select * from create_org('Empaques Simulados Dos')`);
const orgC = c.rows?.[0]?.org_id;
let r = await as("A", `select * from create_org('x')`);
check("A no puede crear otra org", /Ya perteneces/.test(r.error), r);
r = await as("A", `select * from join_org($1)`, ["ZZZ-999"]);
check("A no puede unirse a otra org", /Ya perteneces/.test(r.error), r);
r = await as("B", `select id from profiles order by email`);
check("B ve los 2 perfiles de su org", r.rows?.length === 2, r);
r = await as("A", `insert into organizations (name, join_code) values ('x', 'ABC-234')`);
check("insert directo en organizations prohibido", negado(r), r);
r = await as("A", `insert into profiles (id, org_id, email) values ($1, $2, 'x')`, [U.A, orgC]);
check("insert directo en profiles prohibido", negado(r), r);
r = await as("A", `update profiles set org_id=$1 where id=$2 returning id`, [orgC, U.A]);
check("A no puede moverse de org editando profiles", negado(r) || r.rows?.length === 0, r);

// Filas en todas las tablas, para que las pruebas de aislamiento tengan
// algo que fugar. Como superusuario (service role).
async function sembrarSuper(org, user) {
  const v = (await db.query(
    `insert into evidence_versions (org_id, uploaded_by, source_filename, raw_rows, content_sha256) values ($1, $2, 'simulado.csv', $3, $4) returning id`,
    [org, user, JSON.stringify([FILA]), HASH])).rows[0].id;
  const f = (await db.query(
    `insert into findings (org_id, evidence_version_id, type, sku, supplier, fingerprint) values ($1, $2, 'value_conflict', 'SIM-001', 'Proveedor Simulado', 'semilla') returning id`,
    [org, v])).rows[0].id;
  await db.query(`insert into decisions (org_id, finding_id, decided_by, decision, note) values ($1, $2, $3, 'confirmed', 'nota simulada')`, [org, f, user]);
  return { v, f };
}
const filasA = await sembrarSuper(orgA, U.A);
await sembrarSuper(orgC, U.C);

const TABLAS = ["organizations", "profiles", "evidence_versions", "findings", "decisions"];
for (const t of TABLAS) {
  r = await as("C", `select * from ${t}`);
  const fuga = (r.rows ?? []).some((x) => x.org_id === orgA || x.id === orgA);
  check(`C (otra org) no ve ${t} de A`, !r.error && !fuga && r.rows.length >= 1, r);
  r = await as("B", `select * from ${t}`);
  check(`B (misma org que A) ve ${t} de A`, !r.error && r.rows.length >= 1, r);
}

// ---------- Feature 1: el cliente todavía no escribe nada ----------
for (const [t, sql] of [
  ["evidence_versions", `insert into evidence_versions (org_id, uploaded_by, source_filename, raw_rows, content_sha256) values ('${orgA}', '${U.A}', 'x.csv', '[]', '${HASH}')`],
  ["findings", `insert into findings (org_id, evidence_version_id, type, sku) values ('${orgA}', '${filasA.v}', 'value_conflict', 'X')`],
  ["findings (update status)", `update findings set status = 'discarded'`],
  ["decisions", `insert into decisions (org_id, finding_id, decided_by, decision, note) values ('${orgA}', '${filasA.f}', '${U.A}', 'confirmed', 'x')`],
  ["evidence_versions (delete)", `delete from evidence_versions`],
  ["decisions (delete)", `delete from decisions`],
]) {
  for (const who of ["A", "C"]) {
    r = await as(who, sql);
    check(`${who} no puede escribir ${t} desde el cliente`, negado(r), r);
  }
}

// ---------- anon: no lee ni escribe nada ----------
for (const t of TABLAS) {
  r = await as("anon", `select * from ${t}`);
  check(`anon no lee ${t}`, vacioONegado(r), r);
}
for (const [t, sql] of [
  ["evidence_versions", `insert into evidence_versions (org_id, uploaded_by, source_filename, raw_rows, content_sha256) values ('${orgA}', '${U.A}', 'x.csv', '[]', '${HASH}')`],
  ["findings", `update findings set status = 'confirmed'`],
  ["decisions", `insert into decisions (org_id, finding_id, decided_by, decision, note) values ('${orgA}', '${filasA.f}', '${U.A}', 'confirmed', 'x')`],
]) {
  r = await as("anon", sql);
  check(`anon no escribe ${t}`, negado(r), r);
}

// ---------- RPCs: ninguno ejecutable por anon ----------
const fns = [["create_org", "'x'"], ["join_org", "'ABC-234'"], ["my_org_id", ""], ["generar_join_code", ""]];
for (const [fn, args] of fns) {
  r = await as("anon", `select * from ${fn}(${args})`);
  check(`anon no ejecuta ${fn}`, negado(r), r);
}
r = await as("A", `select generar_join_code()`);
check("authenticated tampoco ejecuta generar_join_code", negado(r), r);
// Chequeo genérico, no una lista a mano: si alguien agrega una función sin
// revocar, falla aquí.
async function ejecutablesPorAnon() {
  const salida = [];
  for (const fn of (await db.query(`select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).rows) {
    if ((await db.query(`select has_function_privilege('anon', $1::oid, 'execute') e`, [fn.oid])).rows[0].e) salida.push(fn.proname);
  }
  return salida;
}
r = await ejecutablesPorAnon();
check("anon no tiene EXECUTE en ninguna función de public", r.length === 0, r);

// ---------- RLS encendido en todas las tablas ----------
const sinRls = (await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)).rows;
check("RLS encendido en todas las tablas de public", sinRls.length === 0, sinRls);

// ---------- Restricciones de la base ----------
const intentaSuper = async (sql, params) => { try { await db.query(sql, params); return {}; } catch (e) { return { error: e.message }; } };
r = await intentaSuper(`insert into decisions (org_id, finding_id, decided_by, decision, note) values ($1, $2, $3, 'confirmed', '   ')`, [orgA, filasA.f, U.A]);
check("decisión con nota vacía (solo espacios) → rechazada por la base", /decisions_note_check/.test(r.error), r);
r = await intentaSuper(`insert into findings (org_id, evidence_version_id, type, sku, fingerprint) values ($1, $2, 'cumple', 'X', 'f-cumple')`, [orgA, filasA.v]);
check("tipo de hallazgo fuera de la lista → rechazado", /findings_type_check/.test(r.error), r);
r = await intentaSuper(`insert into findings (org_id, evidence_version_id, type, sku, status, fingerprint) values ($1, $2, 'value_conflict', 'X', 'resuelto', 'f-resuelto')`, [orgA, filasA.v]);
check("estado de hallazgo fuera de pending/confirmed/discarded → rechazado", /findings_status_check|nace pendiente/.test(r.error), r);

// ---------- Feature 2: carga y versionado append-only ----------
const ej = leerCsv(CSV_EJEMPLO, "2026-10-25");
check("el CSV de ejemplo se lee completo (10 filas, 0 rechazadas)", ej.ok && ej.filas.length === 10 && ej.rechazadas.length === 0, ej);
const filasEj = JSON.stringify(ej.filas);
// p_base_seq = la última versión de la org de `who` (como lo haría la
// server action después de leer el historial).
const ultimoSeq = async (who) => (await db.query(`select max(e.seq) s from evidence_versions e join profiles p on p.org_id = e.org_id where p.id = $1`, [U[who]])).rows[0]?.s ?? null;
const registrar = async (who, filas, invalidas = "[]", nombre = "proveedor_octubre.csv", ejemplo = false, hallazgos = "[]", base) =>
  as(who, `select * from registrar_version($1, $2::jsonb, $3::jsonb, $4, $5::jsonb, $6)`, [nombre, filas, invalidas, ejemplo, hallazgos, base === undefined ? await ultimoSeq(who) : base]);
const versionesDe = async (org) => (await db.query(`select count(*)::int n from evidence_versions where org_id = $1`, [org])).rows[0].n;

const antesA = await versionesDe(orgA);
r = await registrar("A", filasEj, JSON.stringify([{ fila: 12, motivo: "weight_g: \"1e3\" no es un número válido" }]), NOMBRE_EJEMPLO, true);
const v1 = r.rows?.[0];
check("A registra el ejemplo como versión nueva (no idéntica a la anterior)", v1 && v1.identical_to_previous === false && (await versionesDe(orgA)) === antesA + 1, r);
r = await as("B", `select uploaded_by, source_filename, is_example, jsonb_array_length(raw_rows) n, invalid_rows, content_sha256 from evidence_versions where id = $1`, [v1?.version_id]);
const filaV1 = r.rows?.[0];
check("procedencia: uploaded_by = quien subió (A), archivo y marca de ejemplo", filaV1?.uploaded_by === U.A && filaV1?.source_filename === NOMBRE_EJEMPLO && filaV1?.is_example === true, r);
check("B (misma org) ve la versión de A con sus 10 filas", filaV1?.n === 10, r);
check("las filas rechazadas se guardan con su motivo (no se tiran)", filaV1?.invalid_rows?.[0]?.fila === 12 && /1e3/.test(filaV1?.invalid_rows?.[0]?.motivo), r);
check("la huella la calcula la base (sha256 hex)", /^[0-9a-f]{64}$/.test(filaV1?.content_sha256 ?? "") && filaV1?.content_sha256 !== "0".repeat(64), r);

// Toda carga válida es una versión nueva, aunque sea idéntica a la última
// (corrección del 2026-10-25): lo único que cambia es la marca.
r = await registrar("B", filasEj);
const vIdentica = r.rows?.[0];
check("recarga idéntica (por B, misma org) → SÍ se guarda como versión nueva, marcada idéntica a la anterior",
  vIdentica?.identical_to_previous === true && vIdentica.version_id !== v1?.version_id && (await versionesDe(orgA)) === antesA + 2, r);
r = await as("A", `select uploaded_by, identical_to_previous from evidence_versions where id = $1`, [vIdentica?.version_id]);
check("…con su propia procedencia (la subió B) y la marca guardada en la tabla", r.rows?.[0]?.uploaded_by === U.B && r.rows?.[0]?.identical_to_previous === true, r);
const reordenadas = JSON.stringify([...ej.filas].reverse().map((f, i) => ({ ...f, fila: i + 2 })));
r = await registrar("A", reordenadas);
check("mismas filas en otro orden (otros números de fila) → versión nueva, idéntica a la anterior", r.rows?.[0]?.identical_to_previous === true && (await versionesDe(orgA)) === antesA + 3, r);
const cambiada = JSON.stringify(ej.filas.map((f) => (f.sku === "SIM-1190" && /Alfa/.test(f.supplier) ? { ...f, weight_g: 24.5 } : f)));
r = await registrar("A", cambiada);
const v2 = r.rows?.[0];
check("un peso distinto → versión nueva, NO idéntica", v2?.identical_to_previous === false && (await versionesDe(orgA)) === antesA + 4, r);
r = await registrar("A", filasEj);
check("volver al contenido de una versión VIEJA (v1) → no idéntica (solo se compara con la última)", r.rows?.[0]?.identical_to_previous === false && (await versionesDe(orgA)) === antesA + 5, r);
r = await registrar("C", filasEj);
check("otra org sube el mismo contenido → no idéntica (la comparación es dentro de la org)", r.rows?.[0]?.identical_to_previous === false, r);
r = await as("A", `select seq from evidence_versions where org_id = $1 order by seq`, [orgA]);
check("seq: orden total y estrictamente creciente de las versiones de la org", r.rows?.length === antesA + 5 && r.rows.every((x, k) => k === 0 || Number(x.seq) > Number(r.rows[k - 1].seq)), r);
await db.query(`insert into evidence_versions (org_id, uploaded_by, source_filename, raw_rows, content_sha256, identical_to_previous) values ($1, $2, 'sql-editor.csv', $3, $4, false)`, [orgA, U.A, filasEj, HASH]);
r = (await db.query(`select identical_to_previous i, content_sha256 h from evidence_versions where org_id = $1 order by seq desc limit 1`, [orgA])).rows[0];
check("insertando desde el SQL Editor, la base recalcula la marca y la huella (no confía en lo que le mandan)", r.i === true && r.h !== HASH, r);

// Append-only: nadie edita ni borra, ni el dueño, ni otro de su org, ni
// otra org, ni el service role.
for (const who of ["A", "B", "C", "anon"]) {
  r = await as(who, `update evidence_versions set source_filename = 'editado.csv' where id = $1 returning id`, [v1.version_id]);
  check(`${who} no puede editar una versión (update)`, negado(r) || r.rows?.length === 0, r);
  r = await as(who, `delete from evidence_versions where id = $1 returning id`, [v1.version_id]);
  check(`${who} no puede borrar una versión (delete)`, negado(r) || r.rows?.length === 0, r);
}
r = await intentaSuper(`update evidence_versions set raw_rows = '[]' where id = $1`, [v1.version_id]);
check("ni el service role / SQL Editor edita una versión (trigger)", /append-only/.test(r.error), r);
r = await intentaSuper(`delete from evidence_versions where id = $1`, [v1.version_id]);
check("ni el service role / SQL Editor borra una versión (trigger)", /append-only/.test(r.error), r);
r = await intentaSuper(`truncate evidence_versions cascade`);
check("ni el service role / SQL Editor hace truncate (trigger)", /append-only/.test(r.error), r);
r = await as("B", `select source_filename from evidence_versions where id = $1`, [v1.version_id]);
check("la versión v1 sigue intacta tras los ataques", r.rows?.[0]?.source_filename === NOMBRE_EJEMPLO, r);

// La base revalida cada fila: un cliente que llame al RPC directo, sin la
// server action, no puede guardar basura.
const conFila = (cambio) => JSON.stringify([{ ...ej.filas[0], ...cambio }]);
for (const [nombre, filas, patron] of [
  ["sin filas válidas", "[]", /al menos una fila/],
  ["peso como texto '1e3'", conFila({ weight_g: "1e3" }), /weight_g/],
  ["peso 0", conFila({ weight_g: 0 }), /weight_g/],
  ["peso negativo", conFila({ weight_g: -5 }), /weight_g/],
  ["sku con espacios", conFila({ sku: "SIM 1" }), /sku/],
  ["proveedor tipo fórmula", conFila({ supplier: "=HYPERLINK(1)" }), /supplier/],
  ["proveedor de puros saltos de línea/tabs", conFila({ supplier: "\n\t \n" }), /supplier/],
  ["material de puros saltos de línea/tabs", conFila({ material: "\t\n" }), /material/],
  ["fecha que no existe", conFila({ packaging_revision_date: "2026-02-30" }), /packaging_revision_date/],
  ["columna extra", conFila({ cumple: true }), /columnas/],
  ["sin número de fila", JSON.stringify([{ ...ej.filas[0], fila: undefined }]), /columnas/],
  ["SKU+proveedor repetido", JSON.stringify([ej.filas[0], { ...ej.filas[0], fila: 9 }]), /repetido/],
]) {
  r = await registrar("A", filas);
  check(`RPC directo con ${nombre} → rechazado por la base`, patron.test(r.error ?? ""), r);
}
r = await registrar("A", filasEj, JSON.stringify([{ fila: 3 }]));
check("RPC directo con fila rechazada sin motivo → rechazado", /fila y motivo/.test(r.error ?? ""), r);

Object.assign(U, { D: "dddddddd-0000-0000-0000-000000000004" });
await db.query(`insert into auth.users values ($1, 'D@test.mx')`, [U.D]);
r = await registrar("D", filasEj);
check("usuario sin organización no registra versiones", /organización/.test(r.error ?? ""), r);
r = await registrar("anon", filasEj);
check("anon no ejecuta registrar_version", negado(r), r);
for (const fn of ["validar_filas_evidencia('[]','[]')", "huella_evidencia('[]')"]) {
  r = await as("A", `select ${fn}`);
  check(`authenticated no ejecuta ${fn.split("(")[0]} (solo interna)`, negado(r), r);
}
r = await ejecutablesPorAnon();
check("tras la Feature 2, anon sigue sin EXECUTE en ninguna función", r.length === 0, r);

// ---------- Feature 3: motor de hallazgos + RPC, de punta a punta ----------
// Hace lo mismo que la server action: lee el historial y los hallazgos con
// la sesión de `who` (RLS incluido), corre el motor y guarda con el RPC.
Object.assign(U, { E: "eeeeeeee-0000-0000-0000-000000000005", F: "ffffffff-0000-0000-0000-000000000006" });
for (const k of ["E", "F"]) await db.query(`insert into auth.users values ($1, $2)`, [U[k], `${k}@test.mx`]);
const oe = await as("E", `select * from create_org('Empaques Simulados Tres')`);
const orgE = oe.rows[0].org_id;
await as("F", `select * from join_org($1)`, [oe.rows[0].join_code]);

async function leerParaMotor(who) {
  const h = await as(who, `select id, seq, uploaded_at, uploaded_by, source_filename, identical_to_previous, raw_rows from evidence_versions order by seq`);
  const g = await as(who, `select fingerprint, status from findings`);
  const historial = h.rows.map((v) => ({ ...v, seq: Number(v.seq), uploaded_at: new Date(v.uploaded_at).toISOString() }));
  return { historial, guardados: g.rows, base: historial.length ? historial[historial.length - 1].seq : null };
}
async function cargarComoAccion(who, nombre, filas) {
  const { historial, guardados, base } = await leerParaMotor(who);
  const nuevos = detectarHallazgos(historial, guardados, { source_filename: nombre, filas });
  const res = await registrar(who, JSON.stringify(filas), "[]", nombre, false, JSON.stringify(nuevos), base);
  return { res, nuevos };
}
const hallazgosDe = async (who, versionId) =>
  (await as(who, `select type, sku, supplier, status, details, fingerprint from findings where evidence_version_id = $1 order by type, sku, supplier`, [versionId])).rows;
const conCambio = (filas, sku, prov, cambio) => filas.map((f) => (f.sku === sku && f.supplier.includes(prov) ? { ...f, ...cambio } : f));

// v1 de la org E: evidencia aceptada el 2-oct (como superusuario, para poder
// fecharla en el pasado; la validación y la huella las pone igual el trigger).
await db.query(`insert into evidence_versions (org_id, uploaded_by, source_filename, raw_rows, content_sha256, uploaded_at) values ($1, $2, 'proveedores_septiembre.csv', $3, $4, '2026-10-02 10:00:00-06')`,
  [orgE, U.E, filasEj, HASH]);

// v2: las 4 situaciones del packet en una sola carga.
let filasV2 = ej.filas.filter((f) => !(f.sku === "SIM-4821" && f.supplier.includes("Alfa")));
filasV2 = conCambio(filasV2, "SIM-1190", "Alfa", { weight_g: 24.5 });
filasV2 = conCambio(filasV2, "SIM-7733", "Beta", { packaging_revision_date: "2026-10-09" });
filasV2 = conCambio(filasV2, "SIM-2034", "Alfa", { evidence_folio: "FOL-SIM-0001" });
let c2 = await cargarComoAccion("F", "proveedores_octubre.csv", filasV2);
const v2E = c2.res.rows?.[0];
let hE = await hallazgosDe("E", v2E?.version_id);
const resumen = (hs) => hs.map((h) => `${h.type}:${h.sku}:${h.supplier}`).join(" ; ");
check("v2: los 4 tipos del packet quedan guardados (5 hallazgos: el folio repetido marca las dos filas)",
  v2E?.findings_created === 5 && resumen(hE) === [
    "late_revision:SIM-7733:Proveedor Simulado Beta",
    "missing_supplier:SIM-4821:Proveedor Simulado Alfa",
    "possible_duplicate:SIM-1190:Proveedor Simulado Alfa",
    "possible_duplicate:SIM-2034:Proveedor Simulado Alfa",
    "value_conflict:SIM-1190:Proveedor Simulado Alfa",
  ].join(" ; "), [v2E, resumen(hE)]);
check("v2: todos nacen pendientes", hE.length === 5 && hE.every((h) => h.status === "pending"), hE);
const conflictoE = hE.find((h) => h.type === "value_conflict");
check("v2: el conflicto guarda los dos valores y las dos procedencias (archivo + fila)",
  conflictoE?.details.cambios[0].anterior === 18.2 && conflictoE.details.cambios[0].nuevo === 24.5
  && conflictoE.details.anterior.archivo === "proveedores_septiembre.csv" && conflictoE.details.anterior.fila === 2
  && conflictoE.details.nueva.archivo === "proveedores_octubre.csv", conflictoE);
check("v2: la revisión tardía compara contra la fecha de carga de v1 (2-oct)",
  hE.find((h) => h.type === "late_revision")?.details.fecha_evidencia_aceptada === "2026-10-02", hE);

// Recarga idéntica: versión nueva, cero hallazgos (aunque el cliente mande
// hallazgos a mano).
let c3 = await cargarComoAccion("E", "proveedores_octubre_otra_vez.csv", filasV2);
check("recarga idéntica: versión nueva, marcada, 0 hallazgos nuevos", c3.res.rows?.[0]?.identical_to_previous === true && c3.res.rows[0].findings_created === 0 && c3.nuevos.length === 0, c3);
const falso = JSON.stringify([{ type: "value_conflict", sku: "SIM-X", supplier: "P", details: {}, fingerprint: "inventado-1" }]);
r = await registrar("E", JSON.stringify(filasV2), "[]", "otra.csv", false, falso);
check("recarga idéntica con un hallazgo inventado por el cliente → la base no lo guarda", r.rows?.[0]?.identical_to_previous === true && r.rows[0].findings_created === 0, r);

// v4: lo mismo + un cambio nuevo → solo el hallazgo nuevo (dedup por huella).
const filasV4 = conCambio(filasV2, "SIM-6018", "Beta", { weight_g: 60 });
let c4 = await cargarComoAccion("E", "proveedores_noviembre.csv", filasV4);
hE = await hallazgosDe("E", c4.res.rows?.[0]?.version_id);
check("v4 con los mismos 5 problemas + 1 cambio nuevo → solo 1 hallazgo nuevo (SIM-6018)", c4.res.rows?.[0]?.findings_created === 1 && resumen(hE) === "value_conflict:SIM-6018:Proveedor Simulado Beta", [c4.res, resumen(hE)]);
r = await registrar("E", JSON.stringify(conCambio(filasV4, "SIM-3307", "Alfa", { weight_g: 8 })), "[]", "x.csv", false, JSON.stringify(c2.nuevos));
check("mandar otra vez hallazgos ya existentes (misma huella) → la base no los duplica", r.rows?.[0]?.findings_created === 0, r);

// La base no acepta hallazgos con estado ni con tipo inventado.
const v4filas = JSON.stringify(conCambio(filasV4, "SIM-3307", "Alfa", { weight_g: 9 }));
const unHallazgo = (extra) => JSON.stringify([{ type: "value_conflict", sku: "SIM-3307", supplier: "Proveedor Simulado Alfa", details: {}, fingerprint: "nuevo-x", ...extra }]);
r = await registrar("E", v4filas, "[]", "x.csv", false, unHallazgo({ status: "confirmed" }));
check("RPC con un hallazgo que trae status 'confirmed' → rechazado", /nace pendiente/.test(r.error ?? ""), r);
r = await registrar("E", v4filas, "[]", "x.csv", false, unHallazgo({ type: "cumple" }));
check("RPC con un hallazgo de tipo 'cumple' → rechazado", /Hallazgo inválido/.test(r.error ?? ""), r);

// Concurrencia: si otra carga entró después de leer el historial, no se
// guarda nada (la acción recalcula y reintenta).
const antesE = await versionesDe(orgE);
const vieja = await ultimoSeq("E");
await cargarComoAccion("F", "entro_en_medio.csv", conCambio(filasV4, "SIM-5502", "Beta", { weight_g: 3.3 }));
r = await registrar("E", JSON.stringify(conCambio(filasV4, "SIM-8890", "Alfa", { weight_g: 13 })), "[]", "tarde.csv", false, "[]", vieja);
check("historial viejo (p_base_seq desactualizado) → CAMBIO_CONCURRENTE, no guarda la versión", /CAMBIO_CONCURRENTE/.test(r.error ?? "") && (await versionesDe(orgE)) === antesE + 1, [r, antesE]);

// El estado solo cambia con una decisión: ni el cliente ni el SQL Editor.
const idHallazgo = (await db.query(`select id from findings where org_id = $1 and type = 'value_conflict' and sku = 'SIM-1190'`, [orgE])).rows[0].id;
for (const who of ["E", "F", "C", "anon"]) {
  r = await as(who, `update findings set status = 'confirmed' where id = $1 returning id`, [idHallazgo]);
  check(`${who} no puede cambiar el estado de un hallazgo directo`, negado(r) || r.rows?.length === 0, r);
  r = await as(who, `delete from findings where id = $1 returning id`, [idHallazgo]);
  check(`${who} no puede borrar un hallazgo`, negado(r) || r.rows?.length === 0, r);
}
r = await intentaSuper(`update findings set status = 'discarded' where id = $1`, [idHallazgo]);
check("ni el service role / SQL Editor cambia el estado sin pasar por una decisión", /decisión humana/.test(r.error ?? ""), r);
r = await intentaSuper(`delete from findings where id = $1`, [idHallazgo]);
check("ni el service role / SQL Editor borra un hallazgo", /no se borran/.test(r.error ?? ""), r);
r = await intentaSuper(`truncate findings cascade`);
check("ni el service role / SQL Editor hace truncate de hallazgos", /no se borran/.test(r.error ?? ""), r);
try {
  await db.exec(`begin; select set_config('validador.desde_decision', 'on', true); update findings set sku = 'OTRO' where id = '${idHallazgo}'; commit;`);
  r = {};
} catch (e) {
  r = { error: e.message };
  await db.exec(`rollback`).catch(() => {});
}
check("aun con la bandera de decisión, de un hallazgo solo cambia el estado (no el SKU)", /solo puede cambiar el estado/.test(r.error ?? ""), r);
r = (await db.query(`select status from findings where id = $1`, [idHallazgo])).rows[0].status;
check("el hallazgo sigue pendiente tras todos los intentos", r === "pending", r);
// Control positivo: el camino que usará la Feature 4 (bandera encendida
// dentro de la transacción, solo cambia el estado) sí funciona.
await db.exec(`begin; select set_config('validador.desde_decision', 'on', true); update findings set status = 'confirmed' where id = '${idHallazgo}'; commit;`);
r = (await db.query(`select status, current_setting('validador.desde_decision', true) bandera from findings where id = $1`, [idHallazgo])).rows[0];
check("control: con la bandera de decisión, cambiar solo el estado sí funciona (y la bandera no sobrevive a la transacción)", r.status === "confirmed" && (r.bandera ?? "") !== "on", r);
await db.exec(`begin; select set_config('validador.desde_decision', 'on', true); update findings set status = 'pending' where id = '${idHallazgo}'; commit;`);

// Aislamiento: la otra org (C) no ve nada de E.
r = await as("C", `select count(*)::int n from findings where org_id = $1`, [orgE]);
check("C (otra org) no ve hallazgos de E", r.rows?.[0]?.n === 0, r);
r = await as("C", `select count(*)::int n from evidence_versions where org_id = $1`, [orgE]);
check("C (otra org) no ve versiones de E", r.rows?.[0]?.n === 0, r);

for (const fn of ["hallazgo_protegido()"]) {
  r = await as("A", `select ${fn}`);
  check(`authenticated no ejecuta ${fn} (función de trigger)`, negado(r) || /trigger/.test(r.error ?? ""), r);
}
r = await ejecutablesPorAnon();
check("tras la Feature 3, anon sigue sin EXECUTE en ninguna función", r.length === 0, r);

// ---------- Feature 4: revisión humana y bitácora de decisiones ----------
const decidir = (who, finding, decision, nota) => as(who, `select * from registrar_decision($1, $2, $3)`, [finding, decision, nota]);
const estadoDe = async (id) => (await db.query(`select status from findings where id = $1`, [id])).rows[0].status;
const decisionesDe = async (id) => (await db.query(`select decision, note, decided_by from decisions where finding_id = $1 order by decided_at, id`, [id])).rows;
const idConflicto = (await db.query(`select id from findings where org_id = $1 and type = 'value_conflict' and sku = 'SIM-1190'`, [orgE])).rows[0].id;
const idFaltante = (await db.query(`select id from findings where org_id = $1 and type = 'missing_supplier'`, [orgE])).rows[0].id;

// Nota obligatoria: la base la rechaza aunque alguien se salte el servidor.
for (const [nombre, nota] of [["vacía", ""], ["solo espacios", "   \n\t "], ["null", null]]) {
  r = await decidir("E", idConflicto, "confirmed", nota);
  check(`decisión con nota ${nombre} → rechazada por la base`, /nota es obligatoria/.test(r.error ?? ""), r);
}
r = await decidir("E", idConflicto, "confirmed", "x".repeat(1001));
check("nota de 1001 caracteres → rechazada", /más de 1000/.test(r.error ?? ""), r);
r = await decidir("E", idConflicto, "resuelto", "nota");
check("decisión fuera de confirmar/descartar ('resuelto') → rechazada", /confirmar o descartar/.test(r.error ?? ""), r);
check("tras los intentos rechazados, el hallazgo sigue pendiente y sin decisiones", (await estadoDe(idConflicto)) === "pending" && (await decisionesDe(idConflicto)).length === 0);

// Camino feliz: confirmar con nota.
r = await decidir("F", idConflicto, "confirmed", "  El proveedor Alfa no adjuntó nota de rediseño. ");
check("F (misma org, no subió la versión) confirma con nota → ok", r.rows?.[0]?.status === "confirmed", r);
let hist = await decisionesDe(idConflicto);
check("el hallazgo queda 'confirmed' y hay 1 decisión con quién la tomó", (await estadoDe(idConflicto)) === "confirmed" && hist.length === 1 && hist[0].decided_by === U.F, hist);
check("la nota se guarda sin espacios sobrantes", hist[0]?.note === "El proveedor Alfa no adjuntó nota de rediseño.", hist);

// Cambio de opinión = fila nueva; el historial nunca se encoge.
r = await decidir("E", idConflicto, "discarded", "Revisé la ficha técnica simulada: fue error de captura.");
hist = await decisionesDe(idConflicto);
check("cambiar de opinión agrega una fila (2 decisiones) y el estado sigue a la última (discarded)", hist.length === 2 && hist.map((d) => d.decision).join() === "confirmed,discarded" && (await estadoDe(idConflicto)) === "discarded", hist);
r = await decidir("E", idConflicto, "discarded", "Segunda nota con el mismo sentido.");
check("repetir la misma decisión con otra nota → también se guarda (3 filas)", (await decisionesDe(idConflicto)).length === 3, r);

// Aislamiento y permisos.
r = await decidir("C", idConflicto, "confirmed", "intento de otra org");
check("C (otra org) no decide sobre un hallazgo de E (mismo mensaje que 'no existe')", /Hallazgo no encontrado/.test(r.error ?? ""), r);
r = await decidir("D", idConflicto, "confirmed", "sin org");
check("usuario sin organización no decide", /organización/.test(r.error ?? ""), r);
r = await decidir("anon", idConflicto, "confirmed", "anon");
check("anon no ejecuta registrar_decision", negado(r), r);
r = await decidir("E", "00000000-0000-0000-0000-000000000000", "confirmed", "no existe");
check("hallazgo inexistente → 'Hallazgo no encontrado'", /Hallazgo no encontrado/.test(r.error ?? ""), r);
r = await as("C", `select count(*)::int n from decisions where org_id = $1`, [orgE]);
check("C (otra org) no ve decisiones de E", r.rows?.[0]?.n === 0, r);
r = await as("F", `select count(*)::int n from decisions where finding_id = $1`, [idConflicto]);
check("F (misma org) ve las 3 decisiones", r.rows?.[0]?.n === 3, r);

// Append-only: nadie edita ni borra una decisión.
const idDecision = (await db.query(`select id from decisions where finding_id = $1 order by decided_at limit 1`, [idConflicto])).rows[0].id;
for (const who of ["E", "F", "C", "anon"]) {
  r = await as(who, `update decisions set note = 'editada', decision = 'discarded' where id = $1 returning id`, [idDecision]);
  check(`${who} no puede editar una decisión`, negado(r) || r.rows?.length === 0, r);
  r = await as(who, `delete from decisions where id = $1 returning id`, [idDecision]);
  check(`${who} no puede borrar una decisión`, negado(r) || r.rows?.length === 0, r);
  r = await as(who, `insert into decisions (org_id, finding_id, decided_by, decision, note) values ($1, $2, $3, 'confirmed', 'directo')`, [orgE, idConflicto, U[who] ?? U.E]);
  check(`${who} no puede insertar una decisión directo (sin el RPC)`, negado(r), r);
}
r = await intentaSuper(`update decisions set note = 'editada' where id = $1`, [idDecision]);
check("ni el service role / SQL Editor edita una decisión (trigger)", /append-only/.test(r.error ?? ""), r);
r = await intentaSuper(`delete from decisions where id = $1`, [idDecision]);
check("ni el service role / SQL Editor borra una decisión (trigger)", /append-only/.test(r.error ?? ""), r);
r = await intentaSuper(`truncate decisions`);
check("ni el service role / SQL Editor hace truncate de decisiones", /append-only/.test(r.error ?? ""), r);
hist = await decisionesDe(idConflicto);
check("el historial sigue con 3 decisiones y la primera intacta", hist.length === 3 && hist[0].note === "El proveedor Alfa no adjuntó nota de rediseño.", hist);

// Consistencia por cualquier camino: insertar desde el SQL Editor también
// mueve el estado; con el org de otra organización, se rechaza.
await db.query(`insert into decisions (org_id, finding_id, decided_by, decision, note) values ($1, $2, $3, 'confirmed', 'desde el SQL Editor')`, [orgE, idFaltante, U.E]);
check("decisión insertada desde el SQL Editor → el estado del hallazgo la sigue (confirmed)", (await estadoDe(idFaltante)) === "confirmed");
r = await intentaSuper(`insert into decisions (org_id, finding_id, decided_by, decision, note) values ($1, $2, $3, 'discarded', 'org equivocada')`, [orgA, idFaltante, U.A]);
check("decisión con el org de otra organización → rechazada", /no corresponde a la organización/.test(r.error ?? ""), r);
r = (await db.query(`select current_setting('validador.desde_decision', true) b`)).rows[0].b;
check("la bandera de decisión no queda encendida después de decidir", (r ?? "") !== "on", r);
r = await intentaSuper(`update findings set status = 'pending' where id = $1`, [idFaltante]);
check("después de decidir, el estado sigue sin poder cambiarse directo", /decisión humana/.test(r.error ?? ""), r);

// De punta a punta con el motor. La fila SIM-1190/Alfa de v2 tiene DOS
// hallazgos: el conflicto (ya descartado) y un posible duplicado
// (FOL-SIM-0001, pendiente). Una fila se acepta solo si TODOS sus
// hallazgos están descartados: mientras el duplicado siga pendiente, la
// referencia sigue siendo 18.2.
const filasV5 = conCambio(filasV4, "SIM-1190", "Alfa", { weight_g: 30 });
const c5 = await cargarComoAccion("E", "proveedores_diciembre.csv", filasV5);
const conflicto5 = (await hallazgosDe("E", c5.res.rows?.[0]?.version_id)).find((h) => h.type === "value_conflict" && h.sku === "SIM-1190");
check("conflicto descartado pero duplicado PENDIENTE en la misma fila → la referencia sigue siendo 18.2", conflicto5?.details.cambios[0].anterior === 18.2 && conflicto5.details.cambios[0].nuevo === 30, conflicto5 ?? c5);
const idDup1190 = (await db.query(`select id from findings where org_id = $1 and type = 'possible_duplicate' and sku = 'SIM-1190'`, [orgE])).rows[0].id;
r = await decidir("F", idDup1190, "discarded", "El folio FOL-SIM-0001 sí es de SIM-1190; SIM-2034 lo citó por error.");
const filasV6 = conCambio(filasV5, "SIM-3307", "Alfa", { weight_g: 7.6 });
const c6 = await cargarComoAccion("E", "proveedores_diciembre_b.csv", filasV6);
const conflicto6 = (await hallazgosDe("E", c6.res.rows?.[0]?.version_id)).find((h) => h.type === "value_conflict" && h.sku === "SIM-1190");
check("con TODOS los hallazgos de la fila descartados, 24.5 pasa a ser la referencia: el 30 se compara contra 24.5", !r.error && conflicto6?.details.cambios[0].anterior === 24.5 && conflicto6.details.cambios[0].nuevo === 30, conflicto6 ?? c6);

for (const fn of ["decision_antes_de_insertar()", "decision_aplica_estado()", "decision_inmutable()"]) {
  r = await as("A", `select ${fn}`);
  check(`authenticated no ejecuta ${fn} (función de trigger)`, negado(r) || /trigger/.test(r.error ?? ""), r);
}
r = await ejecutablesPorAnon();
check("tras la Feature 4, anon sigue sin EXECUTE en ninguna función", r.length === 0, r);

// ---------- HTTP (opcional) ----------
const BASE = process.env.BASE_URL?.replace(/\/$/, "");
if (BASE) {
  const login = await fetch(`${BASE}/login`, { redirect: "manual" });
  check(`HTTP /login sin sesión → 200 (${BASE})`, login.status === 200, login.status);
  for (const ruta of ["/validador"]) {
    const res = await fetch(`${BASE}${ruta}`, { redirect: "manual" });
    const destino = res.headers.get("location") ?? "";
    check(`HTTP ${ruta} sin sesión → redirect a /login`, res.status >= 300 && res.status < 400 && /\/login$/.test(destino), [res.status, destino]);
  }
} else {
  console.log("SKIP HTTP (define BASE_URL para probar /login y /validador)");
}

console.log(`\n${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
