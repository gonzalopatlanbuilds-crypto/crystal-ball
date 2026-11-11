// Verificación de un deploy desde FUERA, sin sesión ni cookies (como el
// profesor en una ventana de incógnito).
// Uso: npm run verificar:deploy -- https://www.packvalidator.online
// Sale con código 1 si algún chequeo falla.

const base = (process.argv[2] ?? "").replace(/\/$/, "");
let ok = 0, fail = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { ok++; console.log(`OK     ${nombre}`); }
  else { fail++; console.log(`FALLA  ${nombre} ${detalle}`); }
}

if (!/^https:\/\/[^\s/]+$/.test(base)) {
  console.log("Uso: npm run verificar:deploy -- https://<dominio>");
  process.exit(1);
}

const pedir = (ruta) => fetch(base + ruta, { redirect: "manual", headers: { "user-agent": "verificar-deploy" } });
const texto = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
// Nada que parezca una llave secreta en lo que ve alguien sin sesión.
const FUGA = /sk-ant-|service_role|SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY/;

const home = await pedir("/");
const htmlHome = await home.text();
check("/ (home pública) responde 200 sin sesión", home.status === 200, `(${home.status})`);
check("/ muestra la cláusula de sombra", /Validator no certifica cumplimiento ni reciclaje/.test(texto(htmlHome)));
check("/ no filtra llaves secretas", !FUGA.test(htmlHome));

const login = await pedir("/login");
const htmlLogin = await login.text();
check("/login responde 200 sin sesión", login.status === 200, `(${login.status})`);
check("/login no redirige al muro de Vercel (Deployment Protection apagado)", !/vercel\.com\/(sso-api|login)/.test(login.headers.get("location") ?? ""), login.headers.get("location") ?? "");
check("/login muestra el aviso de datos simulados y la cláusula de sombra", /Datos simulados/.test(texto(htmlLogin)) && /Validator no certifica cumplimiento ni reciclaje/.test(texto(htmlLogin)));
check("/login no filtra llaves secretas", !FUGA.test(htmlLogin));

const pricing = await pedir("/pricing");
const htmlPricing = await pricing.text();
const tPricing = texto(htmlPricing);
check("/pricing (pública) responde 200 sin sesión", pricing.status === 200, `(${pricing.status})`);
check("/pricing muestra Starter, Pro y Enterprise", /Starter/.test(tPricing) && /\bPro\b/.test(tPricing) && /Enterprise/.test(tPricing));
check("/pricing muestra los 3 estados: no probado, evidencia directa + referida, hipótesis", /Segmento no probado/.test(tPricing) && /Evidencia directa \+ referida/.test(tPricing) && /Hipótesis, sin evidencia/.test(tPricing));
check("/pricing muestra el precio fundador junto al de lista", /\$3,500\/mes × 12 meses/.test(tPricing) && /\$4,500/.test(tPricing));
check("/pricing no dice «pagada» (no hay pagos reales)", !/[Pp]agada/.test(tPricing));
check("/pricing muestra la cláusula de sombra", /Validator no certifica cumplimiento ni reciclaje/.test(tPricing));
check("/pricing no filtra llaves secretas", !FUGA.test(htmlPricing));

for (const ruta of ["/validador", "/onboarding"]) {
  const res = await pedir(ruta);
  const destino = res.headers.get("location") ?? "";
  check(`${ruta} sin sesión redirige a /login`, res.status >= 300 && res.status < 400 && /\/login$/.test(destino), `(${res.status} → ${destino})`);
}

const noExiste = await pedir("/esta-ruta-no-existe");
check("una ruta inexistente no da error 500", noExiste.status < 500, `(${noExiste.status})`);

console.log(`\n${ok} OK, ${fail} FALLA — ${base}`);
if (fail > 0) process.exit(1);
