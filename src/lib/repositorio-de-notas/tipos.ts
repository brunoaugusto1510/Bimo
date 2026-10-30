/**
 * O contrato entre o app e o lugar onde as notas moram.
 *
 * Tudo acima daqui (serviço, rotas, interface, agente) fala só com
 * `RepositorioDeNotas`. Quem implementa decide o armazenamento: o banco do
 * Bimo (`banco.ts`) ou uma memória descartável para testes e desenvolvimento
 * (`memoria.ts`).
 */

import type { ConfiguracaoDoGrafo } from "../fisica-do-grafo";
import type { IdDeNota } from "../types";

export type { IdDeNota };

export type ResumoDeNota = {
  id: IdDeNota;
  titulo: string;
  /** Caminho da pasta (`A/B`); `null` é a raiz. Organização pura, não identidade. */
  pasta: string | null;
  tags: string[];
  /** ISO 8601, ou `null` quando a fonte não sabe. */
  criadoEm: string | null;
  atualizadoEm: string | null;
  /**
   * Cresce a cada gravação. É o que o editor devolve como `revisaoBase` para a
   * escrita dizer se alguém mexeu na nota no meio do caminho (concorrência otimista).
   */
  revisao: number;
};

export type NotaCompleta = ResumoDeNota & { conteudo: string };
export type NotaNaLixeira = ResumoDeNota & { removidaEm: string };

export type ResultadoDeBusca = {
  id: IdDeNota;
  titulo: string;
  pasta: string | null;
  /** Trecho em volta do que casou; no banco o termo vem entre `**`. */
  trecho: string;
};

/** Já validado: título passou por `validarTitulo` e a pasta por `normalizarPasta`. */
export type EntradaDeNota = {
  titulo: string;
  pasta?: string | null;
  conteudo?: string;
  tags?: string[];
};

export type MudancasDeNota = {
  conteudo?: string;
  pasta?: string | null;
  tags?: string[];
};

/** Quem escreveu — vai para o histórico de versões. */
export type AutorDaEscrita = {
  criadoPor: "usuario" | "agente";
  /** Nome da ferramenta do agente, ou "renomear_nota" etc. */
  ferramenta?: string;
};

export type OpcoesDeAtualizacao = {
  /** A revisão que o editor tinha quando começou a editar. */
  revisaoBase: number;
  autor: AutorDaEscrita;
  /**
   * `true` fecha a sessão de edição (Ctrl+S, trocar de nota, mudar pasta ou
   * tags): a versão gravada não é mais reaproveitada pelos salvamentos automáticos seguintes.
   */
  checkpoint?: boolean;
};

export type ResultadoDeEscrita =
  | { tipo: "ok"; nota: NotaCompleta; notasReescritas?: number }
  /** Outra escrita aconteceu desde `revisaoBase`; `atual` é o que está salvo agora. */
  | { tipo: "conflito"; atual: NotaCompleta }
  /** Já existe nota com esse título nessa pasta. */
  | { tipo: "titulo-em-uso"; idExistente: IdDeNota }
  | { tipo: "nao-encontrada" }
  | { tipo: "somente-leitura" };

export type ResultadoDeRenomeacao =
  | Exclude<ResultadoDeEscrita, { tipo: "ok" }>
  | {
      tipo: "ok";
      nota: NotaCompleta;
      /** Quantas outras notas tiveram `[[ligações]]` reescritas. */
      notasReescritas: number;
    };

export type CapacidadesDoRepositorio = {
  /** Aceita criar, editar e renomear. */
  escrita: boolean;
  /** Sabe a data de criação e de edição. */
  datas: boolean;
};

export interface RepositorioDeNotas {
  /** Ausente enquanto a Wiki Viva não estiver habilitada no ambiente. */
  readonly wiki?: import("../wiki/tipos").RepositorioDaWiki;
  readonly capacidades: CapacidadesDoRepositorio;

  /**
   * Muda sempre que qualquer nota muda. É a chave de validade dos caches do
   * serviço: barata de calcular, igual entre instâncias que veem os mesmos dados.
   */
  marcaDeVersao(): Promise<string>;

  /** Algo que a pessoa deveria saber sobre a listagem (ex.: "repositório grande demais, lista incompleta"). */
  obterAviso(): Promise<string | undefined>;

  /** As opções do grafo (forças, tags, órfãs). Fontes sem configuração própria devolvem os padrões. */
  obterConfiguracaoDoGrafo(): Promise<ConfiguracaoDoGrafo>;

  listarResumos(): Promise<ResumoDeNota[]>;
  /** Todas as notas com o texto: é do que saem o grafo e os links de entrada. */
  listarComConteudo(): Promise<NotaCompleta[]>;
  obterNota(id: IdDeNota): Promise<NotaCompleta | null>;
  buscarPorConteudo(consulta: string, limite: number): Promise<ResultadoDeBusca[]>;
  /** Os mesmos acertos, só os ids e na mesma ordem, sem montar trechos (que é a parte cara da busca). */
  buscarIdsPorConteudo(consulta: string, limite: number): Promise<IdDeNota[]>;

  criarNota(entrada: EntradaDeNota, autor: AutorDaEscrita): Promise<ResultadoDeEscrita>;
  listarLixeira(): Promise<NotaNaLixeira[]>;
  moverParaLixeira(id: IdDeNota, revisaoBase: number): Promise<ResultadoDeEscrita>;
  restaurarNota(id: IdDeNota, revisaoBase: number): Promise<ResultadoDeEscrita>;
  atualizarNota(id: IdDeNota, mudancas: MudancasDeNota, opcoes: OpcoesDeAtualizacao): Promise<ResultadoDeEscrita>;
  /**
   * Muda o título e reescreve, na mesma operação, as `[[ligações]]` das notas
   * que apontavam para esta.
   */
  renomearNota(
    id: IdDeNota,
    novoTitulo: string,
    opcoes: { revisaoBase: number; autor: AutorDaEscrita },
  ): Promise<ResultadoDeRenomeacao>;
}
