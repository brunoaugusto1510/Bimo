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
};

/**
 * A estrutura do vault é uma árvore: pastas contêm outras pastas e notas.
 *
 * Isto é uma *união discriminada* — o campo `tipo` diz qual das duas formas o
 * item tem. Ao checar `if (item.tipo === "pasta")`, o TypeScript passa a saber
 * que `item.filhos` existe. É o padrão que evita campos opcionais espalhados.
 */
export type ItemVault =
  | { tipo: "pasta"; nome: string; filhos: ItemVault[] }
  | { tipo: "nota"; nome: string; caminho: string };

/**
 * Identidade de uma nota para a interface, as rotas e o grafo. É opaca: quem
 * recebe um id não deve interpretá-lo. Hoje é o id da linha no banco ou, na
 * transição, o caminho do arquivo no GitHub codificado — nunca contém `:`, então
 * não colide com os ids especiais do grafo (`tag:x`, `nao-resolvida:x`).
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
  /** Presente só nas ferramentas de escrita bem-sucedidas (criar_nota/editar_nota). */
  commitUrl?: string;
};
