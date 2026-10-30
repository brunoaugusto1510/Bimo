// @vitest-environment node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, vi } from "vitest";
import { executarContratoDoRepositorioDeConversas } from "./suite-de-contrato";

vi.mock("server-only", () => ({}));

const TEM_CREDENCIAIS = Boolean(process.env.DATABASE_URL?.trim() && process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

/** A migração 0012 é um passo manual: sem ela as tabelas não existem e esta suíte avisa e pula, em vez de quebrar o `npm test`. */
async function migracaoAplicada(): Promise<boolean> {
  if (!TEM_CREDENCIAIS) return false;
  const { getConfigStorage } = await import("../supabase-storage");
  const { url, chaveServico } = getConfigStorage();
  const { error } = await createClient(url, chaveServico).from("conversas").select("id").limit(1);
  if (error) console.warn("[conversas/banco.test] Suíte pulada: aplique a migração 0012 (tabela conversas indisponível).");
  return !error;
}

/** Roda contra o banco real com usuários efêmeros — nunca o `USER_ID_PADRAO`. */
describe.skipIf(!(await migracaoAplicada()))("conversas no banco", () => {
  let admin: ReturnType<typeof createClient>;
  let criar: typeof import("./banco").criarRepositorioDeConversasDoBanco;
  const usuarios: string[] = [];

  async function novoUsuario(): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({ email: `conversas-${randomUUID()}@teste.bimo.local`, email_confirm: true });
    if (error || !data.user) throw new Error(`Falha ao criar usuário efêmero: ${error?.message}`);
    usuarios.push(data.user.id);
    return data.user.id;
  }

  beforeAll(async () => {
    ({ criarRepositorioDeConversasDoBanco: criar } = await import("./banco"));
    const { getConfigStorage } = await import("../supabase-storage");
    const { url, chaveServico } = getConfigStorage();
    admin = createClient(url, chaveServico);
  }, 30_000);

  afterAll(async () => {
    for (const usuario of usuarios) {
      const { error } = await admin.auth.admin.deleteUser(usuario);
      if (error) throw error;
    }
  }, 30_000);

  // Cada teste ganha dois usuários novos: as conversas somem com eles (ON DELETE CASCADE).
  executarContratoDoRepositorioDeConversas("banco", async () => ({
    repo: criar(await novoUsuario()),
    outraPessoa: criar(await novoUsuario()),
  }));
});
