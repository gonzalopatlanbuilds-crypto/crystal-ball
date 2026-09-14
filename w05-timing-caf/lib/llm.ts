import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// El LLM aquí SOLO redacta. El nivel de riesgo ya lo decidió
// calcularRiesgo() (lib/scoring.ts) antes de que este módulo entre en
// juego — este archivo nunca recibe la posibilidad de clasificar nada,
// solo convierte un nivel + motivos ya decididos en una frase en español
// simple para el paciente. El siguiente paso concreto (lib/nextStep.ts)
// tampoco lo redacta el LLM — es texto fijo, para garantizar que un
// resultado de alto riesgo nunca se quede sin una acción concreta si la
// llamada al modelo falla.
// ============================================================

const SYSTEM_PROMPT = `Redactas, en español simple (2-4 oraciones cortas, para alguien que lee con dificultad y no tiene formación médica), una explicación de un resultado de tamizaje de diabetes cuyo nivel de riesgo YA fue decidido por reglas fijas, no por ti.

Reglas estrictas:
- Usa ÚNICAMENTE el nivel de riesgo, la lectura de glucosa y los motivos que te dan. Nunca inventes un síntoma, una cifra o una razón que no esté en los datos.
- No repitas los motivos como una lista técnica; conviértelos en un párrafo que le hable directo a la persona ("tu", no "el paciente").
- Nunca diagnostiques, nunca nombres una enfermedad como si ya la tuviera, nunca sugieras un medicamento ni un tratamiento — este resultado es una señal de alerta simulada, no un diagnóstico.
- No incluyas el siguiente paso ni el nombre de ninguna clínica — eso se muestra aparte, en otro texto.
- Responde solo con el párrafo, sin encabezados, sin comillas, sin markdown.`;

export interface DatosExplicacionPaciente {
  nivel: "alto" | "bajo";
  glucoseMgdl: number;
  motivos: string[];
}

export async function redactarExplicacionPaciente({
  nivel,
  glucoseMgdl,
  motivos,
}: DatosExplicacionPaciente): Promise<string> {
  const client = new Anthropic();

  const userContent = JSON.stringify({
    nivelDeRiesgoYaDecidido: nivel,
    lecturaGlucosaMgdl: glucoseMgdl,
    motivosCalculadosPorReglas: motivos,
  });

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("El modelo no devolvió texto.");
  }
  return textBlock.text.trim();
}
