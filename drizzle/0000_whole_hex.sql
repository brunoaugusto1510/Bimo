CREATE TYPE "public"."criado_por" AS ENUM('usuario', 'agente');--> statement-breakpoint
CREATE TYPE "public"."status_entidade" AS ENUM('rascunho', 'aprovada', 'mesclada');--> statement-breakpoint
CREATE TYPE "public"."tipo_no" AS ENUM('entidade', 'nota');--> statement-breakpoint
CREATE TYPE "public"."tipo_relacao" AS ENUM('relaciona_com', 'parte_de', 'depende_de', 'deriva_de', 'substitui', 'contradiz', 'documenta', 'menciona');--> statement-breakpoint
CREATE TABLE "nos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tipo" "tipo_no" NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "entidades" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" text,
	"aliases" text[],
	"confianca" numeric(3, 2),
	"status" "status_entidade" DEFAULT 'rascunho' NOT NULL,
	"criado_por" "criado_por" NOT NULL,
	"criado_por_ferramenta" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entidades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notas" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"conteudo" text NOT NULL,
	"tags" text[],
	"criado_por" "criado_por" NOT NULL,
	"criado_por_ferramenta" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fontes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fontes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"caminho_armazenamento" text NOT NULL,
	"nome_arquivo_original" text,
	"tipo_mime" text,
	"hash_conteudo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fontes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "relacoes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "relacoes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"origem_id" bigint NOT NULL,
	"destino_id" bigint NOT NULL,
	"tipo" "tipo_relacao" NOT NULL,
	"criado_por" "criado_por" NOT NULL,
	"criado_por_ferramenta" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"removido_em" timestamp with time zone,
	"removido_por" "criado_por"
);
--> statement-breakpoint
ALTER TABLE "relacoes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "proveniencia" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "proveniencia_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"fonte_id" bigint NOT NULL,
	"entidade_id" bigint,
	"nota_id" bigint,
	"locator" text,
	"vinculado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proveniencia_alvo_unico_chk" CHECK (("proveniencia"."entidade_id" is not null)::int + ("proveniencia"."nota_id" is not null)::int = 1)
);
--> statement-breakpoint
ALTER TABLE "proveniencia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "versoes_entidade" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "versoes_entidade_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entidade_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" text,
	"aliases" text[],
	"confianca" numeric(3, 2),
	"status" "status_entidade" NOT NULL,
	"criado_por" "criado_por" NOT NULL,
	"criado_por_ferramenta" text,
	"versionado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "versoes_entidade" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "versoes_nota" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "versoes_nota_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nota_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"conteudo" text NOT NULL,
	"tags" text[],
	"criado_por" "criado_por" NOT NULL,
	"criado_por_ferramenta" text,
	"versionado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "versoes_nota" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nos" ADD CONSTRAINT "nos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_id_nos_id_fk" FOREIGN KEY ("id") REFERENCES "public"."nos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas" ADD CONSTRAINT "notas_id_nos_id_fk" FOREIGN KEY ("id") REFERENCES "public"."nos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas" ADD CONSTRAINT "notas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fontes" ADD CONSTRAINT "fontes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacoes" ADD CONSTRAINT "relacoes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacoes" ADD CONSTRAINT "relacoes_origem_id_nos_id_fk" FOREIGN KEY ("origem_id") REFERENCES "public"."nos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacoes" ADD CONSTRAINT "relacoes_destino_id_nos_id_fk" FOREIGN KEY ("destino_id") REFERENCES "public"."nos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveniencia" ADD CONSTRAINT "proveniencia_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveniencia" ADD CONSTRAINT "proveniencia_fonte_id_fontes_id_fk" FOREIGN KEY ("fonte_id") REFERENCES "public"."fontes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveniencia" ADD CONSTRAINT "proveniencia_entidade_id_entidades_id_fk" FOREIGN KEY ("entidade_id") REFERENCES "public"."entidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveniencia" ADD CONSTRAINT "proveniencia_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versoes_entidade" ADD CONSTRAINT "versoes_entidade_entidade_id_entidades_id_fk" FOREIGN KEY ("entidade_id") REFERENCES "public"."entidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versoes_entidade" ADD CONSTRAINT "versoes_entidade_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versoes_nota" ADD CONSTRAINT "versoes_nota_nota_id_notas_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."notas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versoes_nota" ADD CONSTRAINT "versoes_nota_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nos_user_id_idx" ON "nos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "entidades_user_id_idx" ON "entidades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notas_user_id_idx" ON "notas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fontes_user_id_idx" ON "fontes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "relacoes_user_id_idx" ON "relacoes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "relacoes_origem_id_idx" ON "relacoes" USING btree ("origem_id");--> statement-breakpoint
CREATE INDEX "relacoes_destino_id_idx" ON "relacoes" USING btree ("destino_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relacoes_ativa_unica_idx" ON "relacoes" USING btree ("origem_id","destino_id","tipo") WHERE "relacoes"."removido_em" is null;--> statement-breakpoint
CREATE INDEX "proveniencia_user_id_idx" ON "proveniencia" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "proveniencia_fonte_id_idx" ON "proveniencia" USING btree ("fonte_id");--> statement-breakpoint
CREATE INDEX "proveniencia_entidade_id_idx" ON "proveniencia" USING btree ("entidade_id");--> statement-breakpoint
CREATE INDEX "proveniencia_nota_id_idx" ON "proveniencia" USING btree ("nota_id");--> statement-breakpoint
CREATE INDEX "versoes_entidade_entidade_id_idx" ON "versoes_entidade" USING btree ("entidade_id");--> statement-breakpoint
CREATE INDEX "versoes_nota_nota_id_idx" ON "versoes_nota" USING btree ("nota_id");--> statement-breakpoint
CREATE POLICY "nos_dono_policy" ON "nos" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "nos"."user_id") WITH CHECK ((select auth.uid()) = "nos"."user_id");--> statement-breakpoint
CREATE POLICY "entidades_dono_policy" ON "entidades" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "entidades"."user_id") WITH CHECK ((select auth.uid()) = "entidades"."user_id");--> statement-breakpoint
CREATE POLICY "notas_dono_policy" ON "notas" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "notas"."user_id") WITH CHECK ((select auth.uid()) = "notas"."user_id");--> statement-breakpoint
CREATE POLICY "fontes_dono_policy" ON "fontes" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "fontes"."user_id") WITH CHECK ((select auth.uid()) = "fontes"."user_id");--> statement-breakpoint
CREATE POLICY "relacoes_dono_policy" ON "relacoes" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "relacoes"."user_id") WITH CHECK ((select auth.uid()) = "relacoes"."user_id");--> statement-breakpoint
CREATE POLICY "proveniencia_dono_policy" ON "proveniencia" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "proveniencia"."user_id") WITH CHECK ((select auth.uid()) = "proveniencia"."user_id");--> statement-breakpoint
CREATE POLICY "versoes_entidade_dono_policy" ON "versoes_entidade" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "versoes_entidade"."user_id") WITH CHECK ((select auth.uid()) = "versoes_entidade"."user_id");--> statement-breakpoint
CREATE POLICY "versoes_nota_dono_policy" ON "versoes_nota" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "versoes_nota"."user_id") WITH CHECK ((select auth.uid()) = "versoes_nota"."user_id");