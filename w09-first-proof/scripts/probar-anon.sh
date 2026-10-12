#!/usr/bin/env bash
# Prueba desde FUERA de la app que la llave pública (anon) no puede ejecutar
# ningún RPC ni leer ninguna tabla (lección de w08: revocar de `public` no
# bastaba). Lee la URL y la llave de .env.local; no imprime la llave.
#
# Uso: bash scripts/probar-anon.sh
# Esperado: cada RPC => 401/403/404 con "permission denied"; cada tabla => [] o
# "permission denied". Cualquier 200 en un RPC es un BUG.
set -u
# No `source`: con "VAR= valor" (espacio tras el =, que Next.js tolera)
# bash deja VAR vacía. Se lee y se recorta a mano.
leer() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '' | sed -E 's/^[[:space:]"]+|[[:space:]"]+$//g'; }
U="$(leer NEXT_PUBLIC_SUPABASE_URL)"; K="$(leer NEXT_PUBLIC_SUPABASE_ANON_KEY)"
[ -z "$U" ] || [ -z "$K" ] && { echo "Faltan variables en .env.local"; exit 1; }
Z=00000000-0000-0000-0000-000000000000

rpc() {
  printf '%-28s ' "$1"
  curl -s -o /tmp/anon.$$ -w '%{http_code} ' -X POST "$U/rest/v1/rpc/$1" \
    -H "apikey: $K" -H "Authorization: Bearer $K" -H 'Content-Type: application/json' -d "$2"
  head -c 140 /tmp/anon.$$; echo
}
tabla() {
  printf '%-28s ' "tabla $1"
  curl -s -w ' %{http_code}' "$U/rest/v1/$1?select=*&limit=1" -H "apikey: $K" -H "Authorization: Bearer $K" | head -c 160; echo
}

rpc create_org '{"p_name":"anon test"}'
rpc join_org '{"p_join_code":"ABC-234"}'
rpc my_org_id '{}'
rpc generar_join_code '{}'
rpc asignar_seudonimo '{}'
rpc validar_revision '{}'
rpc blind_pending_submissions '{}'
rpc blind_submission "{\"p_id\":\"$Z\"}"
rpc submit_review "{\"p_submission_id\":\"$Z\",\"p_observation_decisions\":{},\"p_conflict_declaration\":\"x\",\"p_recommendation\":\"conversar\",\"p_note\":\"x\"}"
rpc borrar_mis_entregas "{}"
for t in orgs profiles submissions reviews; do tabla $t; done
rm -f /tmp/anon.$$
