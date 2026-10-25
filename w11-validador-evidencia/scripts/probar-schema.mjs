import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

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
    `insert into evidence_versions (org_id, uploaded_by, source_filename, raw_rows, content_sha256) values ($1, $2, 'simulado.csv', '[]', $3) returning id`,
    [org, user, HASH])).rows[0].id;
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
