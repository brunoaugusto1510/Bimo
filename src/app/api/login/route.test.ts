import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { esquecerTudo } from "@/lib/limite-de-tentativas";
import { gerarHashDeSenha } from "@/lib/senha";
import { NOME_DO_COOKIE, verificarTokenDeSessao } from "@/lib/sessao";
import { POST } from "./route";

const SENHA = "senha-de-teste";
const SEGREDO = "um-segredo-de-testes-com-mais-de-32-caracteres";

/** Cada caso usa um IP próprio: o freio de tentativas é contado por IP. */
function requisicao(corpo: unknown, ip = "203.0.113.1"): Request {
  return new Request("http://localhost/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(corpo),
  });
}

/** Extrai o valor do cookie de sessão do cabeçalho Set-Cookie. */
function tokenDoSetCookie(resposta: Response): string | undefined {
  const cabecalho = resposta.headers.get("set-cookie");
  return cabecalho?.match(new RegExp(`${NOME_DO_COOKIE}=([^;]*)`))?.[1];
}

beforeEach(() => {
  esquecerTudo();
  process.env.SENHA_HASH = gerarHashDeSenha(SENHA);
  process.env.SEGREDO_SESSAO = SEGREDO;
});

afterEach(() => {
  delete process.env.SENHA_HASH;
  delete process.env.SEGREDO_SESSAO;
});

describe("POST /api/login", () => {
  it("aceita a senha certa e devolve um cookie de sessão válido", async () => {
    const res = await POST(requisicao({ senha: SENHA }));

    expect(res.status).toBe(200);

    const token = tokenDoSetCookie(res);
    expect(token).toBeDefined();
    expect(verificarTokenDeSessao(token)).toEqual({ tipo: "valida" });
  });

  it("marca o cookie como HttpOnly", async () => {
    const res = await POST(requisicao({ senha: SENHA }));
    expect(res.headers.get("set-cookie")?.toLowerCase()).toContain("httponly");
  });

  it("recusa a senha errada com 401 e sem cookie", async () => {
    const res = await POST(requisicao({ senha: "errada" }));

    expect(res.status).toBe(401);
    expect(tokenDoSetCookie(res)).toBeUndefined();
  });

  it("nunca devolve a senha nem o hash no corpo da resposta", async () => {
    const hash = process.env.SENHA_HASH as string;
    const corpo = await (await POST(requisicao({ senha: "errada" }))).text();

    expect(corpo).not.toContain(SENHA);
    expect(corpo).not.toContain(hash);
  });

  it("devolve 400 quando o corpo não é JSON válido", async () => {
    const req = new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "isso não é json",
    });

    expect((await POST(req)).status).toBe(400);
  });

  it("devolve 400 quando falta o campo 'senha'", async () => {
    expect((await POST(requisicao({}))).status).toBe(400);
  });

  it("devolve 400 quando 'senha' não é string", async () => {
    expect((await POST(requisicao({ senha: 123 }))).status).toBe(400);
  });

  it("bloqueia com 429 depois de 5 senhas erradas do mesmo IP", async () => {
    const ip = "203.0.113.2";
    for (let i = 0; i < 5; i++) await POST(requisicao({ senha: "errada" }, ip));

    const res = await POST(requisicao({ senha: "errada" }, ip));

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("bloqueia mesmo com a senha certa, para o freio não ser contornável", async () => {
    const ip = "203.0.113.3";
    for (let i = 0; i < 5; i++) await POST(requisicao({ senha: "errada" }, ip));

    const res = await POST(requisicao({ senha: SENHA }, ip));

    expect(res.status).toBe(429);
    expect(tokenDoSetCookie(res)).toBeUndefined();
  });

  it("não pune um IP pelas tentativas de outro", async () => {
    for (let i = 0; i < 5; i++) {
      await POST(requisicao({ senha: "errada" }, "203.0.113.4"));
    }

    const res = await POST(requisicao({ senha: SENHA }, "203.0.113.5"));

    expect(res.status).toBe(200);
  });

  it("zera o contador depois de um login certo", async () => {
    const ip = "203.0.113.6";
    for (let i = 0; i < 4; i++) await POST(requisicao({ senha: "errada" }, ip));

    await POST(requisicao({ senha: SENHA }, ip));
    for (let i = 0; i < 4; i++) await POST(requisicao({ senha: "errada" }, ip));

    // Se o acerto não tivesse zerado, a 8ª falha já teria estourado o limite.
    expect((await POST(requisicao({ senha: SENHA }, ip))).status).toBe(200);
  });

  it("devolve 503 quando SENHA_HASH não está configurada", async () => {
    delete process.env.SENHA_HASH;

    expect((await POST(requisicao({ senha: SENHA }))).status).toBe(503);
  });

  it("devolve 503 (não 401) quando a senha está certa mas falta SEGREDO_SESSAO", async () => {
    delete process.env.SEGREDO_SESSAO;

    const res = await POST(requisicao({ senha: SENHA }));

    // Dizer "senha incorreta" aqui mandaria você caçar o problema no lugar errado.
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      erro: expect.stringContaining("SEGREDO_SESSAO"),
    });
  });
});
