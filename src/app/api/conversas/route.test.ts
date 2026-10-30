import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { esquecerRepositorioDeConversasEmCache } from "@/lib/conversas";
import { NOME_DO_COOKIE, criarTokenDeSessao } from "@/lib/sessao";
import { GET as listar } from "./route";
import { DELETE as excluir, GET as abrir, POST as acrescentar } from "./[id]/route";


const SEGREDO = "um-segredo-de-testes-com-mais-de-32-caracteres";
const URL_BASE = "http://localhost/api/conversas";

function cabecalhos(autenticado = true): Record<string, string> {
  return { "Content-Type": "application/json", ...(autenticado ? { cookie: `${NOME_DO_COOKIE}=${criarTokenDeSessao()}` } : {}) };
}

const contexto = (id: string) => ({ params: Promise.resolve({ id }) });

function envio(id: string, mensagens: unknown, extras: RequestInit = {}) {
  return acrescentar(
    new Request(`${URL_BASE}/${id}`, { method: "POST", headers: cabecalhos(), body: JSON.stringify({ mensagens }), ...extras }),
    contexto(id),
  );
}

const pergunta = (texto = "O que sei sobre TCP?") => ({ id: randomUUID(), papel: "usuario", conteudo: texto });

beforeEach(() => {
  process.env.SEGREDO_SESSAO = SEGREDO;
  vi.stubEnv("NOTAS_FONTE", "memoria");
  esquecerRepositorioDeConversasEmCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.SEGREDO_SESSAO;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  esquecerRepositorioDeConversasEmCache();
});

describe("/api/conversas", () => {
  it("guarda mensagens, lista a conversa e a reabre com as mensagens", async () => {
    const id = randomUUID();
    const primeira = pergunta();

    const guardada = await envio(id, [primeira]);
    const lista = await listar(new Request(URL_BASE, { headers: cabecalhos() }));
    const aberta = await abrir(new Request(`${URL_BASE}/${id}`, { headers: cabecalhos() }), contexto(id));

    expect(guardada.status).toBe(200);
    expect((await guardada.json()).conversa).toMatchObject({ id, titulo: "O que sei sobre TCP?" });
    expect(lista.headers.get("Cache-Control")).toBe("no-store");
    expect((await lista.json()).conversas).toEqual([expect.objectContaining({ id })]);
    expect((await aberta.json()).mensagens).toEqual([primeira]);
  });

  it("reenviar a mesma mensagem não duplica", async () => {
    const id = randomUUID();
    const primeira = pergunta();

    await envio(id, [primeira]);
    await envio(id, [primeira]);
    const aberta = await abrir(new Request(`${URL_BASE}/${id}`, { headers: cabecalhos() }), contexto(id));

    expect((await aberta.json()).mensagens).toHaveLength(1);
  });

  it("exclui a conversa; excluir de novo dá 404", async () => {
    const id = randomUUID();
    await envio(id, [pergunta()]);
    const pedido = () => new Request(`${URL_BASE}/${id}`, { method: "DELETE", headers: cabecalhos() });

    expect((await excluir(pedido(), contexto(id))).status).toBe(204);
    expect((await excluir(pedido(), contexto(id))).status).toBe(404);
    expect((await abrir(new Request(`${URL_BASE}/${id}`, { headers: cabecalhos() }), contexto(id))).status).toBe(404);
  });

  it("exige sessão em todas as rotas", async () => {
    const id = randomUUID();
    const semCookie = { headers: cabecalhos(false) };

    const respostas = await Promise.all([
      listar(new Request(URL_BASE, semCookie)),
      abrir(new Request(`${URL_BASE}/${id}`, semCookie), contexto(id)),
      excluir(new Request(`${URL_BASE}/${id}`, { method: "DELETE", ...semCookie }), contexto(id)),
      envio(id, [pergunta()], { headers: cabecalhos(false) }),
    ]);

    expect(respostas.map((r) => r.status)).toEqual([401, 401, 401, 401]);
  });

  it("recusa escrita vinda de outra origem", async () => {
    const id = randomUUID();

    const resposta = await envio(id, [pergunta()], { headers: { ...cabecalhos(), origin: "http://outro-site.com" } });
    const exclusao = await excluir(new Request(`${URL_BASE}/${id}`, { method: "DELETE", headers: { ...cabecalhos(), origin: "http://outro-site.com" } }), contexto(id));

    expect(resposta.status).toBe(403);
    expect(exclusao.status).toBe(403);
  });

  it.each([
    ["mensagem vazia", [{ id: randomUUID(), papel: "usuario", conteudo: "" }]],
    ["mensagem só com espaços", [{ id: randomUUID(), papel: "usuario", conteudo: "   " }]],
    ["papel inventado", [{ id: randomUUID(), papel: "sistema", conteudo: "oi" }]],
    ["id que não é uuid", [{ id: "1", papel: "usuario", conteudo: "oi" }]],
    ["lista vazia", []],
    ["mensagens demais", Array.from({ length: 11 }, () => pergunta())],
    ["conteúdo enorme", [{ id: randomUUID(), papel: "usuario", conteudo: "x".repeat(20_001) }]],
  ])("responde 400 para %s", async (_nome, mensagens) => {
    expect((await envio(randomUUID(), mensagens)).status).toBe(400);
  });

  it("responde 400 para um id de conversa que não é uuid", async () => {
    const resposta = await abrir(new Request(`${URL_BASE}/abc`, { headers: cabecalhos() }), contexto("abc"));

    expect(resposta.status).toBe(400);
  });

  it("não guarda os argumentos das ferramentas, só o caminho", async () => {
    const id = randomUUID();
    await envio(id, [{
      id: randomUUID(), papel: "agente", conteudo: "Criei.",
      ferramentas: [{ nome: "criar_nota", resumo: "Criou Redes/TCP", argumentos: { caminho: "Redes/TCP", conteudo: "texto privado da nota" }, notaId: "7" }],
    }]);

    const aberta = await abrir(new Request(`${URL_BASE}/${id}`, { headers: cabecalhos() }), contexto(id));

    const { mensagens } = await aberta.json();
    expect(mensagens[0].ferramentas[0].argumentos).toEqual({ caminho: "Redes/TCP" });
    expect(JSON.stringify(mensagens)).not.toContain("texto privado");
  });

  it("devolve 503 explicando a configuração quando o banco não está configurado", async () => {
    vi.stubEnv("NOTAS_FONTE", "banco");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("USER_ID_PADRAO", "");

    const resposta = await listar(new Request(URL_BASE, { headers: cabecalhos() }));

    expect(resposta.status).toBe(503);
    expect((await resposta.json()).variaveis).toEqual(expect.arrayContaining(["DATABASE_URL"]));
  });
});
