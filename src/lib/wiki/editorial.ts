import { z } from "zod";
import { ErroWiki } from "./tipos";

export const POLITICA_EDITORIAL = "sintetica-v4" as const;
const justificativa = z.string().trim().min(12).max(700);
const criterio = z.object({ avaliacao: z.enum(["suficiente", "insuficiente", "incerto"]), justificativa }).strict();
/** Justificativas auditáveis de produto; não são raciocínio interno nem prova de mérito semântico. */
export const esquemaEditorial = z.object({
  acao: z.enum(["criar", "enriquecer", "relacionar"]),
  utilidade: criterio, ganho: criterio, destino: criterio,
  candidatas: z.array(z.string().min(1)).max(120),
}).strict();
const resumo = z.string().trim().min(12).max(240);
const semPublicacao = z.object({ decisao: z.enum(["conservar_origem", "adiar"]), motivo: resumo,
  condicao: z.string().trim().min(12).max(200).nullable(),
  tipoDePendencia: z.enum(["contexto_da_origem", "leitura_de_neuronio"]).nullable().default(null),
  neuroniosALer: z.array(z.string().min(1)).max(3).default([]),
}).strict();
export type DecisaoSemPublicacao = z.infer<typeof semPublicacao>;
/** Envelope separado permite validar propostas individualmente sem aceitar a omissão da política no provedor. */
export const camposDoEnvelopeEditorial = { politica: z.literal(POLITICA_EDITORIAL), semPublicacao: semPublicacao.nullable() };
export const esquemaDoEnvelopeEditorial = z.object({ ...camposDoEnvelopeEditorial, propostas: z.array(z.unknown()).max(3) }).strict()
  .superRefine((e, ctx) => {
    if (Boolean(e.propostas.length) === Boolean(e.semPublicacao)) ctx.addIssue({ code: "custom", message: "Escolha propostas ou uma decisão sem publicação." });
    if (e.semPublicacao?.decisao === "adiar" && !e.semPublicacao.condicao) ctx.addIssue({ code: "custom", message: "Adiamento exige condição de reavaliação." });
    if (e.semPublicacao?.decisao === "conservar_origem" && e.semPublicacao.condicao !== null) ctx.addIssue({ code: "custom", message: "Conservar não agenda reavaliação." });
    const d = e.semPublicacao;
    if (d?.decisao === "adiar" && !d.tipoDePendencia) ctx.addIssue({ code: "custom", message: "Identifique o tipo de pendência." });
    if (d?.tipoDePendencia === "leitura_de_neuronio" ? !d.neuroniosALer.length || d.decisao !== "adiar" : Boolean(d?.neuroniosALer.length)) ctx.addIssue({ code: "custom", message: "Leitura dirigida exige adiamento e destinos identificados." });
    if (d?.decisao === "conservar_origem" && d.tipoDePendencia !== null) ctx.addIssue({ code: "custom", message: "Conservar não tem pendência." });
    if (d && new Set(d.neuroniosALer).size !== d.neuroniosALer.length) ctx.addIssue({ code: "custom", message: "Destinos repetidos." });
  });
export type DecisaoEditorial = z.infer<typeof esquemaEditorial>;
export type RegistroEditorial = DecisaoEditorial & { politica: typeof POLITICA_EDITORIAL;
  origem: { id: string; revisao: number; inicio: number; fim: number } };

/** Categoria distinta e segura para a fila: não transportar justificativa ou texto de notas nos logs. */
export class DecisaoEditorialAdiada extends ErroWiki {
  override name = "DecisaoEditorialAdiada";
  constructor(readonly decisao: DecisaoSemPublicacao) { super("A decisão editorial precisa de contexto ou revisão da origem.", 422); }
}
export class PropostaEditorialRecusada extends ErroWiki {
  override name = "PropostaEditorialRecusada";
  constructor() { super("A proposta não atende ao contrato editorial.", 422); }
}
