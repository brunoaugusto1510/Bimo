import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Enums nativos do Postgres (fechados) para os vocabulários decididos no
 * Architecture Audit. Adicionar um valor novo é uma migração deliberada
 * (ALTER TYPE ... ADD VALUE) — nunca algo que o agente decide sozinho em
 * runtime (Decisão 3).
 */

/** Discrimina se um nó do grafo (tabela `nos`) é uma Entidade ou uma Nota. */
export const tipoNoEnum = pgEnum("tipo_no", ["entidade", "nota"]);

/** Ciclo de vida de uma Entidade extraída/consolidada pelo agente (Decisão 5). */
export const statusEntidadeEnum = pgEnum("status_entidade", [
  "rascunho",
  "aprovada",
  "mesclada",
]);

/** Quem criou/alterou um registro — nunca fica vazio (Decisão 2, Camada 1). */
export const criadoPorEnum = pgEnum("criado_por", ["usuario", "agente"]);

/**
 * Tipos fechados de relação (Decisão 3): os 6 estruturais entre
 * entidade↔entidade/nota, mais `documenta`/`menciona` para o vínculo
 * nota↔entidade que antes seria uma tabela separada.
 */
export const tipoRelacaoEnum = pgEnum("tipo_relacao", [
  "relaciona_com",
  "parte_de",
  "depende_de",
  "deriva_de",
  "substitui",
  "contradiz",
  "documenta",
  "menciona",
]);
