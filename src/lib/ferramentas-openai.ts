import { z } from "zod";
import { declaracoesDeFerramentas } from "./ferramentas";

const esquemaDosParametros = z.object({
  properties: z.record(z.string(), z.record(z.string(), z.unknown())),
  required: z.array(z.string()),
});

/** Adapta só a declaração: Gemini e OpenAI compartilham a execução das ferramentas. */
export const ferramentasOpenAI = declaracoesDeFerramentas.map((declaracao) => {
  const original = esquemaDosParametros.parse(declaracao.parametersJsonSchema);
  const properties = Object.fromEntries(Object.entries(original.properties).map(([campo, esquema]) => [
    campo,
    original.required.includes(campo) ? esquema : { ...esquema, type: [esquema.type, "null"] },
  ]));
  return {
    type: "function" as const,
    name: declaracao.name!,
    description: declaracao.description,
    strict: true,
    parameters: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
  };
});
