-- Validator — siembra de pricing_evidence (semana 14)
--
-- ESTOS DATOS SON REALES: investigación de usuario real de las semanas
-- 13 y 14 (actual Week 13-14 user research, not simulated). No son datos
-- simulados como los proveedores, SKUs y archivos de la app.
-- Las tres cifras vienen del usuario #3 (PyME mediana, ~45 empleados, 4+
-- proveedores de empaque): dos de una conversación de la semana 13 y una
-- de una conversación de seguimiento de la semana 14, de parte de quien
-- decide en su empresa. No hay ningún pago real: no se siembra ninguna
-- fila "paid".
-- Fechas: solo se conoce la semana del curso, no el día. La semana va en
-- source; created_at es la fecha en que se registró (2026-11-11), no la
-- fecha de la conversación.
--
-- Corre esto en el SQL Editor DESPUÉS de sql/schema.sql. Es idempotente:
-- si una fila igual (monto + estado + fuente) ya existe, no la repite.
-- pricing_evidence es append-only: si una fila quedó mal, no se edita; se
-- agrega una fila nueva que la corrige (y se anota en DECISIONS.md).

insert into public.pricing_evidence (org_id, amount_mxn, state, source, note)
select null, s.amount_mxn, s.state, s.source, s.note
from (values
  -- Semana 13, primera conversación de pricing: respuesta directa, sin ancla.
  (1, 3500.00, 'direct',
   'Usuario #3, Week 13 user session (primera conversación de pricing)',
   'Respuesta directa, sin ancla: la dijo sin que yo propusiera cifra.'),
  -- Misma conversación de la semana 13, segunda respuesta: su techo declarado.
  (2, 4000.00, 'direct',
   'Usuario #3, Week 13 user session (misma conversación, segunda respuesta)',
   'Su techo declarado.'),
  -- Semana 14, otra conversación: referida. No la dijo quien decide; la
  -- reportó el usuario #3 de parte de quien decide en su empresa.
  (3, 4500.00, 'relayed',
   'Usuario #3, Week 14 follow-up session, de parte de quien decide en su empresa',
   'Conversación de seguimiento distinta. Reportado por el usuario #3 de parte de quien decide.')
) as s (orden, amount_mxn, state, source, note)
where not exists (
  select 1 from public.pricing_evidence p
  where p.amount_mxn = s.amount_mxn and p.state = s.state and p.source = s.source
)
-- Orden explícito: sin él, Postgres puede insertar en otro orden (pasó en
-- test:schema: el 4,000 quedó con id 1).
order by s.orden;

-- Comprobación: deben salir exactamente 3 filas (3,500 direct, 4,000
-- direct, 4,500 relayed) y ninguna paid.
select id, amount_mxn, state, source, payment_reference, created_at
from public.pricing_evidence
order by id;
