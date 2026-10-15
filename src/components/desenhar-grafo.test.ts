import { beforeEach, describe, expect, it } from "vitest";
import type { Camera } from "@/lib/camera-do-grafo";
import { desenharQuadro, lerCores, type Cores, type NoVisual, type Quadro } from "./desenhar-grafo";

/**
 * O jsdom não tem canvas. Este contexto falso só anota o que foi desenhado — e
 * com qual estilo no momento da chamada, que é o que importa (a cor e a
 * opacidade são estado do contexto, definidos antes de cada `fill`/`stroke`).
 */
type Chamada =
  | { tipo: "preencher"; cor: unknown; alfa: number; x: number; y: number; raio: number }
  | { tipo: "tracar"; cor: unknown; alfa: number; largura: number; segmentos: number }
  | { tipo: "texto"; texto: string; cor: unknown; x: number; y: number };

function criarContextoFalso() {
  const chamadas: Chamada[] = [];
  let arco = { x: 0, y: 0, raio: 0 };
  let segmentos = 0;

  const contexto = {
    fillStyle: "" as unknown,
    strokeStyle: "" as unknown,
    globalAlpha: 1,
    lineWidth: 1,
    clearRect: () => {},
    beginPath: () => {
      segmentos = 0;
    },
    moveTo: () => {
      segmentos += 1;
    },
    lineTo: () => {},
    arc: (x: number, y: number, raio: number) => {
      arco = { x, y, raio };
    },
    fill: () => {
      chamadas.push({ tipo: "preencher", cor: contexto.fillStyle, alfa: contexto.globalAlpha, ...arco });
    },
    stroke: () => {
      chamadas.push({
        tipo: "tracar",
        cor: contexto.strokeStyle,
        alfa: contexto.globalAlpha,
        largura: contexto.lineWidth,
        segmentos,
      });
    },
    strokeText: () => {},
    fillText: (texto: string, x: number, y: number) => {
      chamadas.push({ tipo: "texto", texto, cor: contexto.fillStyle, x, y });
    },
  };

  return { contexto: contexto as unknown as CanvasRenderingContext2D, chamadas };
}

const CORES: Cores = {
  linha: "linha",
  destaque: "destaque",
  naoResolvida: "nao-resolvida",
  tag: "tag",
  texto: "texto",
  fundo: "fundo",
  fonte: "sans-serif",
  paleta: ["grupo-0", "grupo-1"],
};

const CAMERA: Camera = { x: 0, y: 0, k: 1 };

function no(id: string, x: number, y: number, extra: Partial<NoVisual> = {}): NoVisual {
  return {
    tipo: "nota",
    id,
    titulo: id.replace(".md", ""),
    grupo: "G",
    x,
    y,
    vx: 0,
    vy: 0,
    fase: 0,
    frequencia: 1,
    ...extra,
  } as NoVisual;
}

const A = no("A.md", 100, 100);
const B = no("B.md", 200, 100);
const C = no("C.md", 300, 100);
const TAG = no("tag:x", 400, 100, { tipo: "tag", titulo: "#x" } as Partial<NoVisual>);

const LINKS = [
  { source: A, target: B },
  { source: B, target: C },
];

function quadro(extra: Partial<Quadro> = {}): Quadro {
  return {
    largura: 800,
    altura: 600,
    camera: CAMERA,
    tempo: 0,
    intensidade: 1,
    interativo: true,
    notaAberta: null,
    foco: null,
    hover: null,
    nos: [A, B, C, TAG],
    links: LINKS,
    cores: CORES,
    corDoNo: (n) => (n.tipo === "tag" ? CORES.tag : CORES.paleta[0]),
    raioNaTela: () => 5,
    ...extra,
  };
}

function desenhar(extra: Partial<Quadro> = {}) {
  const { contexto, chamadas } = criarContextoFalso();
  desenharQuadro(contexto, quadro(extra));
  return chamadas;
}

const preenchimentos = (chamadas: Chamada[]) =>
  chamadas.filter((c): c is Extract<Chamada, { tipo: "preencher" }> => c.tipo === "preencher");
const tracos = (chamadas: Chamada[]) =>
  chamadas.filter((c): c is Extract<Chamada, { tipo: "tracar" }> => c.tipo === "tracar");
const textos = (chamadas: Chamada[]) =>
  chamadas.filter((c): c is Extract<Chamada, { tipo: "texto" }> => c.tipo === "texto");

describe("desenharQuadro", () => {
  it("desenha uma bolinha por nó, na posição que a câmera manda", () => {
    const bolinhas = preenchimentos(desenhar({ camera: { x: 10, y: 20, k: 2 } }));

    expect(bolinhas).toHaveLength(4);
    // A (100, 100) com k=2 e deslocamento (10, 20) cai em (210, 220).
    expect(bolinhas[0]).toMatchObject({ x: 210, y: 220, raio: 5 });
  });

  it("colore cada bolinha pelo seu grupo, e a tag pela cor das tags", () => {
    const bolinhas = preenchimentos(desenhar());

    expect(bolinhas[0].cor).toBe("grupo-0");
    expect(bolinhas[3].cor).toBe("tag");
  });

  it("desenha as linhas num caminho só por estilo (não um stroke por aresta)", () => {
    const linhas = tracos(desenhar());

    expect(linhas).toHaveLength(1);
    expect(linhas[0].segmentos).toBe(2);
  });

  it("sem seleção, não escreve nenhum rótulo", () => {
    expect(textos(desenhar())).toEqual([]);
  });

  describe("com uma nota selecionada", () => {
    const foco = { id: "B.md", vizinhos: new Set(["A.md", "C.md"]) };

    it("destaca o selecionado em azul e maior, com um anel em volta", () => {
      const chamadas = desenhar({ foco });
      const selecionado = preenchimentos(chamadas)[1];

      expect(selecionado).toMatchObject({ cor: "destaque", alfa: 1, raio: 8 });
      // O anel é um traço extra no mesmo ponto.
      expect(tracos(chamadas).some((t) => t.cor === "destaque" && t.segmentos === 0)).toBe(true);
    });

    it("mantém as vizinhas opacas e apaga o resto", () => {
      const bolinhas = preenchimentos(desenhar({ foco }));

      expect(bolinhas[0].alfa).toBe(1); // A, vizinha
      expect(bolinhas[2].alfa).toBe(1); // C, vizinha
      expect(bolinhas[3].alfa).toBeLessThan(0.5); // tag, fora do foco
    });

    it("traça as ligações da nota por cima, em azul e mais grossas", () => {
      // C–tag não toca na nota selecionada (B): é uma ligação "comum".
      const links = [...LINKS, { source: C, target: TAG }];

      const linhas = tracos(desenhar({ foco, links })).filter((t) => t.segmentos > 0);

      expect(linhas).toHaveLength(2);
      const [comum, doFoco] = linhas;
      expect(comum).toMatchObject({ cor: "linha", segmentos: 1 });
      expect(comum.alfa).toBeLessThan(0.2);
      expect(doFoco).toMatchObject({ cor: "destaque", segmentos: 2 });
      expect(doFoco.largura).toBeGreaterThan(comum.largura);
    });

    it("escreve o título do selecionado (em azul) e das vizinhas, e de mais ninguém", () => {
      const escritos = textos(desenhar({ foco }));

      expect(escritos.map((t) => t.texto).sort()).toEqual(["A", "B", "C"]);
      expect(escritos.find((t) => t.texto === "B")?.cor).toBe("destaque");
      expect(escritos.find((t) => t.texto === "A")?.cor).toBe("texto");
    });

    it("escreve o rótulo abaixo da bolinha", () => {
      const rotulo = textos(desenhar({ foco })).find((t) => t.texto === "B")!;

      expect(rotulo.x).toBe(200);
      expect(rotulo.y).toBeGreaterThan(100);
    });
  });

  it("limita os rótulos das vizinhas: um hub não vira sopa de letrinhas", () => {
    const vizinhas = Array.from({ length: 80 }, (_, i) => no(`V${i}.md`, i * 10, 0));
    const hub = no("hub.md", 0, 0);
    const foco = { id: hub.id, vizinhos: new Set(vizinhas.map((v) => v.id)) };

    const escritos = textos(desenhar({ foco, nos: [hub, ...vizinhas], links: [] }));

    // O hub (1) + no máximo 40 vizinhas.
    expect(escritos).toHaveLength(41);
  });

  it("mostra o título do nó sob o cursor, mesmo sem seleção", () => {
    const escritos = textos(desenhar({ hover: "C.md" }));

    expect(escritos.map((t) => t.texto)).toEqual(["C"]);
  });

  it("abrevia títulos longos", () => {
    const longo = no("longo.md", 0, 0, { titulo: "a".repeat(60) });

    const escritos = textos(desenhar({ hover: "longo.md", nos: [longo], links: [] }));

    expect(escritos[0].texto).toHaveLength(28);
    expect(escritos[0].texto.endsWith("…")).toBe(true);
  });

  it("apaga as notas não resolvidas, como no Obsidian", () => {
    const fantasma = no("fantasma", 0, 0, { tipo: "nao-resolvida", titulo: "?" } as Partial<NoVisual>);

    const [bolinha] = preenchimentos(desenhar({ nos: [fantasma], links: [] }));

    expect(bolinha.alfa).toBeLessThan(0.5);
  });

  describe("modo fundo (interativo = false)", () => {
    it("nunca escreve rótulos, nem com seleção ou cursor em cima", () => {
      const foco = { id: "B.md", vizinhos: new Set(["A.md"]) };

      expect(textos(desenhar({ interativo: false, foco, hover: "A.md" }))).toEqual([]);
    });

    it("destaca a nota aberta no leitor", () => {
      const bolinhas = preenchimentos(desenhar({ interativo: false, notaAberta: "B.md" }));

      expect(bolinhas[1]).toMatchObject({ cor: "destaque", alfa: 1, raio: 7 });
    });

    it("faz as bolinhas respirarem: a posição muda com o tempo", () => {
      const em = (tempo: number) =>
        preenchimentos(desenhar({ interativo: false, tempo, intensidade: 6 }))[0];

      expect(em(0)).not.toMatchObject({ x: em(1.3).x, y: em(1.3).y });
    });

    it("já o modo interativo desenha a posição exata, para o clique acertar", () => {
      const em = (tempo: number) => preenchimentos(desenhar({ interativo: true, tempo }))[0];

      expect(em(0)).toMatchObject({ x: em(1.3).x, y: em(1.3).y });
    });
  });
});

describe("lerCores", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
  });

  it("usa os valores de reserva quando o CSS não define as variáveis", () => {
    const cores = lerCores(3);

    expect(cores.destaque).toBe("#2574e0");
    expect(cores.paleta).toHaveLength(3);
  });

  it("lê as variáveis CSS do documento, para o canvas seguir o tema", () => {
    document.documentElement.style.setProperty("--destaque", "#123456");
    document.documentElement.style.setProperty("--grafo-cor-2", "#abcdef");

    const cores = lerCores(2);

    expect(cores.destaque).toBe("#123456");
    expect(cores.paleta[1]).toBe("#abcdef");
  });
});
