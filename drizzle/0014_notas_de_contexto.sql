ALTER TABLE "conversas" ADD COLUMN "notas_de_contexto" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "mensagens_de_conversa" ADD COLUMN "anexos" jsonb;