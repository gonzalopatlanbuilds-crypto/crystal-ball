import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { leerCsv } from "../lib/csv.ts";
import { CSV_EJEMPLO, NOMBRE_EJEMPLO } from "../lib/ejemplo.ts";

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
    `insert into findings (org_id, evidence_version_id, type, sku, supplier) values ($1, $2, 'value_conflict', 'SIM-001', 'Proveedor Simulado') returning id`,
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
r = await intentaSuper(`insert into findings (org_id, evidence_version_id, type, sku) values ($1, $2, 'cumple', 'X')`, [orgA, filasA.v]);
check("tipo de hallazgo fuera de la lista → rechazado", /findings_type_check/.test(r.error), r);
r = await intentaSuper(`insert into findings (org_id, evidence_version_id, type, sku, status) values ($1, $2, 'value_conflict', 'X', 'resuelto')`, [orgA, filasA.v]);
check("estado de hallazgo fuera de pending/confirmed/discarded → rechazado", /findings_status_check/.test(r.error), r);

// ---------- Feature 2: carga y versionado append-only ----------
const ej = leerCsv(CSV_EJEMPLO, "2026-10-25");
check("el CSV de ejemplo se lee completo (10 filas, 0 rechazadas)", ej.ok && ej.filas.length === 10 && ej.rechazadas.length === 0, ej);
const filasEj = JSON.stringify(ej.filas);
const registrar = (who, filas, invalidas = "[]", nombre = "proveedor_octubre.csv", ejemplo = false) =>
  as(who, `select * from registrar_version($1, $2::jsonb, $3::jsonb, $4)`, [nombre, filas, invalidas, ejemplo]);
const versionesDe = async (org) => (await db.query(`select count(*)::int n from evidence_versions where org_id = $1`, [org])).rows[0].n;

const antesA = await versionesDe(orgA);
r = await registrar("A", filasEj, JSON.stringify([{ fila: 12, motivo: "weight_g: \"1e3\" no es un número válido" }]), NOMBRE_EJEMPLO, true);
const v1 = r.rows?.[0];
check("A registra el ejemplo como versión nueva (duplicada = false)", v1 && v1.duplicada === false && (await versionesDe(orgA)) === antesA + 1, r);
r = await as("B", `select uploaded_by, source_filename, is_example, jsonb_array_length(raw_rows) n, invalid_rows, content_sha256 from evidence_versions where id = $1`, [v1?.version_id]);
const filaV1 = r.rows?.[0];
check("procedencia: uploaded_by = quien subió (A), archivo y marca de ejemplo", filaV1?.uploaded_by === U.A && filaV1?.source_filename === NOMBRE_EJEMPLO && filaV1?.is_example === true, r);
check("B (misma org) ve la versión de A con sus 10 filas", filaV1?.n === 10, r);
check("las filas rechazadas se guardan con su motivo (no se tiran)", filaV1?.invalid_rows?.[0]?.fila === 12 && /1e3/.test(filaV1?.invalid_rows?.[0]?.motivo), r);
check("la huella la calcula la base (sha256 hex)", /^[0-9a-f]{64}$/.test(filaV1?.content_sha256 ?? "") && filaV1?.content_sha256 !== "0".repeat(64), r);

r = await registrar("B", filasEj);
check("recarga idéntica (por B, misma org) → duplicada, devuelve la versión existente, no guarda", r.rows?.[0]?.duplicada === true && r.rows?.[0]?.version_id === v1?.version_id && (await versionesDe(orgA)) === antesA + 1, r);
const reordenadas = JSON.stringify([...ej.filas].reverse().map((f, i) => ({ ...f, fila: i + 2 })));
r = await registrar("A", reordenadas);
check("mismas filas en otro orden (otros números de fila) → duplicada", r.rows?.[0]?.duplicada === true, r);
const cambiada = JSON.stringify(ej.filas.map((f) => (f.sku === "SIM-1190" && /Alfa/.test(f.supplier) ? { ...f, weight_g: 24.5 } : f)));
r = await registrar("A", cambiada);
const v2 = r.rows?.[0];
check("un peso distinto → versión nueva", v2?.duplicada === false && v2.version_id !== v1.version_id && (await versionesDe(orgA)) === antesA + 2, r);
r = await registrar("A", filasEj);
check("volver al contenido de una versión VIEJA (v1) → sí es versión nueva (solo se compara con la última)", r.rows?.[0]?.duplicada === false && (await versionesDe(orgA)) === antesA + 3, r);
r = await registrar("C", filasEj);
check("otra org sube el mismo contenido → versión nueva en SU org (la duplicidad es por org)", r.rows?.[0]?.duplicada === false, r);

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
