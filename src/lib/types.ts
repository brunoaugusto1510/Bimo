/**
 * Tipos compartilhados pela interface.
 *
 * Vale a pena ter isso num arquivo só: quando a etapa 3 conectar o Gemini de
 * verdade, é aqui que o formato das mensagens vai crescer, e o TypeScript vai
 * apontar todos os lugares que precisam acompanhar a mudança.
 */

export type Papel = "usuario" | "agente";

export type Mensagem = {
  id: string;
  papel: Papel;
  conteudo: string;
  /** Só existe em mensagens do agente que usaram alguma ferramenta. */
  ferramentas?: UsoDeFerramenta[];
  /** Notas que o agente leu para responder — as "Fontes" que o chat acende no cérebro. */
  fontes?: FonteDaResposta[];
};

export type FonteDaResposta = { id: IdDeNota; titulo: string };

/**
 * Identidade de uma nota para a interface, as rotas e o grafo. É opaca: quem
 * recebe um id não deve interpretá-lo. É o id da linha no banco — nunca contém
 * `:`, então não colide com os ids especiais do grafo (`tag:x`, `nao-resolvida:x`).
 */
export type IdDeNota = string;

/**
 * A árvore de pastas e notas da barra lateral: pastas contêm outras pastas e
 * notas, e cada nota carrega o `id` e a pasta onde está.
 *
 * É uma *união discriminada* — o campo `tipo` diz qual das duas formas o item
 * tem. Ao checar `if (item.tipo === "pasta")`, o TypeScript passa a saber que
 * `item.filhos` existe.
 */
export type ItemDeNotas =
  | {
      tipo: "pasta";
      nome: string;
      /** Caminho completo da pasta (`A/B`), o que identifica a pasta entre homônimas. */
      caminho: string;
      filhos: ItemDeNotas[];
    }
  | { tipo: "nota"; id: IdDeNota; nome: string; pasta: string | null };

/** Um uso de ferramenta pelo agente, para mostrar na interface o que ele consultou. */
export type UsoDeFerramenta = {
  nome: string;
  argumentos: Record<string, unknown>;
  /** Frase curta para exibir na UI, ex: 'Buscou "TCP" — 3 nota(s)' */
  resumo: string;
  erro?: boolean;
  /** Nota gravada (criar_nota/editar_nota bem-sucedidas); permite abri-la pela pílula. */
  notaId?: IdDeNota;
};
