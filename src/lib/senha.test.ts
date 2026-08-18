import { afterEach, describe, expect, it } from "vitest";
import { gerarHashDeSenha, verificarSenha } from "./senha";

const SENHA = "minha-senha-de-teste";

describe("senha", () => {
  afterEach(() => {
    delete process.env.SENHA_HASH;
  });

  it("aceita a senha que gerou o hash", () => {
    process.env.SENHA_HASH = gerarHashDeSenha(SENHA);
    expect(verificarSenha(SENHA)).toEqual({ tipo: "ok" });
  });

  it("recusa senha errada", () => {
    process.env.SENHA_HASH = gerarHashDeSenha(SENHA);
    expect(verificarSenha("outra-senha")).toEqual({ tipo: "incorreta" });
  });

  it("recusa senha vazia", () => {
    process.env.SENHA_HASH = gerarHashDeSenha(SENHA);
    expect(verificarSenha("")).toEqual({ tipo: "incorreta" });
  });

  it("gera hashes diferentes para a mesma senha (sal aleatório)", () => {
    expect(gerarHashDeSenha(SENHA)).not.toBe(gerarHashDeSenha(SENHA));
  });

  it("nunca guarda a senha em claro dentro do hash", () => {
    expect(gerarHashDeSenha(SENHA)).not.toContain(SENHA);
  });

  /*
   * Regressão: com `$` o hash chegava truncado em "scrypt" em desenvolvimento,
   * porque o @next/env passa o .env.local por dotenv-expand e `$algo` virava
   * referência de variável. Na Vercel funcionava, o que tornava a falha ainda
   * mais confusa. O separador não pode voltar a ser `$`.
   */
  it("não usa '$' no formato, que o dotenv-expand comeria no .env.local", () => {
    expect(gerarHashDeSenha(SENHA)).not.toContain("$");
  });

  it("aceita senha com acento", () => {
    process.env.SENHA_HASH = gerarHashDeSenha("sençã-ção");
    expect(verificarSenha("sençã-ção")).toEqual({ tipo: "ok" });
  });

  /*
   * Guarda contra divergência: este hash foi gerado com os mesmos parâmetros de
   * scripts/gerar-senha.mjs (sal de 16 bytes, chave de 32, scrypt padrão). Se
   * qualquer um dos dois lados mudar de parâmetro, este teste quebra.
   */
  it("aceita um hash gerado com os mesmos parâmetros do script", () => {
    process.env.SENHA_HASH =
      "scrypt:0011223344556677889900aabbccddee:" +
      "787130701af6fad971d7762c8adb51b230eea3047469506bfbec17d10edcd91d";

    expect(verificarSenha("senha-do-fixture")).toEqual({ tipo: "ok" });
  });

  it("recusa tudo quando SENHA_HASH não está definida", () => {
    expect(verificarSenha(SENHA).tipo).toBe("nao-configurado");
  });

  it("recusa tudo quando SENHA_HASH está num formato desconhecido", () => {
    process.env.SENHA_HASH = "isso-nao-e-um-hash";
    expect(verificarSenha(SENHA).tipo).toBe("nao-configurado");
  });

  it("recusa tudo quando SENHA_HASH usa um algoritmo que não reconhecemos", () => {
    process.env.SENHA_HASH = "md5:sal:hash";
    expect(verificarSenha(SENHA).tipo).toBe("nao-configurado");
  });
});
