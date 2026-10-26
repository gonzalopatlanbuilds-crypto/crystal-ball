# Prueba mecánica (PACKET, sección 10) — archivos

Todo es simulado. Proveedores, SKUs y folios inventados, solo para la
prueba. Se suben en este orden desde `/validador`:

| Archivo | Prueba | Qué cambia respecto a la anterior |
|---|---|---|
| `mt-0-base.csv` | base | Proveedor Simulado Epsilon con SIM-MT-01, 02 y 03 |
| `mt-1-falta-proveedor.csv` | 1 | falta SIM-MT-03 |
| `mt-2-conflicto.csv` | 2 | SIM-MT-01 pasa de 10 g a 14 g (SIM-MT-03 regresa igual) |
| `mt-3-revision-tardia.csv` | 3 | Proveedor Simulado Delta, SIM-LATE-01 con revisión 2026-10-20 (la base es `fixture-fecha-pasada.csv`, cargada el 2026-10-02 desde el SQL Editor) |
| `mt-4-folio-reusado.csv` | 4 | SIM-MT-02 cita el folio FOL-MT-1 de SIM-MT-01 |
| `mt-10-recarga.csv` | 10 | idéntico a `mt-4-folio-reusado.csv` |
