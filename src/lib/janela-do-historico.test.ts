import { describe, expect, it } from "vitest";
import { janelaParaOAgente } from "./janela-do-historico";

type M = { papel: "usuario" | "agente"; conteudo: string };
const usuario = (conteudo: string): M => ({ papel: "usuario", conteudo });
const agente = (conteudo: string): M => ({ papel: "agente", conteudo });

describe("janelaParaOAgente", () => {
  it("devolve a conversa inteira quando cabe", () => {
    const conversa = [usuario("a"), agente("b"), usuario("c")];

    expect(janelaParaOAgente(conversa)).toEqual(conversa);
  });

  it("guarda só as 40 últimas e começa numa pergunta da pessoa", () => {
    const conversa = Array.from({ length: 61 }, (_, i) => (i % 2 === 0 ? usuario(`p${i}`) : agente(`r${i}`)));

    const janela = janelaParaOAgente(conversa);

    // As últimas 40 começam em r21 (agente): sai a resposta órfã e sobram 39.
    expect(janela).toHaveLength(39);
    expect(janela[0]).toEqual(usuario("p22"));
    expect(janela.at(-1)).toEqual(usuario("p60"));
  });

  it("respeita o limite de 80 mil caracteres, sempre mantendo a última pergunta", () => {
    const conversa = [usuario("x".repeat(20_000)), agente("y".repeat(20_000)), usuario("z".repeat(20_000)), agente("w".repeat(20_000)), usuario("q".repeat(20_000))];

    const janela = janelaParaOAgente(conversa);

    expect(janela.reduce((total, m) => total + m.conteudo.length, 0)).toBeLessThanOrEqual(80_000);
    expect(janela.at(-1)?.conteudo).toBe("q".repeat(20_000));
  });

  it("não altera a lista original nem leva campos além de papel e conteúdo", () => {
    const original = [{ id: "1", papel: "usuario" as const, conteudo: "oi", fontes: [] }];

    expect(janelaParaOAgente(original)).toEqual([{ papel: "usuario", conteudo: "oi" }]);
    expect(original[0]).toHaveProperty("id", "1");
  });
});
