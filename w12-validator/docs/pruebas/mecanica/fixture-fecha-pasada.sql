-- Fixture para la prueba 3 del PACKET (revisión posterior a la evidencia
-- aceptada), igual que en w11. Datos simulados.
--
-- late_revision compara packaging_revision_date con el uploaded_at de la
-- última evidencia aceptada, y ese uploaded_at lo pone la base al subir.
-- Una fecha de revisión no puede estar en el futuro, así que el mismo día
-- no se puede provocar desde la app: esta versión base se inserta desde el
-- SQL Editor con uploaded_at del 2026-10-20. Pasa por el mismo trigger de
-- validación (filas, huella, marca de idéntica). Solo se usa en la org de
-- prueba "Validator Simulado W12" (código 9A2-DPD).
--
-- Correr UNA vez en Supabase → SQL Editor. Debe devolver una fila.
insert into public.evidence_versions (org_id, uploaded_by, uploaded_at, source_filename, raw_rows, invalid_rows, content_sha256)
select o.id, p.id, '2026-10-20 10:00:00 America/Mexico_City'::timestamptz, 'fixture-fecha-pasada.csv',
  '[{"fila": 2, "sku": "SIM-LATE-01", "supplier": "Proveedor Simulado Delta", "weight_g": 15, "material": "PET", "packaging_revision_date": "2026-10-15", "evidence_folio": "FOL-SIM-LATE-1"}]'::jsonb,
  '[]'::jsonb, repeat('0', 64)
from public.organizations o
join public.profiles p on p.org_id = o.id
where o.join_code = '9A2-DPD' and p.email = 'gonzalo.patlan5@gmail.com'
returning seq, uploaded_at, source_filename, identical_to_previous, content_sha256 <> repeat('0', 64) as huella_calculada;
