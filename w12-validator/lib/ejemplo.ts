// CSV de ejemplo para el botón "Cargar ejemplo". Todo es inventado: los
// dos proveedores, los 8 SKUs y los folios no existen. Dos SKUs los
// reportan ambos proveedores (para que la Feature 3 tenga casos de
// "falta proveedor").
export const NOMBRE_EJEMPLO = "ejemplo-simulado.csv";

export const CSV_EJEMPLO = `sku,supplier,weight_g,material,packaging_revision_date,evidence_folio
SIM-1190,Proveedor Simulado Alfa,18.2,PET,2026-09-15,FOL-SIM-0001
SIM-1190,Proveedor Simulado Beta,18.4,PET,2026-09-18,FOL-SIM-0002
SIM-2034,Proveedor Simulado Alfa,42,cartón corrugado,2026-08-30,FOL-SIM-0003
SIM-3307,Proveedor Simulado Alfa,7.5,PEAD,2026-09-02,FOL-SIM-0004
SIM-4821,Proveedor Simulado Alfa,120,vidrio,2026-07-21,FOL-SIM-0005
SIM-4821,Proveedor Simulado Beta,119.5,vidrio,2026-07-25,FOL-SIM-0006
SIM-5502,Proveedor Simulado Beta,3.1,"papel, laminado",2026-09-10,FOL-SIM-0007
SIM-6018,Proveedor Simulado Beta,55,aluminio,2026-08-12,FOL-SIM-0008
SIM-7733,Proveedor Simulado Beta,24.5,PP,2026-09-01,FOL-SIM-0009
SIM-8890,Proveedor Simulado Alfa,"12,5",cartón,2026-09-20,FOL-SIM-0010
`;
