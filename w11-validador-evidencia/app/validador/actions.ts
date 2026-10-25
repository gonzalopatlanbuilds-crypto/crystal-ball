"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyMexico, leerCsv, TAMANO_MAX_BYTES, validarArchivo, type FilaRechazada } from "@/lib/csv";
import { CSV_EJEMPLO, NOMBRE_EJEMPLO } from "@/lib/ejemplo";

export type CargaState =
  | undefined
  | { error: string; rechazadas?: FilaRechazada[] }
  | {
      archivo: string;
      versionId: string;
      duplicada: boolean;
      aceptadas: number;
      rechazadas: FilaRechazada[];
      columnasIgnoradas: string[];
    };

interface RegistrarVersionRow {
  version_id: string;
  duplicada: boolean;
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

  const { data, error } = await supabase.rpc("registrar_version", {
    p_source_filename: archivo,
    p_raw_rows: leido.filas,
    p_invalid_rows: leido.rechazadas,
    p_is_example: esEjemplo,
  });
  // Mismo cast manual que create_org (w10): un RPC `returns table` llega
  // como arreglo en tiempo de ejecución.
  const fila = (data as unknown as RegistrarVersionRow[] | null)?.[0];
  if (error || !fila) {
    console.error("procesar: registrar_version falló", error);
    return { error: "No se pudo guardar la versión. Intenta de nuevo." };
  }

  revalidatePath("/validador");
  return {
    archivo,
    versionId: fila.version_id,
    duplicada: fila.duplicada,
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
