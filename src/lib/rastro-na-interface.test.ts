import { describe, expect, it } from "vitest";
import { encerrarRastro, iniciarRastro, registrarPasso, type PassoDoAgente, type Rastro } from "./rastro-do-agente";
import { marcasDoRastro, resumoDoRastro } from "./rastro-na-interface";

function rastroCom(passos: PassoDoAgente[], encerrado = false): Rastro {
  let rastro = iniciarRastro(0);
  passos.forEach((passo, i) => { rastro = registrarPasso(rastro, passo, (i + 1) * 100); });
  return encerrado ? encerrarRastro(rastro, 10_000) : rastro;
}

const TITULOS: Record<string, string> = { a: "TCP", b: "Handshake", c: "UDP", d: "Portas", e: "OSI", f: "IP" };
const tituloDe = (id: string) => TITULOS[id];

describe("marcasDoRastro", () => {
  it("não marca nada sem rastro", () => {
    expect(marcasDoRastro(null).size).toBe(0);
  });

  it("marca as encontradas pela busca e a nota sendo lida como ativa", () => {
    const marcas = marcasDoRastro(rastroCom([{ tipo: "busca", ids: ["a", "b", "c"] }, { tipo: "leitura", id: "a" }]));
    expect(marcas.get("a")).toEqual({ tipo: "usada", ativa: true });
    expect(marcas.get("b")).toEqual({ tipo: "candidata", ativa: false });
    expect(marcas.get("c")).toEqual({ tipo: "candidata", ativa: false });
  });

  it("só a última nota tocada fica ativa, mesmo com uma busca depois", () => {
    const marcas = marcasDoRastro(rastroCom([
      { tipo: "leitura", id: "a" },
      { tipo: "leitura", id: "b" },
      { tipo: "busca", ids: ["c"] },
    ]));
    expect(marcas.get("a")?.ativa).toBe(false);
    expect(marcas.get("b")?.ativa).toBe(true);
  });

  it("uma busca posterior não rebaixa uma nota já lida", () => {
    const marcas = marcasDoRastro(rastroCom([{ tipo: "leitura", id: "a" }, { tipo: "busca", ids: ["a", "b"] }]));
    expect(marcas.get("a")?.tipo).toBe("usada");
  });

  it("a nota criada fica nova, mesmo editada depois", () => {
    const marcas = marcasDoRastro(rastroCom([
      { tipo: "escrita", id: "n", criada: true },
      { tipo: "escrita", id: "n", criada: false },
    ]));
    expect(marcas.get("n")).toEqual({ tipo: "nova", ativa: true });
  });

  it("depois da resposta as candidatas somem e nada fica ativo", () => {
    const marcas = marcasDoRastro(rastroCom([{ tipo: "busca", ids: ["a", "b"] }, { tipo: "leitura", id: "a" }], true));
    expect(marcas.get("a")).toEqual({ tipo: "usada", ativa: false });
    expect(marcas.has("b")).toBe(false);
  });
});

describe("resumoDoRastro", () => {
  it("não resume enquanto o Bimo trabalha", () => {
    expect(resumoDoRastro(rastroCom([{ tipo: "leitura", id: "a" }]), tituloDe)).toBeNull();
    expect(resumoDoRastro(null, tituloDe)).toBeNull();
  });

  it("descreve o caminho das notas lidas, sem repetir", () => {
    const rastro = rastroCom([{ tipo: "leitura", id: "a" }, { tipo: "leitura", id: "b" }, { tipo: "leitura", id: "a" }], true);
    expect(resumoDoRastro(rastro, tituloDe)).toBe("Último rastro do Bimo: TCP → Handshake");
  });

  it("abrevia um caminho longo", () => {
    const passos: PassoDoAgente[] = ["a", "b", "c", "d", "e"].map((id) => ({ tipo: "leitura", id }));
    expect(resumoDoRastro(rastroCom(passos, true), tituloDe)).toBe("Último rastro do Bimo: TCP → Handshake → UDP → Portas → …");
  });

  it("a nota criada vem antes das editadas e das lidas", () => {
    const rastro = rastroCom([
      { tipo: "leitura", id: "a" },
      { tipo: "escrita", id: "b", criada: false },
      { tipo: "escrita", id: "f", criada: true },
    ], true);
    expect(resumoDoRastro(rastro, tituloDe)).toBe("Nota nova do Bimo: IP");
  });

  it("conta a edição quando não houve criação", () => {
    const rastro = rastroCom([{ tipo: "leitura", id: "a" }, { tipo: "escrita", id: "a", criada: false }], true);
    expect(resumoDoRastro(rastro, tituloDe)).toBe("O Bimo editou: TCP");
  });

  it("ignora notas sem título conhecido e não resume uma busca sem leitura", () => {
    expect(resumoDoRastro(rastroCom([{ tipo: "leitura", id: "sumiu" }], true), tituloDe)).toBeNull();
    expect(resumoDoRastro(rastroCom([{ tipo: "busca", ids: ["a"] }], true), tituloDe)).toBeNull();
  });
});
