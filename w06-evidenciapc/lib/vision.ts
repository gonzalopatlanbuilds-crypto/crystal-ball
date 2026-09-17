import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_LABEL } from "@/lib/closures";

// ============================================================
// Este módulo SOLO redacta una nota corta y asistiva sobre la foto de
// cierre — nunca decide nada. El same-day flag (lib/closures.ts) ya se
// calculó por reglas fijas antes de que este módulo entre en juego, y el
// veredicto final (aprobar/rechazar) lo da siempre un humano verificador
// (Feature 4), nunca este modelo. Si esta llamada falla, quien la invoca
// (closures/actions.ts) debe seguir adelante sin nota — un fallo del
// modelo de visión nunca puede bloquear un cierre.
// ============================================================

const SYSTEM_PROMPT = `Eres un apoyo de revisión, no un verificador. Te dan la descripción de un hallazgo crítico, la acción correctiva que se pidió, la descripción que escribió quien cierra el hallazgo, y una foto de evidencia.

Responde en español, en UNA sola oración corta (máximo ~30 palabras), diciendo si la foto parece consistente con la acción correctiva descrita o si hay algo que no queda claro (ej. la foto no muestra el área descrita, está borrosa, o no se relaciona con el texto).

Reglas estrictas:
- Nunca digas "aprobado", "rechazado", "correcto", "cumple" ni ninguna palabra que suene a veredicto o decisión final — esa decisión la toma siempre un humano verificador, nunca tú.
- Nunca inventes detalles que no puedas ver en la imagen.
- No repitas la descripción tal cual; da tu propia observación breve.
- Responde solo con la oración, sin comillas, sin markdown, sin encabezado.`;

export interface AnalisisEvidenciaInput {
  scenarioLabel: string;
  description: string;
  correctiveAction: string;
  closureDescription: string;
  photoBase64: string;
  mediaType: string;
}

export async function analizarEvidenciaCierre({
  scenarioLabel,
  description,
  correctiveAction,
  closureDescription,
  photoBase64,
  mediaType,
}: AnalisisEvidenciaInput): Promise<{ note: string; label: string }> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              escenario: scenarioLabel,
              hallazgo: description,
              accionCorrectivaPedida: correctiveAction,
              descripcionDelCierre: closureDescription,
            }),
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: photoBase64,
            },
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("El modelo de visión no devolvió texto.");
  }
  return { note: textBlock.text.trim(), label: AI_LABEL };
}
