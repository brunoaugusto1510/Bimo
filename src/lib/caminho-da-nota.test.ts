import { describe, expect, it } from "vitest";
import {
  adotarGrafiaDaPasta,
  dividirCaminho,
  grupoDaPasta,
  juntarCaminho,
  normalizarPasta,
  normalizarTexto,
  profundidadeDaPasta,
  validarTitulo,
} from "./caminho-da-nota";

describe("normalizarTexto", () => {
  it("tira acentos e diferença de maiúsculas", () => {
    expect(normalizarTexto("Álgebra Linear")).toBe("algebra linear");
  });
});

describe("validarTitulo", () => {
  it("aceita um título comum e apara as pontas", () => {
    expect(validarTitulo("  Ler é uma conversa ")).toEqual({ ok: true, titulo: "Ler é uma conversa" });
  });

  it("recusa título vazio ou só de espaços", () => {
    expect(validarTitulo("   ")).toMatchObject({ ok: false });
    expect(validarTitulo("")).toMatchObject({ ok: false });
  });

  it("recusa título acima de 200 caracteres", () => {
    expect(validarTitulo("a".repeat(200))).toMatchObject({ ok: true });
    expect(validarTitulo("a".repeat(201))).toMatchObject({ ok: false });
  });

  it.each(["A/B", "A\\B", "A[B", "A]B", "A#B", "A^B", "A|B", "A\nB", "A\u0000B"])(
    "recusa o caractere que quebra ligações ou caminhos em %j",
    (titulo) => {
      expect(validarTitulo(titulo)).toMatchObject({ ok: false });
    },
  );

  it.each(["Receita.md", "Receita.MD", "Foto.png", "Relatório.pdf"])(
    "recusa %j: nenhuma ligação [[...]] chegaria a esta nota",
    (titulo) => {
      expect(validarTitulo(titulo)).toMatchObject({ ok: false });
    },
  );

  it("aceita pontos que não são extensão de arquivo", () => {
    expect(validarTitulo("Versão 1.5")).toMatchObject({ ok: true });
    expect(validarTitulo("Dr. Silva")).toMatchObject({ ok: true });
  });

  it("explica o motivo da recusa", () => {
    const resultado = validarTitulo("A/B");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toMatch(/não pode conter/i);
  });
});

describe("normalizarPasta", () => {
  it("devolve null para raiz, vazio ou ausente", () => {
    expect(normalizarPasta(null)).toBeNull();
    expect(normalizarPasta(undefined)).toBeNull();
    expect(normalizarPasta("")).toBeNull();
    expect(normalizarPasta("  /  ")).toBeNull();
  });

  it("apara cada segmento e as barras das pontas", () => {
    expect(normalizarPasta("/ Faculdade / Redes /")).toBe("Faculdade/Redes");
  });

  it("junta barras duplicadas e converte barra invertida", () => {
    expect(normalizarPasta("A//B\\C")).toBe("A/B/C");
  });

  it("descarta segmentos . e .., que não têm sentido numa pasta organizacional", () => {
    expect(normalizarPasta("../A/./B/..")).toBe("A/B");
    expect(normalizarPasta("..")).toBeNull();
  });
});

describe("adotarGrafiaDaPasta", () => {
  it("usa a grafia da pasta que já existe, ignorando a caixa", () => {
    expect(adotarGrafiaDaPasta("projetos", ["Projetos"])).toBe("Projetos");
  });

  it("adota a grafia segmento a segmento, inclusive de pastas intermediárias", () => {
    const existentes = ["Projetos/Web", null];

    expect(adotarGrafiaDaPasta("projetos/api", existentes)).toBe("Projetos/api");
    expect(adotarGrafiaDaPasta("PROJETOS/web", existentes)).toBe("Projetos/Web");
  });

  it("mantém a grafia pedida quando a pasta é nova, e a raiz continua raiz", () => {
    expect(adotarGrafiaDaPasta("Nova", ["Outra"])).toBe("Nova");
    expect(adotarGrafiaDaPasta(null, ["Outra"])).toBeNull();
  });
});

describe("dividirCaminho", () => {
  it("separa pasta e título tirando a extensão", () => {
    expect(dividirCaminho("Faculdade/Redes/TCP.md")).toEqual({ pasta: "Faculdade/Redes", titulo: "TCP" });
  });

  it("nota na raiz fica sem pasta", () => {
    expect(dividirCaminho("Bem-vindo.md")).toEqual({ pasta: null, titulo: "Bem-vindo" });
  });

  it("aceita caminho sem extensão", () => {
    expect(dividirCaminho("A/B")).toEqual({ pasta: "A", titulo: "B" });
  });

  it("só tira a extensão .md, não outros pontos", () => {
    expect(dividirCaminho("Versão 1.5.md")).toEqual({ pasta: null, titulo: "Versão 1.5" });
  });
});

describe("juntarCaminho", () => {
  it("monta 'Pasta/Título' e omite a pasta da raiz", () => {
    expect(juntarCaminho("A/B", "Nota")).toBe("A/B/Nota");
    expect(juntarCaminho(null, "Nota")).toBe("Nota");
  });
});

describe("grupoDaPasta e profundidadeDaPasta", () => {
  it("o grupo é a pasta de topo, ou Raiz", () => {
    expect(grupoDaPasta("Estudos/Redes")).toBe("Estudos");
    expect(grupoDaPasta("Estudos")).toBe("Estudos");
    expect(grupoDaPasta(null)).toBe("Raiz");
  });

  it("a profundidade conta os segmentos", () => {
    expect(profundidadeDaPasta(null)).toBe(0);
    expect(profundidadeDaPasta("A")).toBe(1);
    expect(profundidadeDaPasta("A/B/C")).toBe(3);
  });
});
