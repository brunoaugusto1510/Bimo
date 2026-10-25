CREATE TABLE "eventos_wiki" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chave" text NOT NULL,
	"tipo" text NOT NULL,
	"sintese_id" text,
	"origem_id" text,
	"texto" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_wiki_texto_curto" CHECK (char_length("eventos_wiki"."texto") between 1 and 500),
	CONSTRAINT "eventos_wiki_tipo_valido" CHECK ("eventos_wiki"."tipo" in ('nasceu', 'cresceu', 'discordam', 'precisa_de_voce', 'sem_novidade', 'despertar', 'energia'))
);
--> statement-breakpoint
ALTER TABLE "eventos_wiki" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conceitos_wiki" ADD COLUMN "pausada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conceitos_wiki" ADD COLUMN "diagnostico" jsonb;--> statement-breakpoint
ALTER TABLE "eventos_wiki" ADD CONSTRAINT "eventos_wiki_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "eventos_wiki_dono_chave_idx" ON "eventos_wiki" USING btree ("user_id","chave");--> statement-breakpoint
CREATE INDEX "eventos_wiki_dono_periodo_idx" ON "eventos_wiki" USING btree ("user_id","criado_em","id");--> statement-breakpoint
CREATE POLICY "eventos_wiki_dono_policy" ON "eventos_wiki" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "eventos_wiki"."user_id");
--> statement-breakpoint
-- SHA-256 nativo do PostgreSQL; não exige instalar pgcrypto. Os offsets continuam em UTF-16,
-- como o editor: os trechos vêm das citações validadas, nunca de substring SQL por posição.
UPDATE public.paginas_wiki p SET fontes = (
  SELECT coalesce(jsonb_agg(CASE WHEN f.valor ? 'conteudo' THEN
    jsonb_build_object('id', f.valor->'id', 'titulo', f.valor->'titulo', 'pasta', f.valor->'pasta', 'revisao', f.valor->'revisao',
      'hash', encode(sha256(convert_to(f.valor->>'conteudo', 'UTF8')), 'hex'),
      'hashSemOrganizacao', encode(sha256(convert_to(regexp_replace(f.valor->>'conteudo', '\[\[[^\]]*\]\]', '[[]]', 'g'), 'UTF8')), 'hex'),
      'trechos', coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('inicio', e.valor->'inicio', 'fim', e.valor->'fim', 'texto', e.valor->'citacao'))
        FROM jsonb_array_elements(p.afirmacoes) a(valor)
        CROSS JOIN LATERAL jsonb_array_elements(a.valor->'evidencias') e(valor)
        WHERE e.valor->>'fonteId' = f.valor->>'id'), '[]'::jsonb))
    ELSE f.valor END ORDER BY f.ordem), '[]'::jsonb)
  FROM jsonb_array_elements(p.fontes) WITH ORDINALITY f(valor, ordem)
) WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(p.fontes) f WHERE f ? 'conteudo');
--> statement-breakpoint
UPDATE public.paginas_wiki SET estrutura = estrutura || '{"divergencias":[]}'::jsonb
WHERE NOT estrutura ? 'divergencias';
