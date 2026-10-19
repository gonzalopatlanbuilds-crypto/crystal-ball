// Verificación de un deploy desde FUERA, sin sesión ni cookies (como el
// profesor o un estudiante en una ventana de incógnito).
// Uso: npm run verificar:deploy -- https://crystal-ball-w10-libro-abierto.vercel.app
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
// Nada que parezca una llave o una variable secreta en las páginas públicas.
const FUGA = /sk-ant-|service_role|SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY/;

const login = await pedir("/login");
const htmlLogin = await login.text();
check("/login responde 200 sin sesión", login.status === 200, `(${login.status})`);
check("/login no redirige al muro de Vercel (Deployment Protection apagado)", !/vercel\.com\/(sso-api|login)/.test(login.headers.get("location") ?? ""), login.headers.get("location") ?? "");
check("/login muestra el aviso de datos simulados", /Datos simulados/.test(texto(htmlLogin)));
check("/login no filtra llaves", !FUGA.test(htmlLogin));

const fin = await pedir("/financiamiento");
const htmlFin = await fin.text();
const tFin = texto(htmlFin);
check("/financiamiento responde 200 sin sesión", fin.status === 200, `(${fin.status})`);
check("/financiamiento no fija cookies", !fin.headers.get("set-cookie"), fin.headers.get("set-cookie") ?? "");
check("/financiamiento muestra el aviso de datos simulados", /Datos simulados/.test(tFin));
check("/financiamiento muestra un libro publicado (versión y viabilidad)", /Versión publicada: v\d+ - simulada/.test(tFin) && /¿Alguien paga por esto\? /.test(tFin));
check("/financiamiento muestra 'Lo que ningún patrocinador puede cambiar' y 'Qué datos guardamos'", /Lo que ningún patrocinador puede cambiar/.test(tFin) && /Qué datos guardamos/.test(tFin));
check("/financiamiento explica qué significa el estado y presenta el libro", /Esto no dice si los resultados del verificador son correctos/.test(tFin) && /Este libro explica cómo se financia el verificador de compatibilidad de laptops/.test(tFin));
check("/financiamiento no filtra llaves ni correos", !FUGA.test(htmlFin) && !/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(tFin));

const modelo = await pedir("/modelo");
const destino = modelo.headers.get("location") ?? "";
check("/modelo sin sesión redirige a /login", modelo.status >= 300 && modelo.status < 400 && /\/login$/.test(destino), `(${modelo.status} → ${destino})`);

const noExiste = await pedir("/esta-ruta-no-existe");
check("una ruta inexistente no da error 500", noExiste.status < 500, `(${noExiste.status})`);

console.log(`\n${ok} OK, ${fail} FALLA — ${base}`);
if (fail > 0) process.exit(1);
