CREATE TABLE "conversas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversas_titulo_valido" CHECK (char_length("conversas"."titulo") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "conversas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mensagens_de_conversa" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversa_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "mensagens_de_conversa_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"papel" text NOT NULL,
	"conteudo" text NOT NULL,
	"ferramentas" jsonb,
	"fontes" jsonb,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mensagens_de_conversa_papel_valido" CHECK ("mensagens_de_conversa"."papel" in ('usuario', 'agente')),
	CONSTRAINT "mensagens_de_conversa_conteudo_valido" CHECK (char_length("mensagens_de_conversa"."conteudo") between 1 and 20000)
);
--> statement-breakpoint
ALTER TABLE "mensagens_de_conversa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_de_conversa" ADD CONSTRAINT "mensagens_de_conversa_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- O índice único precisa existir antes da chave composta que o referencia (o drizzle-kit gerou na ordem inversa).
CREATE UNIQUE INDEX "conversas_id_dono_idx" ON "conversas" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "mensagens_de_conversa" ADD CONSTRAINT "mensagens_de_conversa_conversa_id_user_id_conversas_id_user_id_fk" FOREIGN KEY ("conversa_id","user_id") REFERENCES "public"."conversas"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversas_dono_recentes_idx" ON "conversas" USING btree ("user_id","atualizada_em" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "mensagens_de_conversa_ordem_idx" ON "mensagens_de_conversa" USING btree ("conversa_id","seq");--> statement-breakpoint
CREATE POLICY "conversas_dono_policy" ON "conversas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "conversas"."user_id");--> statement-breakpoint
CREATE POLICY "mensagens_de_conversa_dono_policy" ON "mensagens_de_conversa" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "mensagens_de_conversa"."user_id");