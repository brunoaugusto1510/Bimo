import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { respostaDeDesafio, verificarCredenciais } from "./autenticacao";

/**
 * As variáveis de ambiente são lidas dentro da função (e não no topo do
 * módulo), então cada teste pode reconfigurá-las sem precisar reimportar nada.
 */
const USUARIO = "bruno";
const SENHA = "senha-secreta";

function pedidoCom(cabecalho?: string): Request {
  return new Request("https://bimo.local/", {
    headers: cabecalho ? { authorization: cabecalho } : {},
  });
}

/** Monta um header Basic válido, com o mesmo UTF-8 que o navegador usaria. */
function basic(usuario: string, senha: string): string {
  const bytes = new TextEncoder().encode(`${usuario}:${senha}`);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `Basic ${base64}`;
}

describe("verificarCredenciais", () => {
  beforeEach(() => {
    process.env.BASIC_USER = USUARIO;
    process.env.BASIC_PASS = SENHA;
  });

  afterEach(() => {
    delete process.env.BASIC_USER;
    delete process.env.BASIC_PASS;
  });

  it("aceita as credenciais corretas", () => {
    expect(verificarCredenciais(pedidoCom(basic(USUARIO, SENHA)))).toEqual({ tipo: "ok" });
  });

  it("recusa quando não veio nenhum header Authorization", () => {
    expect(verificarCredenciais(pedidoCom())).toEqual({ tipo: "sem-credenciais" });
  });

  it("recusa a senha errada", () => {
    const resultado = verificarCredenciais(pedidoCom(basic(USUARIO, "senha-errada")));
    expect(resultado).toEqual({ tipo: "credenciais-invalidas" });
  });

  it("recusa o usuário errado", () => {
    const resultado = verificarCredenciais(pedidoCom(basic("outro", SENHA)));
    expect(resultado).toEqual({ tipo: "credenciais-invalidas" });
  });

  it("recusa um esquema que não seja Basic", () => {
    const resultado = verificarCredenciais(pedidoCom("Bearer um-token-qualquer"));
    expect(resultado).toEqual({ tipo: "credenciais-invalidas" });
  });

  it("recusa base64 inválido sem estourar exceção", () => {
    const resultado = verificarCredenciais(pedidoCom("Basic !!!nao-e-base64!!!"));
    expect(resultado).toEqual({ tipo: "credenciais-invalidas" });
  });

  it("recusa quando falta o separador ':' dentro do base64", () => {
    const resultado = verificarCredenciais(pedidoCom(`Basic ${btoa("semdoispontos")}`));
    expect(resultado).toEqual({ tipo: "credenciais-invalidas" });
  });

  it("aceita senha com acento (o navegador manda UTF-8)", () => {
    process.env.BASIC_PASS = "sençã-ção";
    const resultado = verificarCredenciais(pedidoCom(basic(USUARIO, "sençã-ção")));
    expect(resultado).toEqual({ tipo: "ok" });
  });

  it("aceita senha que contém ':' (só o primeiro separa usuário de senha)", () => {
    process.env.BASIC_PASS = "a:b:c";
    const resultado = verificarCredenciais(pedidoCom(basic(USUARIO, "a:b:c")));
    expect(resultado).toEqual({ tipo: "ok" });
  });

  it("recusa qualquer acesso quando as variáveis não estão configuradas", () => {
    delete process.env.BASIC_USER;
    delete process.env.BASIC_PASS;

    const resultado = verificarCredenciais(pedidoCom(basic(USUARIO, SENHA)));
    expect(resultado.tipo).toBe("nao-configurado");
  });

  it("trata senha vazia como não configurada, para não liberar acesso sem senha", () => {
    process.env.BASIC_PASS = "";

    const resultado = verificarCredenciais(pedidoCom(basic(USUARIO, "")));
    expect(resultado.tipo).toBe("nao-configurado");
  });
});

describe("respostaDeDesafio", () => {
  it("devolve 401 com WWW-Authenticate quando faltam credenciais", () => {
    const resposta = respostaDeDesafio({ tipo: "sem-credenciais" });

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("www-authenticate")).toContain("Basic");
    expect(resposta.headers.get("www-authenticate")).toContain('realm="Bimo"');
  });

  it("devolve 401 com WWW-Authenticate quando as credenciais estão erradas", () => {
    const resposta = respostaDeDesafio({ tipo: "credenciais-invalidas" });

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("www-authenticate")).toContain("Basic");
  });

  it("devolve 503 sem desafio quando o app está mal configurado", async () => {
    const resposta = respostaDeDesafio({ tipo: "nao-configurado", mensagem: "faltou env" });

    expect(resposta.status).toBe(503);
    // Sem desafio: pedir senha não resolveria um problema de configuração.
    expect(resposta.headers.get("www-authenticate")).toBeNull();
    await expect(resposta.text()).resolves.toContain("faltou env");
  });

  it("não vaza a senha esperada no corpo da resposta", async () => {
    process.env.BASIC_PASS = SENHA;
    const corpo = await respostaDeDesafio({ tipo: "credenciais-invalidas" }).text();

    expect(corpo).not.toContain(SENHA);
    delete process.env.BASIC_PASS;
  });
});
