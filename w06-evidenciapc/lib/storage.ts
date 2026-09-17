import type { SupabaseClient } from "@supabase/supabase-js";

export const EVIDENCE_BUCKET = "closure-evidence";
export const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutos — suficiente para ver una pantalla de revisión

function extensionDeMimeType(mediaType: string): string {
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/webp") return "webp";
  if (mediaType === "image/gif") return "gif";
  return "jpg";
}

export function rutaEvidencia(orgId: string, findingId: string, closureId: string, mediaType: string): string {
  return `${orgId}/${findingId}/${closureId}.${extensionDeMimeType(mediaType)}`;
}

export async function subirEvidencia(
  supabase: SupabaseClient,
  path: string,
  bytes: ArrayBuffer,
  mediaType: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, bytes, {
    contentType: mediaType,
    upsert: false,
  });
  return { error: error?.message ?? null };
}

export async function urlFirmadaEvidencia(
  supabase: SupabaseClient,
  path: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}
