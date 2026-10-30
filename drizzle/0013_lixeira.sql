DROP INDEX "notas_usuario_pasta_titulo_unico";--> statement-breakpoint
ALTER TABLE "notas" ADD COLUMN "removida_em" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "notas_usuario_pasta_titulo_unico" ON "notas" USING btree ("user_id",coalesce("pasta", ''),lower("titulo")) WHERE "notas"."removida_em" is null;