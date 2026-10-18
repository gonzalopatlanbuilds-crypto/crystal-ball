#!/usr/bin/env bash
# Prueba desde FUERA de la app que la llave pública (anon) no puede ejecutar
# ningún RPC ni leer ninguna tabla salvo published_ledger (lección de w08:
# revocar de `public` no bastaba). Lee la URL y la llave de .env.local
# solo con grep de esas dos variables; no imprime la llave.
#
# Uso: bash scripts/probar-anon.sh
# Esperado: cada RPC => 401/403/404 con "permission denied"; cada tabla
# privada => [] o "permission denied"; published_ledger => 200. Cualquier
# 200 en un RPC es un BUG.
set -u
# No `source`: con "VAR= valor" (espacio tras el =, que Next.js tolera)
# bash deja VAR vacía. Se lee y se recorta a mano.
leer() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '\r' | sed -E 's/^[[:space:]"]+|[[:space:]"]+$//g'; }
U="$(leer NEXT_PUBLIC_SUPABASE_URL)"; K="$(leer NEXT_PUBLIC_SUPABASE_ANON_KEY)"
[ -z "$U" ] || [ -z "$K" ] && { echo "Faltan variables en .env.local"; exit 1; }
case "$U" in *rest/v1*|*" "*) echo "NEXT_PUBLIC_SUPABASE_URL debe ser la URL base, sin /rest/v1/ ni espacios"; exit 1;; esac
T="$(mktemp)"
Z=00000000-0000-0000-0000-000000000000

rpc() {
  printf '%-28s ' "$1"
  curl -s -o "$T" -w '%{http_code} ' -X POST "$U/rest/v1/rpc/$1" \
    -H "apikey: $K" -H "Authorization: Bearer $K" -H 'Content-Type: application/json' -d "$2"
  head -c 140 "$T"; echo
}
tabla() {
  printf '%-28s ' "tabla $1"
  curl -s -w ' %{http_code}' "$U/rest/v1/$1?select=*&limit=1" -H "apikey: $K" -H "Authorization: Bearer $K" | head -c 160; echo
}

rpc create_org '{"p_name":"anon test"}'
rpc join_org '{"p_join_code":"ABC-234"}'
rpc my_org_id '{}'
rpc generar_join_code '{}'
rpc sembrar_supuestos "{\"p_org_id\":\"$Z\"}"
rpc sembrar_supuestos_ejemplo '{}'
rpc tocar_updated_at '{}'
rpc estado_viabilidad "{\"p_org_id\":\"$Z\"}"
rpc validar_publicacion '{}'
rpc libro_inmutable '{}'
rpc sincronizar_oficial '{}'
for t in organizations profiles assumptions payer_evidence published_ledger; do tabla $t; done
# Feature 4: anon solo ve snapshots de orgs oficiales. Esperado: [] (cero
# filas no oficiales visibles). Y no puede publicar: esperado 401.
printf '%-28s ' "ledger no oficial visible"
curl -s "$U/rest/v1/published_ledger?select=version&oficial=eq.false" -H "apikey: $K" -H "Authorization: Bearer $K" | head -c 160; echo
printf '%-28s ' "anon publica"
curl -s -o "$T" -w '%{http_code} ' -X POST "$U/rest/v1/published_ledger" -H "apikey: $K" -H "Authorization: Bearer $K"   -H 'Content-Type: application/json' -d "{\"org_id\":\"$Z\",\"viability\":\"SUPPORTED\",\"content\":{\"viabilidad\":\"SUPPORTED\"}}"
head -c 140 "$T"; echo
rm -f "$T"
