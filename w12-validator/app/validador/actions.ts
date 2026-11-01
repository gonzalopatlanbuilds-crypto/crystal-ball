"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyMexico, leerCsv, TAMANO_MAX_BYTES, validarArchivo, type FilaRechazada } from "@/lib/csv";
import { CSV_EJEMPLO, NOMBRE_EJEMPLO } from "@/lib/ejemplo";
import { detectarHallazgos, type HallazgoGuardado, type VersionHistorial } from "@/lib/validador";

export type CargaState =
  | undefined
  | { error: string; rechazadas?: FilaRechazada[] }
  | {
      archivo: string;
      versionId: string;
      identicaALaAnterior: boolean;
      hallazgosNuevos: number;
      aceptadas: number;
      rechazadas: FilaRechazada[];
      columnasIgnoradas: string[];
    };

interface RegistrarVersionRow {
  version_id: string;
  identical_to_previous: boolean;
  findings_created: number;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Lee el historial y los hallazgos de la org (RLS: solo la propia), corre
// el motor y guarda versión + hallazgos en una sola transacción.
async function guardarConHallazgos(
  supabase: Supabase,
  archivo: string,
  filas: VersionHistorial["raw_rows"],
  rechazadas: FilaRechazada[],
  esEjemplo: boolean,
) {
  const [versiones, guardados] = await Promise.all([
    supabase
      .from("evidence_versions")
      .select("id, seq, uploaded_at, uploaded_by, source_filename, identical_to_previous, raw_rows")
      .order("seq", { ascending: true })
      .returns<VersionHistorial[]>(),
    supabase.from("findings").select("fingerprint, status").returns<HallazgoGuardado[]>(),
  ]);
  if (versiones.error || guardados.error) {
    return { error: versiones.error ?? guardados.error, fila: null };
  }
  // PostgREST devuelve bigint como número; se normaliza por si llega texto.
  const historial = versiones.data.map((v) => ({ ...v, seq: Number(v.seq) }));
  const hallazgos = detectarHallazgos(historial, guardados.data, { source_filename: archivo, filas });
  const { data, error } = await supabase.rpc("registrar_version", {
    p_source_filename: archivo,
    p_raw_rows: filas,
    p_invalid_rows: rechazadas,
    p_is_example: esEjemplo,
    p_findings: hallazgos,
    p_base_seq: historial.length ? historial[historial.length - 1].seq : null,
  });
  // Mismo cast manual que create_org (w10): un RPC `returns table` llega
  // como arreglo en tiempo de ejecución.
  return { error, fila: (data as unknown as RegistrarVersionRow[] | null)?.[0] ?? null };
}

// El mismo camino para un archivo subido y para el ejemplo: la validación
// del servidor no se salta para nadie.
async function procesar(archivo: string, texto: string, esEjemplo: boolean): Promise<CargaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const leido = leerCsv(texto, hoyMexico());
  if (!leido.ok) {
    return { error: `Archivo rechazado, no se guardó nada: ${leido.error}` };
  }
  if (leido.filas.length === 0) {
    return {
      error: "Ninguna fila es válida, así que no se guardó una versión. Corrige las filas de abajo y vuelve a subir el archivo.",
      rechazadas: leido.rechazadas,
    };
  }

  let { error, fila } = await guardarConHallazgos(supabase, archivo, leido.filas, leido.rechazadas, esEjemplo);
  // Otra carga de la org entró mientras se calculaban los hallazgos: se
  // recalcula una vez con el historial nuevo.
  if (error && /CAMBIO_CONCURRENTE/.test(error.message)) {
    ({ error, fila } = await guardarConHallazgos(supabase, archivo, leido.filas, leido.rechazadas, esEjemplo));
  }
  if (error || !fila) {
    console.error("procesar: registrar_version falló", error);
    return { error: "No se pudo guardar la versión. Intenta de nuevo." };
  }

  revalidatePath("/validador");
  return {
    archivo,
    versionId: fila.version_id,
    identicaALaAnterior: fila.identical_to_previous,
    hallazgosNuevos: fila.findings_created,
    aceptadas: leido.filas.length,
    rechazadas: leido.rechazadas,
    columnasIgnoradas: leido.columnasIgnoradas,
  };
}

export async function subirCsv(_prev: CargaState, formData: FormData): Promise<CargaState> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || (archivo.size === 0 && archivo.name === "")) {
    return { error: "Selecciona un archivo CSV." };
  }
  // Solo el nombre, sin ruta (algunos navegadores viejos mandan la ruta).
  const nombre = archivo.name.split(/[\\/]/).pop()?.trim() ?? "";
  const problema = validarArchivo(nombre, archivo.type, archivo.size);
  if (problema) return { error: problema };

  const bytes = await archivo.arrayBuffer();
  // archivo.size lo declara el cliente; el límite se revisa sobre los
  // bytes que de verdad llegaron.
  if (bytes.byteLength > TAMANO_MAX_BYTES) {
    return { error: `El archivo pesa más de ${TAMANO_MAX_BYTES / 1024} KB.` };
  }
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { error: "El archivo no está en UTF-8. En Excel: Guardar como → CSV UTF-8." };
  }
  return procesar(nombre, texto, false);
}

export async function cargarEjemplo(): Promise<CargaState> {
  return procesar(NOMBRE_EJEMPLO, CSV_EJEMPLO, true);
}
