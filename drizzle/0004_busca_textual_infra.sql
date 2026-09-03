CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TEXT SEARCH CONFIGURATION public.portugues_sem_acento (COPY = pg_catalog.portuguese);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TEXT SEARCH CONFIGURATION public.portugues_sem_acento
  ALTER MAPPING FOR word, hword, hword_part WITH unaccent, portuguese_stem;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.texto_de_lista(lista text[])
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT coalesce(array_to_string(lista, ' '), '') $$;
