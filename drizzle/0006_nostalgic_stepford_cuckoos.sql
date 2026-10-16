ALTER TABLE "notas" ADD COLUMN "revisao" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "versoes_nota" ADD COLUMN "sessao_aberta" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notas_usuario_pasta_titulo_unico" ON "notas" USING btree ("user_id",coalesce("pasta", ''),lower("titulo"));