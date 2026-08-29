import type { Aresta, Nota, RespostaAgente, Sugestao, TipoDeAcaoIA } from "@/dados/tipos";

export interface ServicoVault {
  listarNotas(): Promise<Nota[]>;
  obterNota(id: string): Promise<Nota>;
  listarArestas(): Promise<Aresta[]>;
  salvarNota(nota: Nota): Promise<void>;
}

export interface ServicoIA {
  conversar(texto: string): Promise<RespostaAgente>;
  acaoNaNota(tipo: TipoDeAcaoIA, nota: Nota): Promise<Sugestao>;
}
