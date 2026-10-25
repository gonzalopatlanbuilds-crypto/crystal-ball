#!/usr/bin/env bash
# Prueba desde FUERA de la app que la llave pública (anon) no puede ejecutar
# ningún RPC ni leer ninguna tabla (lección de w08: revocar de `public` no
# bastaba). Lee la URL y la llave de .env.local
# solo con grep de esas dos variables; no imprime la llave.
#
# Uso: bash scripts/probar-anon.sh
# Esperado: cada RPC => 401/403/404 con "permission denied"; cada tabla
# => [] o "permission denied"; cada escritura => 401/403. Cualquier 200 en
# un RPC, o una fila en una tabla, es un BUG.
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
rpc registrar_version '{"p_source_filename":"x.csv","p_raw_rows":[],"p_invalid_rows":[],"p_is_example":false,"p_findings":[],"p_base_seq":null}'
rpc hallazgo_protegido '{}'
rpc validar_filas_evidencia '{"p_rows":[],"p_invalid":[]}'
rpc huella_evidencia '{"p_rows":[]}'
rpc evidencia_inmutable '{}'
rpc evidencia_validar_insert '{}'
for t in organizations profiles evidence_versions findings decisions; do tabla $t; done
escribir() {
  printf '%-28s ' "anon escribe $1"
  curl -s -o "$T" -w '%{http_code} ' -X POST "$U/rest/v1/$1" -H "apikey: $K" -H "Authorization: Bearer $K"     -H 'Content-Type: application/json' -d "$2"
  head -c 140 "$T"; echo
}
escribir evidence_versions "{\"org_id\":\"$Z\",\"uploaded_by\":\"$Z\",\"source_filename\":\"x.csv\",\"raw_rows\":[],\"content_sha256\":\"$(printf 'a%.0s' $(seq 64))\"}"
escribir decisions "{\"org_id\":\"$Z\",\"finding_id\":\"$Z\",\"decided_by\":\"$Z\",\"decision\":\"confirmed\",\"note\":\"x\"}"
# Feature 2: anon no edita ni borra versiones. Esperado: 401 o [] (0 filas).
printf '%-28s ' "anon edita versiones"
curl -s -o "$T" -w '%{http_code} ' -X PATCH "$U/rest/v1/evidence_versions?id=neq.$Z" -H "apikey: $K" -H "Authorization: Bearer $K"   -H 'Content-Type: application/json' -H 'Prefer: return=representation' -d '{"source_filename":"editado.csv"}'
head -c 140 "$T"; echo
printf '%-28s ' "anon borra versiones"
curl -s -o "$T" -w '%{http_code} ' -X DELETE "$U/rest/v1/evidence_versions?id=neq.$Z" -H "apikey: $K" -H "Authorization: Bearer $K" -H 'Prefer: return=representation'
head -c 140 "$T"; echo
# Feature 3: anon no cambia el estado de un hallazgo. Esperado: 401.
printf '%-28s ' "anon cambia estado"
curl -s -o "$T" -w '%{http_code} ' -X PATCH "$U/rest/v1/findings?id=neq.$Z" -H "apikey: $K" -H "Authorization: Bearer $K"   -H 'Content-Type: application/json' -d '{"status":"confirmed"}'
head -c 140 "$T"; echo
rm -f "$T"
