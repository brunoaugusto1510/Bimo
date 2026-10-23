import type { NotaCompleta } from "../repositorio-de-notas/tipos";

export type FonteWiki = Pick<NotaCompleta, "id" | "titulo" | "pasta" | "revisao" | "conteudo">;
export type AfirmacaoWiki = {
  /** Estável entre publicações enquanto a afirmação não mudar; é por ele que o modelo mantém, substitui ou retira. */
  id: string;
  texto: string;
  natureza: "explicita" | "inferencia";
  evidencias: { fonteId: string; citacao: string; inicio: number; fim: number }[];
};
export type MetadadosWiki = {
  notaId: string; revisaoPublicada: number; fontes: FonteWiki[]; afirmacoes: AfirmacaoWiki[];
  /** Presente em sínteses da automação: a revisão que ela considera sua (renomear e mover a acompanham). */
  gerencia?: { revisao: number; protegida: boolean };
};
export type PublicacaoWiki = {
  titulo: string; conteudo: string; fontes: FonteWiki[]; afirmacoes: AfirmacaoWiki[];
  alvo: { id: string; revisao: number } | null;
  /** Uma síntese nova nasce na organização da origem. */
  pasta: string | null;
  conceito: { chave: string; aliases: string[] };
};
/**
 * Leitura das sínteses. A escrita só acontece pela fila (`automacao.concluir`), que revalida posse,
 * geração e revisões e grava nota, histórico, evidências e progresso na mesma transação.
 */
export interface RepositorioDaWiki {
  readonly automacao?: import("./automacao-tipos").AutomacaoWiki;
  listar(): Promise<MetadadosWiki[]>;
  obter(id: string): Promise<MetadadosWiki | null>;
}
// `name` explícito: a minificação do servidor renomeia classes, e os logs usam o nome como categoria.
export class ErroWiki extends Error {
  override name = "ErroWiki";
  constructor(mensagem: string, readonly status = 400) { super(mensagem); }
}
/** A resposta chegou, mas não serve (incompleta, recusada ou ilegível); repetir daria o mesmo resultado. */
export class ErroDaGeracaoWiki extends Error {
  override name = "ErroDaGeracaoWiki";
  constructor(mensagem: string, readonly uso: { entrada: number; saida: number } | null) { super(mensagem); }
}

/** Executado novamente dentro da transação/trecho síncrono da publicação. */
export function conferirFontes(fontes: FonteWiki[], atuais: (NotaCompleta | null)[], paginas: Set<string>) {
  if (!fontes.length || fontes.length > 10 || new Set(fontes.map((f) => f.id)).size !== fontes.length) throw new ErroWiki("Escolha de uma a dez notas diferentes.");
  for (const [i, fonte] of fontes.entries()) {
    const atual = atuais[i];
    if (paginas.has(fonte.id)) throw new ErroWiki("Uma página derivada não pode ser fonte de si mesma ou de outra síntese.");
    if (!atual || [atual.revisao, atual.titulo, atual.pasta, atual.conteudo].some((valor, j) => valor !== [fonte.revisao, fonte.titulo, fonte.pasta, fonte.conteudo][j])) {
      throw new ErroWiki("Uma nota de origem mudou ou não está mais disponível. Refaça a compilação.", 409);
    }
  }
}
