import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ResultadoScoring } from "@/lib/scoring";

// ============================================================
// El LLM aquí SOLO redacta. Nunca recibe la posibilidad de calcular un
// score ni decidir un flag — esos ya vienen resueltos por calcularScore()
// en lib/scoring.ts antes de llegar a este archivo. Este módulo solo
// convierte un `ResultadoScoring` ya flagged en una frase en español para
// el empleador. Ver DECISIONS.md → "Alcance de Feature 4".
// ============================================================

const SYSTEM_PROMPT = `Redactas, en español, una explicación breve (2-4 oraciones) para un empleador que está viendo por qué el resultado de un candidato quedó marcado para revisión humana.

Reglas estrictas:
- Usa ÚNICAMENTE los datos que te dan (rol, score total, motivos, desglose por criterio). Nunca inventes un criterio, un número o una razón que no esté en los datos.
- No decidas si el candidato debe avanzar, ser rechazado o ser entrevistado — esa decisión es del empleador, no tuya.
- No repitas los motivos como una lista; redáctalos como un párrafo natural.
- Nunca digas que el candidato es "bueno", "malo", "recomendado" ni uses lenguaje de veredicto — describe el patrón de datos, no una conclusión.
- Responde solo con el párrafo, sin encabezados ni comillas.`;

export interface DatosBorderline {
  roleName: string;
  resultado: Pick<ResultadoScoring, "totalPonderado" | "motivos" | "desglose">;
}

export async function redactarExplicacionBorderline({
  roleName,
  resultado,
}: DatosBorderline): Promise<string> {
  const client = new Anthropic();

  const userContent = JSON.stringify({
    rol: roleName,
    scoreTotal: resultado.totalPonderado,
    motivosCalculadosPorReglas: resultado.motivos,
    desglosePorCriterio: resultado.desglose.map((d) => ({
      criterio: d.label,
      peso: d.weight,
      score: d.score,
    })),
  });

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("El modelo no devolvió texto.");
  }
  return textBlock.text.trim();
}
