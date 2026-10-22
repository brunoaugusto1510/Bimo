import type { FonteWiki, MetadadosWiki, PublicacaoWiki } from "./tipos";

export type TrabalhoWiki = {
  notaId: string; revisao: number; geracao: number; cursor: number; posse: string; tentativas: number;
};
export type ConceitoWiki = { notaId: string; chave: string; aliases: string[]; protegida: boolean; origens: Record<string, number>; revisaoGerenciada: number };
export type CoberturaWiki = { elegiveis: number; naoRegistradas: number; pendentes: number; concluidos: number; impedidos: number };
export type ConsumoWiki = { entrada: number; saida: number };
export type MotivoDaFalhaWiki = "temporario" | "revisar" | "configuracao" | "orcamento";
export interface AutomacaoWiki {
  /** Inserção idempotente; a reconciliação também recupera notas anteriores à ativação. */
  solicitar(notaId: string): Promise<void>;
  reconciliar(limite: number): Promise<number>;
  /** Um trabalho por dono de cada vez: chamadas paralelas não disputam o mesmo orçamento. */
  reivindicar(): Promise<TrabalhoWiki | null>;
  conceitos(): Promise<ConceitoWiki[]>;
  cobertura(): Promise<CoberturaWiki>;
  reservar(trabalho: TrabalhoWiki, quantidade: number, tetoDiario: number): Promise<string | null>;
  /** null mantém a reserva inteira: a chamada pode ter sido cobrada. */
  confirmarConsumo(reserva: string, uso: ConsumoWiki | null): Promise<void>;
  /**
   * Publicações, dependentes avaliadas sem mudança e avanço do cursor/conclusão são uma única transação.
   * `avaliadas` são sínteses que o modelo viu desatualizadas e decidiu não alterar.
   */
  concluir(trabalho: TrabalhoWiki, publicacoes: PublicacaoWiki[], proximoCursor: number | null, avaliadas?: string[]): Promise<void>;
  /** `erro` é só a categoria (ex.: "ErroOpenAI:429"), nunca texto de nota. Falta de orçamento não gasta tentativa. */
  falhar(trabalho: TrabalhoWiki, motivo: MotivoDaFalhaWiki, erro?: string): Promise<void>;
  /** Operação explícita após resolver configuração/falha; preserva proteção editorial. */
  retomar(): Promise<void>;
  gerenciar(notaId: string, revisaoBase: number, gerenciada: boolean): Promise<"ok" | "conflito" | "nao-encontrada">;
}
export type CandidataWiki = { nota: FonteWiki; metadados?: MetadadosWiki; conceito?: ConceitoWiki };
export type ContextoWiki = {
  origem: FonteWiki; trecho: { inicio: number; fim: number; texto: string };
  candidatas: CandidataWiki[];
};
export type ResultadoDaGeracaoWiki = { proposta: unknown; uso: ConsumoWiki | null };
export type GeradorAutomaticoWiki = (contexto: ContextoWiki, sinal: AbortSignal) => Promise<ResultadoDaGeracaoWiki>;
