import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { CATALOGO, SEMBRADOS } from "../lib/supuestos.ts";

// Prueba mecánica de sql/schema.sql en Postgres real (PGlite, WASM), sin
// Supabase: stub de roles anon/authenticated, auth.uid()/auth.jwt() y los
// default privileges que Supabase da a funciones y tablas nuevas (la causa
// del bug de anon en w08). No sustituye la prueba con la llave pública
// contra el proyecto real (scripts/probar-anon.sh).
//
// Uso: npm run test:schema
// Con BASE_URL=https://… (o http://localhost:3000) prueba además las rutas
// por HTTP: /login 200 sin sesión y /modelo → /login.
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

// ---------- Feature 1: organizaciones ----------
const a = await as("A", `select * from create_org('Libro Simulado Uno')`);
const orgA = a.rows?.[0]?.org_id, code = a.rows?.[0]?.join_code;
check("A crea org con código ABC-234", !!orgA && /^[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(code), a);
check("B se une con código (minúsculas)", !(await as("B", `select * from join_org($1)`, [code.toLowerCase()])).error);
const c = await as("C", `select * from create_org('Libro Simulado Dos')`);
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
// (create_org ya sembró los supuestos de ejemplo desde la Feature 2.)
await db.query(`insert into assumptions (org_id, key, value_num, unit, status) values ($1,'estudiantes_anio',2000,'estudiantes/año','invented'), ($2,'estudiantes_anio',10,'estudiantes/año','invented') on conflict do nothing`, [orgA, orgC]);
await db.query(`insert into payer_evidence (org_id, kind, description, document_ref, recorded_by, recorded_on) values ($1,'carta','Simulada','doc-1',$2,'2026-10-01'), ($3,'carta','Simulada','doc-2',$4,'2026-10-01')`, [orgA, U.A, orgC, U.C]);
await db.query(`insert into published_ledger (org_id, version, content) values ($1, 1, '{"v":1}'), ($2, 1, '{"v":1}')`, [orgA, orgC]);

const TABLAS = ["organizations", "profiles", "assumptions", "payer_evidence", "published_ledger"];
for (const t of TABLAS) {
  r = await as("C", `select * from ${t}`);
  const fuga = (r.rows ?? []).some((x) => x.org_id === orgA || x.id === orgA);
  check(`C (otra org) no ve ${t} de A`, !r.error && !fuga && r.rows.length >= 1, r);
  r = await as("A", `select * from ${t}`);
  check(`A ve ${t} de su org`, !r.error && r.rows.length >= 1, r);
}
r = await as("C", `insert into assumptions (org_id, key, value_num, unit, status) values ($1,'precio_mensual',1,'MXN/mes','invented')`, [orgA]);
check("C no puede escribir supuestos en la org de A", /row-level security/.test(r.error), r);
r = await as("C", `update assumptions set value_num = 1 where org_id = $1 returning id`, [orgA]);
check("C no puede editar supuestos de A", r.rows?.length === 0, r);
r = await as("C", `delete from assumptions where org_id = $1 returning id`, [orgA]);
check("C no puede borrar supuestos de A", r.rows?.length === 0, r);

// ---------- anon: solo lee published_ledger ----------
for (const t of TABLAS.filter((t) => t !== "published_ledger")) {
  r = await as("anon", `select * from ${t}`);
  check(`anon no lee ${t}`, vacioONegado(r), r);
}
r = await as("anon", `select org_id, version from published_ledger`);
check("anon lee published_ledger", r.rows?.length === 2, r);
for (const [t, sql] of [
  ["published_ledger", `insert into published_ledger (org_id, version, content) values ('${orgA}', 9, '{}')`],
  ["published_ledger (update)", `update published_ledger set content='{}'`],
  ["published_ledger (delete)", `delete from published_ledger`],
  ["assumptions", `insert into assumptions (org_id, key, value_num, unit, status) values ('${orgA}','x_y',1,'u','invented')`],
  ["payer_evidence", `insert into payer_evidence (org_id, kind, description, document_ref, recorded_on) values ('${orgA}','carta','x','x','2026-10-01')`],
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
// Toda función de public debe estar cubierta por esta lista: si alguien
// agrega una sin probarla, falla aquí.
const todas = (await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).rows.map((x) => x.proname);
const ejecutables = [];
for (const fn of todas) {
  const priv = (await db.query(`select has_function_privilege('anon', p.oid, 'execute') e from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname=$1`, [fn])).rows;
  if (priv.some((x) => x.e)) ejecutables.push(fn);
}
check("anon no tiene EXECUTE en ninguna función de public", ejecutables.length === 0, ejecutables);

// ---------- RLS encendido en todas las tablas ----------
const sinRls = (await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)).rows;
check("RLS encendido en todas las tablas de public", sinRls.length === 0, sinRls);

// ---------- Feature 2: registro de supuestos ----------
r = await as("A", `select key, value_num::float8 v, unit, status, source_url from assumptions order by key`);
const sembradosBase = Object.fromEntries((r.rows ?? []).map((x) => [x.key, x]));
check("create_org siembra exactamente los 7 supuestos del mockup",
  r.rows?.length === SEMBRADOS.length && SEMBRADOS.every((x) => sembradosBase[x.key]?.v === x.value_num), r);
check("los 7 sembrados son 'invented' y sin fuente", r.rows?.every((x) => x.status === "invented" && x.source_url === null), r);
check("unidades sembradas = catálogo de lib/supuestos.ts", r.rows?.every((x) => CATALOGO[x.key]?.unidad === x.unit), r);
check("no se siembra la pérdida evitada (10:1 no calculable sin evidencia)", !sembradosBase.perdida_evitada_suscriptor_anio, r);
r = await as("B", `select count(*)::int n from assumptions`);
check("B (se unió) ve los 7 de su org, sin sembrar otra copia", r.rows?.[0]?.n === 7, r);

const idConv = (await as("A", `select id from assumptions where key='conversion_suscripcion'`)).rows[0].id;
const upd = (who, set) => as(who, `update assumptions set ${set} where id='${idConv}' returning status, source_url`);
r = await upd("A", `status='sustained'`);
check("sustained sin URL ni fecha → rechazado por la base", /assumptions_sustained_needs_source/.test(r.error), r);
r = await upd("A", `status='sustained', source_url='https://ejemplo.org/estudio'`);
check("sustained con URL pero sin fecha → rechazado", /assumptions_sustained_needs_source/.test(r.error), r);
r = await upd("A", `status='sustained', source_date='2026-09-01'`);
check("sustained con fecha pero sin URL → rechazado", /assumptions_sustained_needs_source/.test(r.error), r);
r = await as("A", `insert into assumptions (org_id, key, value_num, unit, status) values ($1,'perdida_evitada_suscriptor_anio',100,'MXN/suscriptor/año','sustained')`, [orgA]);
check("insert sustained sin fuente → rechazado", /assumptions_sustained_needs_source/.test(r.error), r);
try { await db.query(`update assumptions set status='sustained' where id=$1`, [idConv]); r = {}; } catch (e) { r = { error: e.message }; }
check("sustained sin fuente rechazado aun como superusuario (service role / SQL Editor)", /assumptions_sustained_needs_source/.test(r.error), r);
r = await upd("A", `status='sustained', source_url='https://ejemplo.org/estudio', source_date='2026-09-01'`);
check("sustained con URL y fecha → se guarda", r.rows?.[0]?.status === "sustained", r);
r = await upd("A", `source_url=null`);
check("quitar la fuente a un sustained → rechazado", /assumptions_sustained_needs_source/.test(r.error), r);
r = await upd("A", `status='weak', source_url=null, source_date=null`);
check("weak sin fuente → se guarda", r.rows?.[0]?.status === "weak", r);
r = await upd("A", `status='invented'`);
check("invented sin fuente → se guarda", r.rows?.[0]?.status === "invented", r);
r = await upd("A", `source_url='javascript:alert(1)'`);
check("URL que no es http(s) → rechazada por la base", /assumptions_source_url_http/.test(r.error), r);
r = await upd("A", `value_num=-1`);
check("valor negativo → rechazado por la base", /assumptions_value_range/.test(r.error), r);
r = await upd("A", `value_num='NaN'`);
check("NaN → rechazado por la base", !!r.error, r);
r = await upd("A", `value_num='Infinity'`);
check("Infinity → rechazado por la base", !!r.error, r);
r = await upd("A", `value_num=10000001`);
check("valor > 10,000,000 → rechazado por la base", /assumptions_value_range/.test(r.error), r);
r = await upd("A", `unit='MXN/mes'`);
check("unidad que no corresponde a la clave → rechazada", /assumptions_key_unit_catalog/.test(r.error), r);
r = await as("A", `insert into assumptions (org_id, key, value_num, unit, status) values ($1,'comision_x',1,'%','invented')`, [orgA]);
check("clave fuera del catálogo → rechazada", /assumptions_key_unit_catalog/.test(r.error), r);
for (const [key, def] of Object.entries(CATALOGO)) {
  try {
    await db.query(`begin`);
    await db.query(`insert into assumptions (org_id, key, value_num, unit, status) values ($1,$2,1,$3,'invented') on conflict (org_id, key) do update set unit = excluded.unit`, [orgC, key, def.unidad]);
    r = {};
  } catch (e) { r = { error: e.message }; } finally { await db.query(`rollback`); }
  check(`catálogo TS = base: ${key} (${def.unidad}) aceptada`, !r.error, r);
}
r = await upd("A", `key='precio_mensual'`);
check("cliente no puede cambiar la clave de un supuesto", negado(r), r);
r = await upd("A", `org_id='${orgC}'`);
check("cliente no puede mover un supuesto a otra org", negado(r), r);
r = await as("A", `insert into assumptions (org_id, key, value_num, unit, status, created_at) values ($1,'perdida_evitada_suscriptor_anio',1,'MXN/suscriptor/año','invented','2000-01-01')`, [orgA]);
check("cliente no puede escribir created_at", negado(r), r);
const antesUpd = (await db.query(`select updated_at from assumptions where id=$1`, [idConv])).rows[0].updated_at;
await new Promise((res) => setTimeout(res, 15));
await upd("A", `value_num=3.5`);
const despuesUpd = (await db.query(`select updated_at from assumptions where id=$1`, [idConv])).rows[0].updated_at;
check("updated_at lo actualiza la base", despuesUpd > antesUpd, [antesUpd, despuesUpd]);

r = await as("A", `select sembrar_supuestos_ejemplo() n`);
check("sembrar_supuestos_ejemplo no toca los que existen (0 nuevos)", r.rows?.[0]?.n === 0, r);
r = await as("A", `select value_num::float8 v from assumptions where id=$1`, [idConv]);
check("…y no pisa el valor editado (3.5 sigue)", r.rows?.[0]?.v === 3.5, r);
await as("A", `delete from assumptions where key='costo_hora'`);
r = await as("A", `select sembrar_supuestos_ejemplo() n`);
check("borrado uno → sembrar vuelve a cargar solo ese (1 nuevo)", r.rows?.[0]?.n === 1, r);
r = await as("C", `select sembrar_supuestos_ejemplo() n`);
const enA = (await db.query(`select count(*)::int n from assumptions where org_id=$1`, [orgA])).rows[0].n;
check("C siembra solo en su org (A sigue con 7)", !r.error && enA === 7, [r, enA]);
r = await as("A", `select sembrar_supuestos($1)`, [orgC]);
check("authenticated no ejecuta sembrar_supuestos(org arbitraria)", negado(r), r);
r = await as("anon", `select sembrar_supuestos_ejemplo()`);
check("anon no ejecuta sembrar_supuestos_ejemplo", negado(r), r);
r = await as("A", `select tocar_updated_at()`);
check("authenticated no ejecuta tocar_updated_at", negado(r) || /trigger/.test(r.error ?? ""), r);

// ---------- Volver a correr el schema con datos ----------
const foto = async () => (await db.query(`select
  (select count(*) from organizations)::int o, (select count(*) from profiles)::int p,
  (select count(*) from assumptions)::int a, (select count(*) from payer_evidence)::int e,
  (select count(*) from published_ledger)::int l,
  (select count(*) from pg_policies where schemaname='public')::int pol,
  (select coalesce(sum(value_num),0)::float8 from assumptions) suma,
  (select string_agg(key || ':' || status || ':' || coalesce(source_url,''), ',' order by org_id, key) from assumptions) detalle`)).rows[0];
const antesRerun = await foto();
r = {};
try { await db.exec(schema); await db.exec(schema); } catch (e) { r = { error: e.message }; }
check("schema corre 2 veces más con datos, sin errores", !r.error, r);
const despuesRerun = await foto();
check("…sin perder ni cambiar filas, valores, estados ni policies", JSON.stringify(antesRerun) === JSON.stringify(despuesRerun), [antesRerun, despuesRerun]);
r = await as("A", `select value_num::float8 v from assumptions where id=$1`, [idConv]);
check("…y el valor editado (3.5) no se re-sembró", r.rows?.[0]?.v === 3.5, r);

const ejecutables2 = [];
for (const fn of (await db.query(`select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).rows) {
  if ((await db.query(`select has_function_privilege('anon', $1::oid, 'execute') e`, [fn.oid])).rows[0].e) ejecutables2.push(fn.proname);
}
check("tras la Feature 2, anon sigue sin EXECUTE en ninguna función", ejecutables2.length === 0, ejecutables2);

// ---------- HTTP (opcional) ----------
const BASE = process.env.BASE_URL?.replace(/\/$/, "");
if (BASE) {
  const login = await fetch(`${BASE}/login`, { redirect: "manual" });
  check(`HTTP /login sin sesión → 200 (${BASE})`, login.status === 200, login.status);
  const modelo = await fetch(`${BASE}/modelo`, { redirect: "manual" });
  const destino = modelo.headers.get("location") ?? "";
  check("HTTP /modelo sin sesión → redirect a /login", modelo.status >= 300 && modelo.status < 400 && /\/login$/.test(destino), [modelo.status, destino]);
} else {
  console.log("SKIP HTTP (define BASE_URL para probar /login y /modelo)");
}

console.log(`\n${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
