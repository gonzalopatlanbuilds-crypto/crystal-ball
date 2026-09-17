import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: {
    // Server Actions rechazan el body entero (413) por encima de este
    // límite antes de que el código de la acción corra — el default de
    // Next.js es 1 MB, muy por debajo del límite de foto de evidencia
    // que ya se valida en `enviarCierre` (`FOTO_MAX_BYTES`, 8 MB en
    // lib/closures.ts). 10 MB deja margen para el resto del multipart
    // (descripción, boundary) sin abrir la puerta a fotos absurdamente
    // grandes.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
