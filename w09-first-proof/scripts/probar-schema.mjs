import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Prueba mecánica de sql/schema.sql en Postgres real (PGlite, WASM), sin
// Supabase: stub de roles anon/authenticated, auth.uid()/auth.jwt() y los
// default privileges que Supabase da a funciones nuevas (la causa del bug
// de anon en w08). No sustituye la prueba con la llave pública contra
// producción (scripts/probar-anon.sh).
//
// Uso: npm run test:schema
const db = new PGlite();
const schema = fs.readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8");

// Stub mínimo de lo que Supabase ya trae: roles, schema auth, default privileges.
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
await db.exec(schema);
await db.exec(schema); // idempotente

const U = { A: "aaaaaaaa-0000-0000-0000-000000000001", B: "bbbbbbbb-0000-0000-0000-000000000002", C: "cccccccc-0000-0000-0000-000000000003" };
for (const [k, id] of Object.entries(U)) await db.query(`insert into auth.users values ($1, $2)`, [id, `${k}@test.mx`]);

let ok = 0, fail = 0;
async function as(who, sql, params = []) {
  await db.exec(`reset role`);
  if (who === "anon") {
    await db.exec(`select set_config('request.jwt.claim.sub','',false); set role anon;`);
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

const expl = "La empresa creció sus ingresos y mantuvo el margen, pero la cobranza se volvió más lenta y eso merece revisión primero.";
const ins = (who, org) => as(who, `insert into submissions (org_id, candidate_id, answer_growth, answer_margin, answer_dso, explanation) values ($1,$2,10,30,30,$3) returning id, pseudonym, status, attempt_number`, [org, U[who], expl]);

const a = await as("A", `select * from create_org('Piloto Uno')`);
const orgA = a.rows[0].org_id, code = a.rows[0].join_code;
check("A crea org", !!orgA && /^[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(code), a);
check("B se une con código", !(await as("B", `select * from join_org($1)`, [code.toLowerCase()])).error);
await as("C", `select * from create_org('Piloto Dos')`);
check("A no puede crear otra org", !!(await as("A", `select * from create_org('x')`)).error);

const sA = await ins("A", orgA);
check("A entrega → A-01, pending_review, intento 1", sA.rows?.[0]?.pseudonym === "A-01" && sA.rows[0].status === "pending_review" && sA.rows[0].attempt_number === 1, sA);
const sB = await ins("B", orgA);
check("B entrega → A-02, intento 1 (el contador es por candidato)", sB.rows?.[0]?.pseudonym === "A-02" && sB.rows[0].attempt_number === 1, sB);
const idA = sA.rows[0].id, idB = sB.rows[0].id;

let r = await as("A", `insert into submissions (org_id, candidate_id, explanation, pseudonym) values ($1,$2,$3,'A-99')`, [orgA, U.A, expl]);
check("cliente no puede elegir seudónimo", /permission denied/.test(r.error), r);
r = await as("A", `insert into submissions (org_id, candidate_id, explanation, attempt_number) values ($1,$2,$3,99)`, [orgA, U.A, expl]);
check("cliente no puede elegir attempt_number", /permission denied/.test(r.error), r);
r = await as("A", `update submissions set attempt_number=7 where id=$1`, [idA]);
check("cliente no puede editar attempt_number", /permission denied/.test(r.error), r);
r = await as("A", `update profiles set next_attempt=50 where id=$1`, [U.A]);
check("cliente no puede mover su contador de intentos", /permission denied/.test(r.error) || r.rows?.length === 0, r);
r = await as("A", `insert into submissions (org_id, candidate_id, explanation, ai_observations) values ($1,$2,$3,'[]')`, [orgA, U.A, expl]);
check("cliente no puede insertar ai_observations", /permission denied/.test(r.error), r);
r = await as("A", `update submissions set ai_observations='[{"id":"o1","texto":"falsa"}]' where id=$1`, [idA]);
check("cliente no puede editar ai_observations", /permission denied/.test(r.error), r);
r = await as("A", `update submissions set status='reviewed' where id=$1`, [idA]);
check("cliente no puede cambiar status", /permission denied/.test(r.error), r);
r = await as("A", `insert into submissions (org_id, candidate_id, explanation) values ($1,$2,$3)`, [orgA, U.B, expl]);
check("A no puede entregar a nombre de B", /row-level security/.test(r.error), r);
r = await as("C", `insert into submissions (org_id, candidate_id, explanation) values ($1,$2,$3)`, [orgA, U.C, expl]);
// Lo rechaza primero el trigger (el perfil de C no es de esa org) y, si no,
// RLS; cualquiera de los dos sirve. El rollback deshace los contadores.
check("C no puede entregar en org ajena", /row-level security|no pertenece a esta organización/.test(r.error), r);
r = await as("A", `insert into submissions (org_id, candidate_id, explanation) values ($1,$2,'muy corta')`, [orgA, U.A]);
check("explicación < 80 rechazada por la base", /check constraint/.test(r.error), r);
r = await as("A", `insert into submissions (org_id, candidate_id, explanation, answer_growth) values ($1,$2,$3,'NaN')`, [orgA, U.A, expl]);
check("NaN rechazado por la base", !!r.error, r);

r = await as("A", `select id, pseudonym from submissions`);
check("A ve solo su entrega", r.rows.length === 1 && r.rows[0].id === idA, r);

r = await as("A", `select * from blind_pending_submissions()`);
check("A ve pendientes ajenas, no la suya", r.rows.length === 1 && r.rows[0].id === idB && Object.keys(r.rows[0]).join() === "id,pseudonym", r);
r = await as("A", `select * from blind_submission($1)`, [idB]);
check("blind_submission sin campos de identidad", r.rows.length === 1 && !Object.keys(r.rows[0]).some((k) => /candidate|email|name|created/.test(k)), r);
r = await as("A", `select * from blind_submission($1)`, [idA]);
check("blind_submission no devuelve la propia", r.rows.length === 0, r);

// Sin observaciones de IA, las decisiones van vacías ({}).
const rev = (who, id) => as(who, `select submit_review($1, '{}', 'Ninguno', 'conversar', 'Explica bien el cambio en cobranza.') as id`, [id]);
r = await rev("A", idA);
check("TRIGGER: A no puede revisar su propia entrega", /No puedes revisar tu propia entrega/.test(r.error), r);
r = await as("A", `insert into reviews (submission_id, org_id, reviewer_id, conflict_declaration, recommendation, note) values ($1,$2,$3,'Ninguno','conversar','x')`, [idB, orgA, U.A]);
check("insert directo en reviews prohibido", /permission denied/.test(r.error), r);
r = await as("A", `select submit_review($1, '{}', 'Ninguno', 'rechazar', 'x')`, [idB]);
check("no existe recomendación 'rechazar'", /check constraint/.test(r.error), r);
r = await rev("C", idB);
check("C (otra org) no puede revisar", !!r.error, r);
r = await rev("A", idB);
check("A revisa la de B", !r.error && r.rows[0].id, r);
r = await rev("A", idB);
check("no se puede revisar dos veces", !!r.error, r);

// Trigger directo (como superusuario, saltándose el RPC).
try {
  await db.query(`insert into reviews (submission_id, org_id, reviewer_id, conflict_declaration, recommendation, note) values ($1,$2,$3,'Ninguno','conversar','x')`, [idA, orgA, U.A]);
  r = {};
} catch (e) { r = { error: e.message }; }
check("TRIGGER bloquea revisor=candidato aunque se salte el RPC", /No puedes revisar tu propia entrega/.test(r.error), r);

r = await as("B", `select status from submissions where id=$1`, [idB]);
check("entrega de B queda reviewed", r.rows[0]?.status === "reviewed", r);
r = await as("B", `select reviewer_id, recommendation from reviews`);
check("B ve la revisión de su entrega", r.rows.length === 1 && r.rows[0].reviewer_id === U.A, r);
r = await as("B", `select display_name from profiles where id=$1`, [U.A]);
check("B puede ver el nombre del revisor (misma org)", r.rows[0]?.display_name === "Persona A", r);
r = await as("A", `select * from blind_submission($1)`, [idB]);
check("A puede releer la que revisó (ciega)", r.rows.length === 1, r);
r = await as("A", `select * from blind_pending_submissions()`);
check("revisada sale de pendientes", r.rows.length === 0, r);

for (const t of ["orgs", "profiles", "submissions", "reviews"]) {
  r = await as("C", `select * from ${t}`);
  const fuga = (r.rows ?? []).some((x) => x.org_id === orgA || x.id === orgA);
  check(`C (otra org) no ve ${t} de A`, !r.error && !fuga, r);
}
r = await as("C", `select * from blind_submission($1)`, [idB]);
check("C no lee blind_submission de otra org", r.rows.length === 0, r);

r = await as("A", `delete from submissions where id=$1 returning id`, [idB]);
check("A no puede borrar la entrega de B", r.rows?.length === 0, r);
r = await as("B", `delete from submissions where id=$1 returning id`, [idB]);
check("B borra su entrega", r.rows?.length === 1, r);
const quedan = (await db.query(`select count(*)::int n from reviews where submission_id=$1`, [idB])).rows[0].n;
check("borrar la entrega borra su revisión", quedan === 0, quedan);
r = await ins("B", orgA);
check("seudónimo no se recicla tras borrar (A-03)", r.rows?.[0]?.pseudonym === "A-03", r);
check("intento no se recicla tras borrar (B: intento 2)", r.rows?.[0]?.attempt_number === 2, r);
r = await ins("A", orgA);
check("segunda entrega de A → intento 2", r.rows?.[0]?.attempt_number === 2, r);
r = await as("A", `select attempt_number from submissions order by attempt_number`);
check("A ve sus intentos 1 y 2", r.rows?.map((x) => x.attempt_number).join() === "1,2", r);
r = await as("A", `select * from blind_pending_submissions()`);
check("la lista ciega no expone attempt_number", r.rows.every((x) => !("attempt_number" in x)), r);

const fns = [["create_org", "'x'"], ["join_org", "'ABC-234'"], ["my_org_id", ""], ["generar_join_code", ""],
  ["blind_pending_submissions", ""], ["blind_submission", `'${idA}'`], ["submit_review", `'${idA}','{}','x','conversar','x'`], ["borrar_mis_entregas", ""]];
// ---------- Feature 4 ----------
// Org nueva para no mezclar con lo anterior: D candidata, E revisora.
U.D = "dddddddd-0000-0000-0000-000000000004"; U.E = "eeeeeeee-0000-0000-0000-000000000005";
for (const k of ["D", "E"]) await db.query(`insert into auth.users values ($1, $2)`, [U[k], `${k}@test.mx`]);
const o2 = await as("D", `select * from create_org('Piloto F4')`);
const orgD = o2.rows[0].org_id;
await as("E", `select * from join_org($1)`, [o2.rows[0].join_code]);
const d1 = (await ins("D", orgD)).rows[0];
const d2 = (await ins("D", orgD)).rows[0];
check("D: intentos 1 y 2", d1.attempt_number === 1 && d2.attempt_number === 2, [d1, d2]);
// Observaciones como las escribe el servidor (service role = superusuario aquí).
await db.query(`update submissions set ai_observations = '[{"id":"o1","texto":"Menciona el margen."},{"id":"o2","texto":"No cuantifica la cobranza."}]' where id = $1`, [d1.id]);

r = await as("E", `select id from blind_pending_submissions()`);
check("cola de revisión: solo el intento 1 (el reenvío no entra)", r.rows.length === 1 && r.rows[0].id === d1.id, r);
r = await as("E", `select * from blind_submission($1)`, [d2.id]);
check("blind_submission no abre un reenvío pendiente", r.rows.length === 0, r);
r = await as("E", `select submit_review($1, '{}', 'Ninguno', 'conversar', 'x')`, [d2.id]);
check("submit_review rechaza un reenvío", /no existe o ya fue revisada/.test(r.error), r);

const revD = (dec) => as("E", `select submit_review($1, $2::jsonb, 'Ninguno', 'mas_evidencia', 'Falta cuantificar.') as id`, [d1.id, JSON.stringify(dec)]);
r = await revD({ o1: { decision: "confirmada" } });
check("falta decidir una observación → rechazo", /Falta decidir/.test(r.error), r);
r = await revD({ o1: { decision: "confirmada" }, o2: { decision: "confirmada" }, o9: { decision: "confirmada" } });
check("decisión sobre observación inexistente → rechazo", /Falta decidir|sobra/.test(r.error), r);
r = await revD({ o1: { decision: "confirmada" }, o2: { decision: "aprobada" } });
check("decisión que no es confirmada/descartada → rechazo", /Decisión inválida/.test(r.error), r);
r = await revD({ o1: { decision: "confirmada", motivo: "x" }, o2: { decision: "descartada" } });
check("motivo en una confirmada → rechazo", /Decisión inválida/.test(r.error), r);
r = await revD({ o1: { decision: "confirmada" }, o2: { decision: "descartada", motivo: "x".repeat(121) } });
check("motivo de más de 120 → rechazo", /Decisión inválida/.test(r.error), r);
r = await revD({ o1: { decision: "confirmada" }, o2: { decision: "descartada", motivo: "No aparece en el texto." } });
check("revisión válida con una confirmada y una descartada", !r.error && r.rows[0].id, r);
r = await as("D", `select observation_decisions->'o2'->>'motivo' m, recommendation from reviews`);
check("D ve la decisión y el motivo en su revisión", r.rows[0]?.m === "No aparece en el texto." && r.rows[0].recommendation === "mas_evidencia", r);

r = await as("E", `select borrar_mis_entregas() n`);
check("borrar_mis_entregas de E no toca lo de D", r.rows[0].n === 0, r);
r = await as("D", `select count(*)::int n from submissions`);
check("D sigue con sus 2 entregas", r.rows[0].n === 2, r);
r = await as("D", `select borrar_mis_entregas() n`);
check("D borra todo: 2 entregas", r.rows[0].n === 2, r);
const quedanD = (await db.query(`select (select count(*)::int from submissions where candidate_id=$1) s, (select count(*)::int from reviews where submission_id=$2) r`, [U.D, d1.id])).rows[0];
check("borrar todo elimina entregas y revisión", quedanD.s === 0 && quedanD.r === 0, quedanD);
r = await as("E", `select * from blind_submission($1)`, [d1.id]);
check("la revisora ya no puede abrir el expediente borrado", r.rows.length === 0, r);
const d3 = (await ins("D", orgD)).rows[0];
check("tras borrar todo, la siguiente entrega vuelve a ser intento 1 (seudónimo nuevo)", d3.attempt_number === 1 && d3.pseudonym === "A-03", d3);

for (const [fn, args] of fns) {
  r = await as("anon", `select * from ${fn}(${args})`);
  check(`anon no ejecuta ${fn}`, /permission denied/.test(r.error), r);
}
for (const t of ["orgs", "profiles", "submissions", "reviews"]) {
  r = await as("anon", `select * from ${t}`);
  check(`anon no lee ${t}`, (r.rows && r.rows.length === 0) || /permission denied/.test(r.error), r);
}
console.log(`\n${ok} pass, ${fail} fail`);
