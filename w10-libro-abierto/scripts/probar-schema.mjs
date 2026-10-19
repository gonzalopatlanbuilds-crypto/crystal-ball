import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { CATALOGO, SEMBRADOS } from "../lib/supuestos.ts";
import { calcularViabilidad } from "../lib/viabilidad.ts";
import { DATOS_GUARDADOS } from "../lib/datos-guardados.ts";
import { sqlLibroPublico } from "../lib/libro-publico.ts";

// PRNG con semilla fija: los casos al azar son reproducibles.
let semillaS = 20261018;
const azarS = () => ((semillaS = (semillaS * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

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
// Contenido mínimo válido de un snapshot nuevo (formato 2): la marca de
// datos simulados y los conteos REALES de evidencia de la org (la base los
// revisa al publicar). Se leen como superusuario.
async function contenidoValido(org, viab) {
  const { registros, simuladas } = (await db.query(
    `select count(*)::int registros, (count(*) filter (where simulada))::int simuladas from payer_evidence where org_id = $1`, [org])).rows[0];
  return { viabilidad: viab, datos_simulados: true, evidencia_pagador: { registros, simuladas } };
}
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
await db.query(`insert into payer_evidence (org_id, kind, description, document_ref, recorded_by, recorded_on) values ($1,'carta_intencion','Simulada','doc-1',$2,'2026-10-01'), ($3,'carta_intencion','Simulada','doc-2',$4,'2026-10-01')`, [orgA, U.A, orgC, U.C]);
// Desde la Feature 4 solo publica una org oficial y con la viabilidad que
// calcula la base (las dos tienen evidencia y supuestos inventados).
await db.query(`update organizations set es_oficial = true where id in ($1, $2)`, [orgA, orgC]);
for (const org of [orgA, orgC]) {
  await db.query(`insert into published_ledger (org_id, viability, content) values ($1, 'EVIDENCE_RECORDED_NOT_SUPPORTED', $2::jsonb)`, [org, JSON.stringify(await contenidoValido(org, "EVIDENCE_RECORDED_NOT_SUPPORTED"))]);
}

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
  ["payer_evidence", `insert into payer_evidence (org_id, kind, description, document_ref, recorded_on) values ('${orgA}','carta_intencion','x','x','2026-10-01')`],
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

// ---------- Feature 4: evidencia, viabilidad, publicar, libro público ----------
// Org oficial (D y E) y org NO oficial (F). G: org oficial sin evidencia.
Object.assign(U, {
  D: "dddddddd-0000-0000-0000-000000000004",
  E: "eeeeeeee-0000-0000-0000-000000000005",
  F: "ffffffff-0000-0000-0000-000000000006",
  G: "99999999-0000-0000-0000-000000000007",
});
for (const k of ["D", "E", "F", "G"]) await db.query(`insert into auth.users values ($1, $2)`, [U[k], `${k}@test.mx`]);
const od = await as("D", `select * from create_org('Oficial simulada')`);
const orgD = od.rows[0].org_id;
await as("E", `select * from join_org($1)`, [od.rows[0].join_code]);
const orgF = (await as("F", `select * from create_org('No oficial simulada')`)).rows[0].org_id;
const orgG = (await as("G", `select * from create_org('Oficial sin evidencia')`)).rows[0].org_id;

r = await as("D", `select es_oficial from organizations`);
check("una org nueva nace NO oficial", r.rows?.[0]?.es_oficial === false, r);
r = await as("D", `update organizations set es_oficial = true where id = $1 returning id`, [orgD]);
check("ATAQUE: el cliente no puede ponerse es_oficial = true", negado(r) || r.rows?.length === 0, r);
r = await as("D", `insert into organizations (name, join_code, es_oficial) values ('x', 'XYZ-234', true)`);
check("ATAQUE: el cliente no puede crear una org oficial", negado(r), r);
r = await as("D", `select * from create_org('y')`);
check("create_org no acepta un segundo intento ni toca es_oficial", !!r.error, r);
// Solo desde el SQL Editor (superusuario):
await db.query(`update organizations set es_oficial = true where id in ($1, $2)`, [orgD, orgG]);

// `extra` se mezcla encima del contenido válido (para los ataques).
const pub = async (who, org, viab, extra = {}) =>
  as(who, `insert into published_ledger (org_id, viability, content) values ($1, $2, $3::jsonb) returning version, oficial, viability`,
    [org, viab, JSON.stringify({ ...(await contenidoValido(org, viab)), ...extra })]);
const pubSuper = async (org, viab, extra = "") => {
  try {
    const x = await db.query(`insert into published_ledger (org_id, viability, content${extra ? ", version" : ""}) values ($1, $2, $3::jsonb${extra ? ", " + extra : ""}) returning version`, [org, viab, JSON.stringify(await contenidoValido(org, viab))]);
    return { rows: x.rows };
  } catch (e) { return { error: e.message }; }
};
const estadoSql = async (org) => (await db.query(`select estado_viabilidad($1) e`, [org])).rows[0].e;

// Sin evidencia.
check("SQL: sin evidencia → NOT_DEMONSTRATED", (await estadoSql(orgD)) === "NOT_DEMONSTRATED");
r = await pub("D", orgD, "SUPPORTED");
check("ATAQUE: publicar SUPPORTED sin evidencia (API) → rechazado", /la base calcula NOT_DEMONSTRATED/.test(r.error), r);
r = await pubSuper(orgG, "SUPPORTED");
check("ATAQUE: SUPPORTED sin evidencia como superusuario (service role / SQL Editor) → rechazado", /la base calcula NOT_DEMONSTRATED/.test(r.error), r);
r = await pub("D", orgD, "EVIDENCE_RECORDED_NOT_SUPPORTED");
check("ATAQUE: mentir 'evidencia registrada' sin evidencia → rechazado", /la base calcula NOT_DEMONSTRATED/.test(r.error), r);
r = await pub("D", orgD, "NOT_DEMONSTRATED");
check("publicar NOT_DEMONSTRATED (org oficial) → versión 1, oficial", r.rows?.[0]?.version === 1 && r.rows[0].oficial === true, r);
r = await pub("E", orgD, "NOT_DEMONSTRATED");
check("otra persona de la org oficial publica → versión 2", r.rows?.[0]?.version === 2, r);

// Columnas que pone la base.
r = await as("D", `insert into published_ledger (org_id, viability, content, version) values ($1, 'NOT_DEMONSTRATED', '{"viabilidad":"NOT_DEMONSTRATED"}', 99)`, [orgD]);
check("ATAQUE: el cliente no elige la versión", negado(r), r);
r = await as("D", `insert into published_ledger (org_id, viability, content, oficial) values ($1, 'NOT_DEMONSTRATED', '{"viabilidad":"NOT_DEMONSTRATED"}', true)`, [orgF]);
check("ATAQUE: el cliente no escribe `oficial`", negado(r), r);
r = await as("D", `insert into published_ledger (org_id, viability, content, published_at) values ($1, 'NOT_DEMONSTRATED', '{"viabilidad":"NOT_DEMONSTRATED"}', '2000-01-01')`, [orgD]);
check("ATAQUE: el cliente no elige la fecha de publicación", negado(r), r);
r = await pubSuper(orgD, "NOT_DEMONSTRATED", "500");
check("aun como superusuario, la versión la pone la base (siguiente = 3, no 500)", r.rows?.[0]?.version === 3, r);

// Contenido.
r = await pub("D", orgD, "NOT_DEMONSTRATED", { viabilidad: "SUPPORTED" });
check("ATAQUE: columna NOT_DEMONSTRATED pero el contenido dice SUPPORTED → rechazado", /published_ledger_viability_matches_content/.test(r.error), r);
r = await pub("D", orgD, "NOT_DEMONSTRATED", { viabilidad: "NOT_DEMONSTRATED", contacto: "persona@correo.mx" });
check("ATAQUE: un correo dentro del snapshot → rechazado", /published_ledger_no_email/.test(r.error), r);
r = await pub("D", orgD, "NOT_DEMONSTRATED", { viabilidad: "NOT_DEMONSTRATED", relleno: "x".repeat(200000) });
check("ATAQUE: snapshot gigante (200 KB) → rechazado", /published_ledger_content_size/.test(r.error), r);
{
  const sinViab = await contenidoValido(orgD, "NOT_DEMONSTRATED");
  delete sinViab.viabilidad;
  r = await as("D", `insert into published_ledger (org_id, viability, content) values ($1, 'NOT_DEMONSTRATED', $2::jsonb)`, [orgD, JSON.stringify(sinViab)]);
  check("ATAQUE: snapshot SIN la clave viabilidad (NULL en el check) → rechazado", /published_ledger_viability_matches_content/.test(r.error), r);
}
r = await pub("D", orgD, "TOTALMENTE_VIABLE", { viabilidad: "TOTALMENTE_VIABLE" });
check("ATAQUE: un estado inventado ('TOTALMENTE_VIABLE') → rechazado", !!r.error, r);

// Org NO oficial.
r = await pub("F", orgF, "NOT_DEMONSTRATED");
check("una org NO oficial no puede publicar", /Solo la organización oficial/.test(r.error), r);
r = await pubSuper(orgF, "NOT_DEMONSTRATED");
check("…ni siquiera como superusuario", /Solo la organización oficial/.test(r.error), r);
r = await pub("F", orgD, "NOT_DEMONSTRATED");
check("ATAQUE: F publica a nombre de la org oficial → rechazado por RLS", /row-level security/.test(r.error), r);

// Evidencia.
r = await as("D", `insert into payer_evidence (org_id, kind, description, document_ref, recorded_on, recorded_by) values ($1,'carta_intencion','x','x','2026-10-01',$2)`, [orgD, U.F]);
check("ATAQUE: falsificar quién registró la evidencia → rechazado", negado(r), r);
r = await as("F", `insert into payer_evidence (org_id, kind, description, document_ref, recorded_on) values ($1,'carta_intencion','x','x','2026-10-01')`, [orgD]);
check("ATAQUE: registrar evidencia en otra org → rechazado por RLS", /row-level security/.test(r.error), r);
r = await as("D", `insert into payer_evidence (org_id, kind, description, document_ref, recorded_on) values ($1,'comision','x','x','2026-10-01')`, [orgD]);
check("tipo de evidencia 'comision' → rechazado por la base", /payer_evidence_kind_list/.test(r.error), r);
r = await as("D", `insert into payer_evidence (org_id, kind, description, document_ref, recorded_on) values ($1,'otro','x','x', current_date + 30)`, [orgD]);
check("fecha de evidencia futura → rechazada por la base", /payer_evidence_recorded_on_range/.test(r.error), r);
r = await as("D", `insert into payer_evidence (org_id, kind, description, document_ref, recorded_on) values ($1,'carta_intencion','Universidad simulada','Folio SIM-1','2026-10-01') returning recorded_by`, [orgD]);
check("D registra evidencia; recorded_by = D (lo pone la base)", r.rows?.[0]?.recorded_by === U.D, r);
r = await as("D", `update payer_evidence set description = 'otra' returning id`);
check("la evidencia no se puede editar", negado(r) || r.rows?.length === 0, r);
r = await as("D", `delete from payer_evidence returning id`);
check("la evidencia no se puede borrar desde la app", negado(r) || r.rows?.length === 0, r);

check("SQL: con evidencia + supuestos inventados → EVIDENCE_RECORDED_NOT_SUPPORTED", (await estadoSql(orgD)) === "EVIDENCE_RECORDED_NOT_SUPPORTED");
r = await pub("D", orgD, "SUPPORTED");
check("ATAQUE: SUPPORTED con evidencia pero supuestos inventados → rechazado", /la base calcula EVIDENCE_RECORDED_NOT_SUPPORTED/.test(r.error), r);
r = await pub("D", orgD, "NOT_DEMONSTRATED");
check("ATAQUE: esconder la evidencia publicando NOT_DEMONSTRATED → rechazado", /la base calcula EVIDENCE_RECORDED_NOT_SUPPORTED/.test(r.error), r);

// Todo sustentado + pérdida evitada.
await as("D", `update assumptions set status='sustained', source_url='https://ejemplo.org/fuente-simulada', source_date='2026-09-01'`);
await as("D", `insert into assumptions (org_id, key, value_num, unit, status, source_url, source_date) values ($1,'perdida_evitada_suscriptor_anio',5879,'MXN/suscriptor/año','sustained','https://ejemplo.org/x','2026-09-01')`, [orgD]);
check("SQL: todo sustentado pero 5,879 < 5,880 → EVIDENCE_RECORDED_NOT_SUPPORTED (borde exacto)", (await estadoSql(orgD)) === "EVIDENCE_RECORDED_NOT_SUPPORTED");
await as("D", `update assumptions set value_num = 5880 where key = 'perdida_evitada_suscriptor_anio'`);
check("SQL: 5,880 = 10 × 588 → SUPPORTED", (await estadoSql(orgD)) === "SUPPORTED");
r = await pub("D", orgD, "SUPPORTED");
check("publicar SUPPORTED con evidencia + todo sustentado + 10:1 → ok", !r.error && r.rows?.[0]?.viability === "SUPPORTED", r);
await as("D", `update assumptions set status = 'weak' where key = 'costo_hora'`);
check("SQL: un insumo pasa a 'weak' → deja de ser SUPPORTED", (await estadoSql(orgD)) === "EVIDENCE_RECORDED_NOT_SUPPORTED");
await as("D", `update assumptions set status = 'sustained' where key = 'costo_hora'`);
await db.query(`delete from payer_evidence where org_id = $1`, [orgD]);
check("SQL: se borra la evidencia (superusuario) → vuelve a NOT_DEMONSTRATED", (await estadoSql(orgD)) === "NOT_DEMONSTRATED");
r = await pub("D", orgD, "SUPPORTED");
check("ATAQUE: SUPPORTED justo después de borrar la evidencia → rechazado", /la base calcula NOT_DEMONSTRATED/.test(r.error), r);

// La regla SQL = la regla TS, en 60 casos al azar.
let coinciden = 0;
const diferencias = [];
for (let i = 0; i < 60; i++) {
  await db.query(`delete from assumptions where org_id = $1`, [orgG]);
  await db.query(`delete from payer_evidence where org_id = $1`, [orgG]);
  const conEv = azarS() < 0.7;
  if (conEv) await db.query(`insert into payer_evidence (org_id, kind, description, document_ref, recorded_by, recorded_on) values ($1,'otro','x','x',$2,'2026-10-01')`, [orgG, U.G]);
  const filas = [];
  for (const [key, def] of Object.entries(CATALOGO)) {
    if (azarS() < 0.1) continue;
    const status = azarS() < 0.75 ? "sustained" : azarS() < 0.5 ? "weak" : "invented";
    let v = key === "perdida_evitada_suscriptor_anio" ? Math.round(azarS() * 12000) : key === "precio_mensual" ? (azarS() < 0.05 ? 0 : Math.round(azarS() * 10000) / 100) : Math.round(azarS() * Math.min(def.max, 5000));
    filas.push({ key, value_num: v, status });
    await db.query(`insert into assumptions (org_id, key, value_num, unit, status, source_url, source_date) values ($1,$2,$3,$4,$5,$6,$7)`,
      [orgG, key, v, def.unidad, status, status === "sustained" ? "https://ejemplo.org" : null, status === "sustained" ? "2026-09-01" : null]);
  }
  const sql = await estadoSql(orgG);
  const ts = calcularViabilidad(conEv, filas);
  if (sql === ts) coinciden++; else diferencias.push({ sql, ts, conEv, filas });
}
check("estado_viabilidad (SQL) = calcularViabilidad (TS) en 60 casos al azar", coinciden === 60, diferencias.slice(0, 2));

// Inmutabilidad.
r = await as("D", `update published_ledger set content = '{"viabilidad":"SUPPORTED"}' returning id`);
check("ATAQUE: editar un snapshot publicado (API) → rechazado", negado(r) || r.rows?.length === 0, r);
r = await as("D", `delete from published_ledger returning id`);
check("ATAQUE: borrar un snapshot (API) → rechazado", negado(r) || r.rows?.length === 0, r);
for (const [nombre, sql] of [
  ["editar", `update published_ledger set viability = 'SUPPORTED', content = '{"viabilidad":"SUPPORTED"}' where org_id = '${orgD}'`],
  ["editar `oficial` directo", `update published_ledger set oficial = false where org_id = '${orgD}'`],
  ["borrar", `delete from published_ledger where org_id = '${orgD}'`],
  ["truncate", `truncate published_ledger`],
]) {
  try { await db.query(sql); r = {}; } catch (e) { r = { error: e.message }; }
  check(`ATAQUE: ${nombre} el libro como superusuario → rechazado (inmutable)`, /inmutable/.test(r.error), r);
}

// Vista pública.
const deD = async () => (await as("anon", `select version from published_ledger where org_id = $1`, [orgD])).rows?.length ?? -1;
check("anon ve los snapshots de la org oficial", (await deD()) === 4);
// G publica mientras es oficial y después deja de serlo: así la prueba
// tiene filas que podrían fugarse (sin esto pasaba aunque anon viera todo).
r = await pubSuper(orgG, await estadoSql(orgG));
await db.query(`update organizations set es_oficial = false where id = $1`, [orgG]);
const filasG = (await db.query(`select count(*)::int n from published_ledger where org_id = $1`, [orgG])).rows[0].n;
r = await as("anon", `select org_id from published_ledger where org_id in ($1, $2)`, [orgF, orgG]);
check("anon no ve nada de una org no oficial (aunque tenga snapshots)", filasG === 1 && r.rows?.length === 0, [filasG, r]);
await db.query(`update organizations set es_oficial = false where id = $1`, [orgD]);
check("la org deja de ser oficial → sus snapshots salen de la vista pública", (await deD()) === 0);
r = await pub("D", orgD, "NOT_DEMONSTRATED");
check("…y ya no puede publicar", /Solo la organización oficial/.test(r.error), r);
await db.query(`update organizations set es_oficial = true where id = $1`, [orgD]);
check("vuelve a ser oficial → sus snapshots regresan", (await deD()) === 4);
r = await as("D", `select count(*)::int n from published_ledger`);
check("D (authenticated) ve los de su org", r.rows?.[0]?.n === 4, r);
r = await as("F", `select count(*)::int n from published_ledger where org_id = $1`, [orgD]);
check("F (otra org, con sesión) no ve los de D por la API autenticada", r.rows?.[0]?.n === 0, r);

// "Qué datos guardamos" = tablas y columnas reales.
const reales = (await db.query(`select table_name, column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`)).rows;
const realesMapa = {};
for (const x of reales) (realesMapa[x.table_name] ??= []).push(x.column_name);
const declarado = Object.fromEntries(DATOS_GUARDADOS.map((t) => [t.tabla, [...t.columnas].sort()]));
const real = Object.fromEntries(Object.entries(realesMapa).map(([t, c]) => [t, [...c].sort()]));
check("'Qué datos guardamos' coincide con las tablas y columnas reales", JSON.stringify(declarado, Object.keys(declarado).sort()) === JSON.stringify(real, Object.keys(real).sort()), { declarado, real });

// Ningún nombre de comisión / afiliado / referido.
const PROHIBIDO = /comisi|commission|afiliad|affiliat|referid|referral|referer|kickback/i;
const nombresDb = (await db.query(`
  select table_name as n from information_schema.tables where table_schema = 'public'
  union all select column_name from information_schema.columns where table_schema = 'public'
  union all select p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
  union all select conname from pg_constraint c join pg_namespace s on s.oid = c.connamespace where s.nspname = 'public'
  union all select tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and not t.tgisinternal
  union all select policyname from pg_policies where schemaname = 'public'
  union all select e.enumlabel from pg_enum e`)).rows.map((x) => x.n);
check("ninguna tabla, columna, función, constraint, trigger, policy ni enum se llama comisión/afiliado/referido",
  nombresDb.length > 50 && !nombresDb.some((n) => PROHIBIDO.test(n)), nombresDb.filter((n) => PROHIBIDO.test(n)));
const rutas = [];
const recorrer = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; rutas.push(p); if (e.isDirectory()) recorrer(p); } };
recorrer(new URL("../app", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
check("ninguna ruta ni archivo de app/ se llama comisión/afiliado/referido",
  rutas.length > 10 && !rutas.some((p) => PROHIBIDO.test(p.split("/app/")[1] ?? p)), rutas.filter((p) => PROHIBIDO.test(p)));
const kinds = (await db.query(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'payer_evidence_kind_list'`)).rows[0].d;
check("los tipos de evidencia permitidos por la base no incluyen comisión/afiliado/referido", !PROHIBIDO.test(kinds), kinds);

// De nuevo: anon sin EXECUTE en ninguna función y RLS en todas las tablas.
const ejecutables4 = [];
for (const fn of (await db.query(`select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).rows) {
  if ((await db.query(`select has_function_privilege('anon', $1::oid, 'execute') e`, [fn.oid])).rows[0].e) ejecutables4.push(fn.proname);
}
check("tras la Feature 4, anon sigue sin EXECUTE en ninguna función", ejecutables4.length === 0, ejecutables4);
r = await as("D", `select estado_viabilidad($1)`, [orgD]);
check("authenticated no ejecuta estado_viabilidad (interna)", negado(r), r);

// Volver a correr el schema con todo esto (triggers incluidos).
const fotoLibro = async () => (await db.query(`select (select count(*)::int from published_ledger) l, (select string_agg(org_id || ':' || version || ':' || viability || ':' || oficial, ',' order by org_id, version) from published_ledger) d, (select count(*)::int from payer_evidence) e, (select count(*)::int from pg_trigger where not tgisinternal) t`)).rows[0];
const antesL = await fotoLibro();
r = {};
try { await db.exec(schema); await db.exec(schema); } catch (e) { r = { error: e.message }; }
check("schema corre 2 veces más con libros publicados, sin errores", !r.error, r);
check("…sin tocar los snapshots, la evidencia ni los triggers", JSON.stringify(antesL) === JSON.stringify(await fotoLibro()), [antesL, await fotoLibro()]);

// ---------- Marca de datos simulados en cada snapshot nuevo ----------
// Org H oficial con una evidencia simulada (default) y otra marcada real a
// mano (superusuario: la app no ofrece cómo).
U.H = "88888888-0000-0000-0000-000000000008";
await db.query(`insert into auth.users values ($1, 'H@test.mx')`, [U.H]);
const orgH = (await as("H", `select * from create_org('Oficial con evidencia simulada')`)).rows[0].org_id;
await db.query(`update organizations set es_oficial = true where id = $1`, [orgH]);
r = await as("H", `insert into payer_evidence (org_id, kind, description, document_ref, recorded_on) values ($1,'carta_intencion','SIMULADO','SIM-1','2026-10-01') returning simulada`, [orgH]);
check("evidencia nueva nace simulada = true (default)", r.rows?.[0]?.simulada === true, r);
r = await as("H", `insert into payer_evidence (org_id, kind, description, document_ref, recorded_on, simulada) values ($1,'otro','x','x','2026-10-01', false)`, [orgH]);
check("ATAQUE: el cliente no puede marcar una evidencia como real (simulada = false)", negado(r), r);
r = await as("H", `update payer_evidence set simulada = false returning id`);
check("ATAQUE: el cliente no puede cambiar simulada después", negado(r) || r.rows?.length === 0, r);

const viabH = await estadoSql(orgH);
r = await pub("H", orgH, viabH);
check("snapshot con marca y conteos reales (1 registro, 1 simulada) → se publica", !r.error && r.rows?.[0]?.version === 1, r);
r = await pub("H", orgH, viabH, { datos_simulados: false });
check("ATAQUE: snapshot nuevo con datos_simulados = false → rechazado", /published_ledger_marca_simulados/.test(r.error), r);
const sinMarca = await contenidoValido(orgH, viabH);
delete sinMarca.datos_simulados;
r = await as("H", `insert into published_ledger (org_id, viability, content) values ($1, $2, $3::jsonb)`, [orgH, viabH, JSON.stringify(sinMarca)]);
check("ATAQUE: snapshot nuevo SIN la marca de datos simulados → rechazado", /published_ledger_marca_simulados/.test(r.error), r);
r = await pub("H", orgH, viabH, { evidencia_pagador: { registros: 1, simuladas: 0 } });
check("ATAQUE: decir que la evidencia simulada es real (simuladas 0) → rechazado", /no coincide con la evidencia/.test(r.error), r);
r = await pub("H", orgH, viabH, { evidencia_pagador: { registros: 0, simuladas: 0 } });
check("ATAQUE: esconder la evidencia en el snapshot (registros 0) → rechazado", /no coincide con la evidencia/.test(r.error), r);
r = await pub("H", orgH, viabH, { evidencia_pagador: { registros: 1 } });
check("ATAQUE: snapshot nuevo sin el conteo de simuladas → rechazado", /published_ledger_marca_simulados|no coincide/.test(r.error), r);
await db.query(`insert into payer_evidence (org_id, kind, description, document_ref, recorded_by, recorded_on, simulada) values ($1,'otro','Real (prueba)','R-1',$2,'2026-10-01', false)`, [orgH, U.H]);
r = await pub("H", orgH, await estadoSql(orgH));
check("con 1 simulada y 1 real → el snapshot dice registros 2, simuladas 1 y se publica", !r.error && r.rows?.[0]?.version === 2, r);
r = (await db.query(`select content -> 'evidencia_pagador' e from published_ledger where org_id = $1 and version = 2`, [orgH])).rows[0].e;
check("…y eso es lo que queda guardado", r.registros === 2 && r.simuladas === 1, r);

// v1 real se publicó con el formato 1 (sin la marca nueva). Simulación: una
// fila vieja insertada antes de la regla. Volver a correr el schema no debe
// fallar (NOT VALID) ni tocarla.
await db.exec(`alter table published_ledger disable trigger validar_publicacion; alter table published_ledger drop constraint published_ledger_marca_simulados;`);
await db.query(`insert into published_ledger (org_id, version, viability, content, oficial) values ($1, 99, 'EVIDENCE_RECORDED_NOT_SUPPORTED', '{"formato":1,"simulado":true,"viabilidad":"EVIDENCE_RECORDED_NOT_SUPPORTED","evidencia_pagador":{"registros":2,"tipos":["carta_intencion"]}}', true)`, [orgH]);
await db.exec(`alter table published_ledger enable trigger validar_publicacion;`);
r = {};
try { await db.exec(schema); } catch (e) { r = { error: e.message }; }
check("con un snapshot formato 1 ya publicado, el schema vuelve a correr sin error (constraint NOT VALID)", !r.error, r);
r = (await db.query(`select content ->> 'formato' f from published_ledger where org_id = $1 and version = 99`, [orgH])).rows;
check("…y el snapshot formato 1 sigue intacto", r[0]?.f === "1", r);
r = (await db.query(`select convalidated from pg_constraint where conname = 'published_ledger_marca_simulados'`)).rows;
check("…la constraint existe y aplica a lo nuevo (NOT VALID: no revalida lo viejo)", r.length === 1 && r[0].convalidated === false, r);
await db.exec(`alter table published_ledger disable trigger libro_inmutable;`);
await db.query(`delete from published_ledger where org_id = $1 and version = 99`, [orgH]);
await db.exec(`alter table published_ledger enable trigger libro_inmutable;`);

// ---------- La consulta de /financiamiento (lib/libro-publico.ts) ----------
// La misma consulta que usa la página, traducida a SQL y corrida como anon.
const libroPublico = async () => (await as("anon", sqlLibroPublico())).rows ?? [];
const deQuien = async (fila) => fila ? (await db.query(`select org_id from published_ledger where version = $1 and published_at = $2`, [fila.version, fila.published_at])).rows.map((x) => x.org_id) : [];
const oficialesAntes = (await db.query(`select id from organizations where es_oficial`)).rows.map((x) => x.id);

await db.query(`update organizations set es_oficial = false`);
r = await libroPublico();
check("consulta pública: sin ninguna org oficial → 0 filas ('Aún no hay libro publicado')", r.length === 0, r);

await db.query(`update organizations set es_oficial = true where id = $1`, [orgH]);
const ultimaH = (await db.query(`select max(version)::int v from published_ledger where org_id = $1`, [orgH])).rows[0].v;
r = await libroPublico();
check("consulta pública: devuelve la ÚLTIMA versión de la org oficial (no v1)", r.length === 1 && r[0].version === ultimaH && ultimaH >= 2, [r, ultimaH]);
check("…de la org oficial", (await deQuien(r[0])).includes(orgH));

// Otra org publica DESPUÉS (más reciente) y luego deja de ser oficial.
await db.query(`update organizations set es_oficial = true where id = $1`, [orgG]);
await new Promise((res) => setTimeout(res, 20));
const pG = await pubSuper(orgG, await estadoSql(orgG));
await db.query(`update organizations set es_oficial = false where id = $1`, [orgG]);
r = await libroPublico();
check("consulta pública: ignora un snapshot MÁS RECIENTE de una org no oficial",
  !pG.error && r.length === 1 && r[0].version === ultimaH && (await deQuien(r[0])).includes(orgH), [pG, r]);

// La org oficial publica otra versión → esa pasa a ser la pública.
await new Promise((res) => setTimeout(res, 20));
const nueva = await pub("H", orgH, await estadoSql(orgH));
r = await libroPublico();
check("consulta pública: al publicar una versión nueva, se ve solo esa", !nueva.error && r.length === 1 && r[0].version === nueva.rows[0].version, [nueva, r]);
r = await as("anon", `select count(*)::int n from published_ledger where org_id = $1`, [orgH]);
check("…y las anteriores siguen públicas por la API (historial)", r.rows?.[0]?.n >= 3, r);

await db.query(`update organizations set es_oficial = (id = any($1::uuid[]))`, [oficialesAntes]);

const ejecutables5 = [];
for (const fn of (await db.query(`select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).rows) {
  if ((await db.query(`select has_function_privilege('anon', $1::oid, 'execute') e`, [fn.oid])).rows[0].e) ejecutables5.push(fn.proname);
}
check("tras el ajuste, anon sigue sin EXECUTE en ninguna función", ejecutables5.length === 0, ejecutables5);

// ---------- Commit 7: límite de frecuencia del auditor de IA ----------
// Org nueva: I y J. K no tiene organización.
Object.assign(U, {
  I: "11111111-aaaa-0000-0000-000000000009",
  J: "22222222-aaaa-0000-0000-000000000010",
  K: "33333333-aaaa-0000-0000-000000000011",
});
for (const k of ["I", "J", "K"]) await db.query(`insert into auth.users values ($1, $2)`, [U[k], `${k}@test.mx`]);
const oi = await as("I", `select * from create_org('Org del límite')`);
const orgI = oi.rows[0].org_id;
await as("J", `select * from join_org($1)`, [oi.rows[0].join_code]);
const llamar = (who) => as(who, `select registrar_llamada_auditor() ok`);

const resultadosI = [];
for (let i = 0; i < 11; i++) resultadosI.push((await llamar("I")).rows?.[0]?.ok);
check("auditor: 10 llamadas por hora permitidas, la 11a no", resultadosI.slice(0, 10).every((x) => x === true) && resultadosI[10] === false, resultadosI);
r = await llamar("J");
check("auditor: el límite por hora es por persona (J sí puede)", r.rows?.[0]?.ok === true, r);
r = await llamar("K");
check("auditor: sin organización → rechazado", /Se requiere sesión y organización/.test(r.error), r);
r = await as("anon", `select registrar_llamada_auditor()`);
check("auditor: anon no ejecuta registrar_llamada_auditor", negado(r), r);

// ATAQUES contra el contador.
r = await as("I", `delete from auditor_llamadas returning id`);
check("ATAQUE: borrar mis registros para reiniciar el límite → rechazado", negado(r) || r.rows?.length === 0, r);
r = await as("I", `update auditor_llamadas set created_at = now() - interval '2 days' returning id`);
check("ATAQUE: envejecer mis registros para reiniciar el límite → rechazado", negado(r) || r.rows?.length === 0, r);
r = await as("I", `select count(*) from auditor_llamadas`);
check("ATAQUE: leer el registro de llamadas → rechazado", negado(r) || r.rows?.[0]?.count === 0, r);
r = await as("I", `insert into auditor_llamadas (user_id, org_id) values ($1, $2)`, [U.J, orgI]);
check("ATAQUE: insertar llamadas a nombre de otro → rechazado", negado(r), r);

// Límite por organización: 30 por día (11 reales + 19 simuladas = 30; la 31 se rechaza).
await db.query(`insert into auditor_llamadas (user_id, org_id, created_at) select $1, $2, now() - interval '2 hours' from generate_series(1, 19)`, [U.J, orgI]);
const enOrg = (await db.query(`select count(*)::int n from auditor_llamadas where org_id = $1`, [orgI])).rows[0].n;
r = await llamar("J");
check(`auditor: con ${enOrg} llamadas de la org en el día → la siguiente se rechaza (30 por día)`, enOrg >= 30 && r.rows?.[0]?.ok === false, [enOrg, r]);

// Minimización: los registros de más de un día se borran solos.
await db.query(`insert into auditor_llamadas (user_id, org_id, created_at) values ($1, $2, now() - interval '3 days')`, [U.A, orgA]);
await llamar("A");
r = (await db.query(`select count(*)::int n from auditor_llamadas where created_at < now() - interval '1 day'`)).rows[0].n;
check("auditor: los registros de más de un día se borran (minimización)", r === 0, r);

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
