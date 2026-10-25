CREATE UNIQUE INDEX "notas_id_dono_unico" ON "notas" USING btree ("id","user_id");
--> statement-breakpoint
CREATE TABLE "conceitos_wiki" (
	"nota_id" bigint PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"chave" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"origens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"protegida" boolean DEFAULT false NOT NULL,
	"revisao_gerenciada" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "conceitos_wiki_revisao_positiva" CHECK ("conceitos_wiki"."revisao_gerenciada" > 0),
	CONSTRAINT "conceitos_wiki_chave_valida" CHECK (char_length("conceitos_wiki"."chave") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "conceitos_wiki" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consumos_wiki" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"dia" date NOT NULL,
	"nota_id" text NOT NULL,
	"geracao" integer NOT NULL,
	"reservado" integer NOT NULL,
	"utilizado" integer,
	"estado" text DEFAULT 'reservado' NOT NULL,
	"modelo" text NOT NULL,
	"versao_pipeline" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "consumos_wiki_quantidade_valida" CHECK ("consumos_wiki"."reservado" > 0 and ("consumos_wiki"."utilizado" is null or "consumos_wiki"."utilizado" >= 0)),
	CONSTRAINT "consumos_wiki_estado_valido" CHECK ("consumos_wiki"."estado" in ('reservado', 'confirmado', 'incerto'))
);
--> statement-breakpoint
ALTER TABLE "consumos_wiki" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trabalhos_wiki" (
	"user_id" uuid NOT NULL,
	"nota_id" bigint NOT NULL,
	"revisao" integer NOT NULL,
	"geracao" integer DEFAULT 1 NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"disponivel_em" timestamp with time zone DEFAULT now() NOT NULL,
	"posse" uuid,
	"posse_ate" timestamp with time zone,
	CONSTRAINT "trabalhos_wiki_user_id_nota_id_pk" PRIMARY KEY("user_id","nota_id"),
	CONSTRAINT "trabalhos_wiki_progresso_valido" CHECK ("trabalhos_wiki"."revisao" > 0 and "trabalhos_wiki"."geracao" > 0 and "trabalhos_wiki"."cursor" >= 0 and "trabalhos_wiki"."tentativas" >= 0),
	CONSTRAINT "trabalhos_wiki_estado_valido" CHECK ("trabalhos_wiki"."estado" in ('pendente', 'concluido', 'temporario', 'revisar', 'configuracao'))
);
--> statement-breakpoint
ALTER TABLE "trabalhos_wiki" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conceitos_wiki" ADD CONSTRAINT "conceitos_wiki_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conceitos_wiki" ADD CONSTRAINT "conceitos_wiki_nota_id_user_id_notas_id_user_id_fk" FOREIGN KEY ("nota_id","user_id") REFERENCES "public"."notas"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumos_wiki" ADD CONSTRAINT "consumos_wiki_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabalhos_wiki" ADD CONSTRAINT "trabalhos_wiki_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabalhos_wiki" ADD CONSTRAINT "trabalhos_wiki_nota_id_user_id_notas_id_user_id_fk" FOREIGN KEY ("nota_id","user_id") REFERENCES "public"."notas"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conceitos_wiki_dono_chave_idx" ON "conceitos_wiki" USING btree ("user_id","chave");--> statement-breakpoint
CREATE INDEX "conceitos_wiki_origens_idx" ON "conceitos_wiki" USING gin ("origens");--> statement-breakpoint
CREATE INDEX "consumos_wiki_dono_dia_idx" ON "consumos_wiki" USING btree ("user_id","dia");--> statement-breakpoint
CREATE INDEX "trabalhos_wiki_prontos_idx" ON "trabalhos_wiki" USING btree ("user_id","disponivel_em") WHERE "trabalhos_wiki"."estado" = 'pendente';--> statement-breakpoint
CREATE POLICY "conceitos_wiki_dono_policy" ON "conceitos_wiki" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "conceitos_wiki"."user_id");--> statement-breakpoint
CREATE POLICY "consumos_wiki_dono_policy" ON "consumos_wiki" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "consumos_wiki"."user_id");--> statement-breakpoint
CREATE POLICY "trabalhos_wiki_dono_policy" ON "trabalhos_wiki" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "trabalhos_wiki"."user_id");
