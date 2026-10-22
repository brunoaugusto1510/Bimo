CREATE TABLE "paginas_wiki" (
	"nota_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"revisao_publicada" integer NOT NULL,
	"fontes" jsonb NOT NULL,
	"afirmacoes" jsonb NOT NULL,
	CONSTRAINT "paginas_wiki_nota_id_revisao_publicada_pk" PRIMARY KEY("nota_id","revisao_publicada")
);
--> statement-breakpoint
ALTER TABLE "paginas_wiki" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paginas_wiki" ADD CONSTRAINT "paginas_wiki_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paginas_wiki" ADD CONSTRAINT "paginas_wiki_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paginas_wiki_dono_idx" ON "paginas_wiki" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "paginas_wiki_dono_policy" ON "paginas_wiki" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "paginas_wiki"."user_id") WITH CHECK ((select auth.uid()) = "paginas_wiki"."user_id" and exists (select 1 from public.notas n where n.id = "paginas_wiki"."nota_id" and n.user_id = (select auth.uid())));
