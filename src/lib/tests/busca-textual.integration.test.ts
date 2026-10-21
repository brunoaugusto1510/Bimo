// Único arquivo de teste que precisa de env vars reais (DATABASE_URL,
// SUPABASE_*) — os demais são mockados e não dependem disso. `dotenv/config`
// aqui evita ter que passar `-r dotenv/config` na linha de comando toda vez.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarEntidade } from "../entidades";
import { criarNota } from "../notas";
import { buscarEntidadesPorTexto, buscarNoConhecimento, buscarNotasPorTexto } from "../busca-textual";
import { db } from "../db/cliente";
import { entidades, nos, notas } from "../db/schema";
import { getConfigStorage } from "../supabase-storage";

/**
 * Primeiro teste versionado do repo que toca o banco real (Supabase) — já
 * aprovado pelo usuário como novo padrão para funcionalidades que dependem
 * de recursos nativos do Postgres (aqui, full-text search) que não têm como
 * ser verificados de verdade com um mock.
 *
 * `describe.skipIf` pula a suíte inteira quando não há `DATABASE_URL`
 * configurada — CI/ambientes sem `.env` não quebram por causa disto.
 *
 * Não existe `removerNota`/`removerEntidade` na camada de domínio (ver
 * comentário em `entidades.ts`/`notas.ts` sobre por que), então a limpeza no
 * `afterAll` usa `db.delete` direto nas tabelas envolvidas.
 *
 * Desvio do plano original: `user_id` tem foreign key de verdade para
 * `auth.users` (ver `db/schema/auth.ts`), então um UUID "qualquer fixo"
 * violaria a constraint. Em vez disso, criamos DOIS usuários efêmeros de
 * verdade via Supabase Admin API e os removemos no `afterAll`.
 *
 * NUNCA use o `USER_ID_PADRAO` aqui: o `afterAll` apaga tudo o que pertence
 * aos usuários do teste, e usar o usuário real apagava as notas dele a cada
 * `npm test` (aconteceu). O `afterAll` ainda ignora qualquer id igual ao dele.
 *
 * `getConfigStorage()`/`createClient(...)`
 * ficam dentro do `beforeAll`, não no corpo do `describe`: `describe.skipIf`
 * só pula a *execução* de `it`/hooks, mas o corpo do `describe` roda mesmo
 * assim durante a coleta de testes — se essas chamadas estivessem aqui fora,
 * um ambiente sem `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` quebraria a
 * coleta mesmo com `DATABASE_URL` ausente, contradizendo a promessa acima.
 */
describe.skipIf(!process.env.DATABASE_URL)("busca-textual (integração real)", () => {
  let USUARIO_A: string;
  let USUARIO_B: string;
  let supabaseAdmin: ReturnType<typeof createClient>;
  const idsParaLimpar: number[] = [];

  let notaComTituloA: Awaited<ReturnType<typeof criarNota>>;
  let notaComCorpoA: Awaited<ReturnType<typeof criarNota>>;
  let entidadeA: Awaited<ReturnType<typeof criarEntidade>>;
  let notaB: Awaited<ReturnType<typeof criarNota>>;
  let entidadeB: Awaited<ReturnType<typeof criarEntidade>>;

  /** O usuário real do app. O `afterAll` apaga tudo o que pertence aos usuários do teste, então este nunca pode ser um deles. */
  const usuarioReal = () => process.env.USER_ID_PADRAO?.trim().toLowerCase();

  async function criarUsuarioEfemero(rotulo: string): Promise<string> {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: `busca-textual-teste-${rotulo}-${Date.now()}@teste.bimo.local`,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Falha ao criar usuário de teste efêmero: ${error?.message}`);
    }
    if (data.user.id.toLowerCase() === usuarioReal()) {
      throw new Error("O usuário efêmero não pode ser o USER_ID_PADRAO.");
    }
    return data.user.id;
  }

  beforeAll(async () => {
    const { url, chaveServico } = getConfigStorage();
    supabaseAdmin = createClient(url, chaveServico);

    // Os DOIS usuários são efêmeros (removidos no afterAll). Este teste nunca toca no USER_ID_PADRAO.
    USUARIO_A = await criarUsuarioEfemero("a");
    USUARIO_B = await criarUsuarioEfemero("b");

    // Match no título (peso A) — deve ranquear acima do match só no corpo (peso C).
    notaComTituloA = await criarNota({
      userId: USUARIO_A,
      titulo: "Análise de código",
      conteudo: "Discussão sobre a reunião de ontem, sem relação com o assunto do título.",
      criadoPor: "usuario",
    });
    idsParaLimpar.push(notaComTituloA.id);

    // Match só no corpo, plural — testa stemming (código/códigos) e ranking mais baixo.
    notaComCorpoA = await criarNota({
      userId: USUARIO_A,
      titulo: "Outra nota qualquer",
      conteudo: "Este texto menciona códigos e reuniões apenas no corpo, não no título.",
      criadoPor: "usuario",
    });
    idsParaLimpar.push(notaComCorpoA.id);

    entidadeA = await criarEntidade({
      userId: USUARIO_A,
      nome: "Reunião de Análise",
      tipo: "evento",
      aliases: ["Reunião de Códigos"],
      criadoPor: "usuario",
    });
    idsParaLimpar.push(entidadeA.id);

    // Dados do Usuário B — nunca devem aparecer nas buscas do Usuário A.
    notaB = await criarNota({
      userId: USUARIO_B,
      titulo: "Análise de código do usuário B",
      conteudo: "Reunião e análise que pertencem só ao usuário B.",
      criadoPor: "usuario",
    });
    idsParaLimpar.push(notaB.id);

    entidadeB = await criarEntidade({
      userId: USUARIO_B,
      nome: "Reunião do usuário B",
      tipo: "evento",
      criadoPor: "usuario",
    });
    idsParaLimpar.push(entidadeB.id);
  });

  afterAll(async () => {
    // Cada passo é independente e não deve interromper os seguintes: se o
    // `beforeAll` falhou no meio (ex.: USUARIO_B nunca foi atribuído) ou um
    // delete específico der erro, ainda queremos tentar limpar o resto —
    // deixar lixo pra trás é pior num projeto pessoal com um Supabase real
    // compartilhado do que logar um aviso e seguir.
    // Só os usuários efêmeros deste teste, e nunca o usuário real: se por algum motivo um id
    // coincidir com o USER_ID_PADRAO, ele é ignorado em vez de ter as notas apagadas.
    const usuarios = [USUARIO_A, USUARIO_B].filter(
      (id): id is string => Boolean(id) && id.toLowerCase() !== usuarioReal(),
    );
    const passos: Array<[string, () => Promise<unknown>]> = [
      ...usuarios.flatMap((id, i): Array<[string, () => Promise<unknown>]> => [
        [`notas do usuário efêmero ${i + 1}`, () => db.delete(notas).where(eq(notas.userId, id))],
        [`entidades do usuário efêmero ${i + 1}`, () => db.delete(entidades).where(eq(entidades.userId, id))],
      ]),
      ...idsParaLimpar.map(
        (id): [string, () => Promise<unknown>] => [`nó ${id}`, () => db.delete(nos).where(eq(nos.id, id))],
      ),
      ...usuarios.map((id, i): [string, () => Promise<unknown>] => [
        `usuário efêmero ${i + 1} (Supabase Auth)`,
        () => supabaseAdmin.auth.admin.deleteUser(id),
      ]),
    ];

    for (const [descricao, passo] of passos) {
      try {
        await passo();
      } catch (erro) {
        console.warn(`Falha ao limpar ${descricao} no afterAll:`, erro);
      }
    }
  });

  it("acha conteúdo acentuado buscando sem acento", async () => {
    const resultado = await buscarNotasPorTexto(USUARIO_A, "analise");

    const ids = resultado.map((r) => r.id);
    expect(ids).toContain(notaComTituloA.id);
  });

  it("faz stemming: busca no singular acha conteúdo no plural", async () => {
    const resultado = await buscarNotasPorTexto(USUARIO_A, "codigo");

    const ids = resultado.map((r) => r.id);
    expect(ids).toContain(notaComTituloA.id); // "código" no título
    expect(ids).toContain(notaComCorpoA.id); // "códigos" (plural) no corpo
  });

  it("ranqueia nota com match no título acima da que só tem match no corpo", async () => {
    const resultado = await buscarNotasPorTexto(USUARIO_A, "codigo");

    const posicaoTitulo = resultado.findIndex((r) => r.id === notaComTituloA.id);
    const posicaoCorpo = resultado.findIndex((r) => r.id === notaComCorpoA.id);

    expect(posicaoTitulo).toBeGreaterThanOrEqual(0);
    expect(posicaoCorpo).toBeGreaterThanOrEqual(0);
    expect(posicaoTitulo).toBeLessThan(posicaoCorpo);
    expect(resultado[posicaoTitulo].pontuacao).toBeGreaterThan(resultado[posicaoCorpo].pontuacao);
  });

  it("isola por usuário: nota/entidade do Usuário B nunca aparece na busca do Usuário A", async () => {
    const resultadoNotas = await buscarNotasPorTexto(USUARIO_A, "analise");
    const resultadoEntidades = await buscarEntidadesPorTexto(USUARIO_A, "reuniao");

    expect(resultadoNotas.map((r) => r.id)).not.toContain(notaB.id);
    expect(resultadoEntidades.map((r) => r.id)).not.toContain(entidadeB.id);
  });

  it("devolve trecho com ** ao redor do termo e sem HTML", async () => {
    const resultado = await buscarNotasPorTexto(USUARIO_A, "reuniao");

    const notaEncontrada = resultado.find((r) => r.id === notaComTituloA.id);
    expect(notaEncontrada).toBeDefined();
    expect(notaEncontrada!.trecho).toMatch(/\*\*[^*]+\*\*/);
    expect(notaEncontrada!.trecho).not.toMatch(/<[^>]+>/);
  });

  it("buscarEntidadesPorTexto acha por nome e alias, sem trecho", async () => {
    const resultado = await buscarEntidadesPorTexto(USUARIO_A, "reuniao");

    const encontrada = resultado.find((r) => r.id === entidadeA.id);
    expect(encontrada).toBeDefined();
    expect(encontrada).not.toHaveProperty("trecho");
    expect(encontrada!.aliases).toContain("Reunião de Códigos");
  });

  it("buscarNoConhecimento devolve notas e entidades separados (não achatado)", async () => {
    const resultado = await buscarNoConhecimento(USUARIO_A, "analise");

    expect(resultado).toHaveProperty("notas");
    expect(resultado).toHaveProperty("entidades");
    expect(resultado.notas.map((r) => r.id)).toContain(notaComTituloA.id);
  });
});
