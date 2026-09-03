import { customType } from "drizzle-orm/pg-core";

/**
 * `tsvector` não tem tipo nativo no drizzle-orm — só usado para tipar a
 * coluna gerada (STORED) de busca textual em `notas`/`entidades`. Nunca
 * gravado a partir da aplicação (sempre `GENERATED ALWAYS AS ... STORED`),
 * por isso não entra em `$inferInsert` das tabelas que a usam (ver
 * `.generatedAlwaysAs` nos schemas).
 */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});
