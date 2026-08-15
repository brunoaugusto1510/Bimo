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
