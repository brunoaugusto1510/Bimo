/**
 * Fala com o Supabase Storage (bucket de Fontes).
 *
 * Nada aqui sabe o que é uma "Fonte" — isso fica em `fontes.ts`. Aqui só
 * existem bucket, caminho e bytes, o mesmo papel que `github.ts` tem para o
 * GitHub: um cliente fino, sem lógica de domínio.
 */

import { createClient } from "@supabase/supabase-js";

export type ConfigStorage = {
  url: string;
  chaveServico: string;
};

/** Bucket único onde todas as Fontes são gravadas, organizadas por `userId/`. */
const NOME_BUCKET_FONTES = "fontes";

/**
 * Lê as variáveis de ambiente uma única vez e falha com uma mensagem clara
 * se algo estiver faltando — mesmo padrão de `getGitHubConfig`.
 */
export function getConfigStorage(): ConfigStorage {
  const url = process.env.SUPABASE_URL;
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("SUPABASE_URL não está definido. Veja .env.example.");
  }
  if (!chaveServico) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não está definido. Veja .env.example.");
  }

  return { url, chaveServico };
}

/**
 * A service role key ignora RLS/policies de Storage — é o mesmo nível de
 * confiança que `GITHUB_TOKEN` tem hoje: só usada no servidor, nunca chega
 * ao cliente.
 */
function obterCliente(cfg: ConfigStorage) {
  return createClient(cfg.url, cfg.chaveServico, { auth: { persistSession: false } });
}

/**
 * Envia os bytes de um arquivo pro bucket de Fontes.
 *
 * `upsert: false` é deliberado: Fonte é imutável (Decisão 1 do Architecture
 * Audit) — uma reingestão deve gerar um caminho novo, nunca sobrescrever.
 */
export async function enviarArquivo(
  cfg: ConfigStorage,
  caminho: string,
  dados: Buffer,
  tipoMime?: string,
): Promise<void> {
  const { error } = await obterCliente(cfg)
    .storage.from(NOME_BUCKET_FONTES)
    .upload(caminho, dados, { contentType: tipoMime, upsert: false });

  if (error) {
    throw new Error(`Falha ao enviar arquivo para o Storage (${caminho}): ${error.message}`);
  }
}

/** Baixa os bytes de um arquivo do bucket de Fontes. */
export async function baixarArquivo(cfg: ConfigStorage, caminho: string): Promise<Buffer> {
  const { data, error } = await obterCliente(cfg)
    .storage.from(NOME_BUCKET_FONTES)
    .download(caminho);

  if (error) {
    throw new Error(`Falha ao baixar arquivo do Storage (${caminho}): ${error.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Remove um arquivo do bucket de Fontes.
 *
 * Não existe "editar" — só usada como compensação por `criarFonte` quando o
 * insert no banco falha depois do upload já ter ido (evita blob órfão).
 */
export async function removerArquivo(cfg: ConfigStorage, caminho: string): Promise<void> {
  const { error } = await obterCliente(cfg).storage.from(NOME_BUCKET_FONTES).remove([caminho]);

  if (error) {
    throw new Error(`Falha ao remover arquivo do Storage (${caminho}): ${error.message}`);
  }
}
