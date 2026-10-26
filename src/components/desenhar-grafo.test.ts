import { beforeEach, describe, expect, it } from "vitest";
import type { Camera } from "@/lib/camera-do-grafo";
import type { EstadoDoNeuronio } from "@/lib/wiki/observabilidade-tipos";
import { criarContextoFalso, preenchimentos, textos, tracos, type Chamada } from "./contexto-falso";
import { desenharQuadro, lerCores, resolverArestas, type Cores, type NoVisual, type Quadro } from "./desenhar-grafo";
import { geometriaDoNeuronio, noVisivel } from "./desenhar-neuronio";

const CORES: Cores = {
  linha: "linha",
  destaque: "destaque",
  naoResolvida: "nao-resolvida",
  tag: "tag",
  texto: "texto",
  fundo: "fundo",
  fonte: "sans-serif",
  noNeutro: "#808080",
  arestaNeutra: "#c0c0c0",
  destaqueTexto: "#6ea8f2",
  sobreDestaque: "#ffffff",
  painel: "#ffffff",
  bordaSuave: "#cfe0f8",
  destaqueSuave: "destaque-suave",
  textoSuave: "texto-suave",
  tensao: "tensao",
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
    dx: x,
    dy: y,
    progresso: 0,
    px: x,
    py: y,
    tx: x,
    ty: y,
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

describe("desenharQuadro", () => {
  it("só neurônios oculta notas e seus rótulos sem alterar suas posições", () => {
    const n = no("neuronio", 150, 150, { tipo: "nota", neuronio: true });
    const antes = { x: A.x, y: A.y };
    const chamadas = desenhar({ nos: [A, n], links: [], somenteNeuronios: true, hover: A.id });
    expect(preenchimentos(chamadas).some((c) => c.x === A.tx && c.y === A.ty)).toBe(false);
    expect(textos(chamadas).some((c) => c.texto === A.titulo)).toBe(false);
    expect({ x: A.x, y: A.y }).toEqual(antes);
  });
  it("agrupa sinapses e ligações entre neurônios e distingue a reconsolidação pela forma", () => {
    const n = no("neuronio", 150, 150, { tipo: "nota", neuronio: true });
    const outro = no("outro-neuronio", 200, 150, { tipo: "nota", neuronio: true });
    const chamadas = desenhar({ nos: [A, B, n, outro], links: [{ source: A, target: B, tipo: "notas" }, { source: A, target: n, tipo: "sinapse" }, { source: n, target: outro, tipo: "neuronios" }], estadosWiki: new Map([[n.id, "reconsolidando"]]), movimentoReduzido: true });
    const linhas = tracos(chamadas).filter((c) => c.segmentos > 0);
    expect(linhas.map((c) => c.largura)).toEqual([1, 1.6, 2.2]);
    expect(linhas.map((c) => c.cor)).toEqual([CORES.linha, CORES.destaque, CORES.destaque]);
    expect(linhas[0].alfa).toBeCloseTo(0.4);
    expect(linhas[1].alfa).toBeCloseTo(0.45);
    expect(linhas[2].alfa).toBeCloseTo(0.65);
    expect(tracos(chamadas).some((c) => c.tracejado.join(",") === "4,3")).toBe(true);
  });
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

type DadosDeAresta = { de: string; para: string; tipo: "contorno" | "sulco" | "malha" };
const resolvidas = (nos: NoVisual[], arestas: DadosDeAresta[]) =>
  resolverArestas(arestas, new Map(nos.map((n) => [n.id, n])));

describe("o cérebro", () => {
  const ARESTAS = [
    { de: "A.md", para: "B.md", tipo: "contorno" as const },
    { de: "B.md", para: "C.md", tipo: "malha" as const },
  ];
  const comProgresso = (progresso: number) =>
    [A, B, C, TAG].map((n) => ({ ...n, progresso })) as NoVisual[];
  const nosDoCerebro = comProgresso(1);
  const linksDe = (nos: NoVisual[]) => [
    { source: nos[0], target: nos[1] },
    { source: nos[1], target: nos[2] },
  ];

  it("no globo (progresso 0) não desenha nenhuma aresta do cérebro", () => {
    const linhas = tracos(desenhar({ arestasDoCerebro: resolvidas([A, B, C, TAG], ARESTAS) })).filter((t) => t.segmentos > 0);

    expect(linhas.map((t) => t.cor)).toEqual(["linha"]);
  });

  it("desenha contorno e sulco com o neutro dos nós e a malha com o neutro das arestas", () => {
    const nos = nosDoCerebro;
    const linhas = tracos(
      desenhar({ interativo: false, nos, links: linksDe(nos), arestasDoCerebro: resolvidas(nos, ARESTAS) }),
    );

    const contorno = linhas.find((t) => t.cor === "#808080");
    const malha = linhas.find((t) => t.cor === "#c0c0c0");
    expect(contorno).toMatchObject({ largura: 1.4, alfa: 0.95 });
    expect(malha).toMatchObject({ largura: 1, alfa: 0.75 });
  });

  it("as arestas aparecem com e² (e = o menor progresso das duas pontas)", () => {
    const nos = [
      { ...A, progresso: 0.5 },
      { ...B, progresso: 1 },
      C,
      TAG,
    ] as NoVisual[];

    const linhas = tracos(
      desenhar({
        interativo: false,
        nos,
        links: [],
        arestasDoCerebro: resolvidas(nos, [{ de: "A.md", para: "B.md", tipo: "contorno" }]),
      }),
    );

    // 0,5 cai exatamente no degrau 3/6: alfa = 0,95 · 0,5².
    expect(linhas[0].alfa).toBeCloseTo(0.95 * 0.25);
  });

  it("não desenha a aresta se uma das pontas ainda é globo", () => {
    const nos = [{ ...A, progresso: 1 }, B, C, TAG] as NoVisual[];

    const linhas = tracos(
      desenhar({
        interativo: false,
        nos,
        links: [],
        arestasDoCerebro: resolvidas(nos, [{ de: "A.md", para: "B.md", tipo: "contorno" }]),
      }),
    );

    expect(linhas).toHaveLength(0);
  });

  it("as ligações reais recuam a 20% da opacidade quando tudo é cérebro", () => {
    const nos = nosDoCerebro;
    const [linha] = tracos(desenhar({ interativo: false, nos, links: linksDe(nos) })).filter(
      (t) => t.cor === "linha",
    );

    expect(linha.alfa).toBeCloseTo(0.4 * 0.2);
  });

  it("a bolinha troca a cor da pasta pelo neutro do cérebro", () => {
    const cor = (progresso: number) =>
      preenchimentos(desenhar({ nos: comProgresso(progresso), links: [] }))[0].cor;

    expect(cor(0)).toBe("grupo-0");
    expect(cor(1)).toBe("#808080");
    expect(String(cor(0.5))).toContain("color-mix");
  });
});

describe("enquanto o agente trabalha", () => {
  const VAZIO = { notas: new Map(), segmentos: [], faisca: null, foco: 1, ativo: false };

  it("escurece nós e ligações que não estão no rastro", () => {
    const rastro = { ...VAZIO, foco: 0.45 };

    const chamadas = desenhar({ rastro });

    expect(preenchimentos(chamadas)[0].alfa).toBeCloseTo(0.75 * 0.45);
    expect(tracos(chamadas)[0].alfa).toBeCloseTo(0.4 * 0.45);
  });

  it("não escurece quem está no rastro", () => {
    const rastro = {
      ...VAZIO,
      foco: 0.45,
      notas: new Map([["A.md", { estado: "lida" as const, intensidade: 1, desde: 0 }]]),
    };

    const [a, b] = preenchimentos(desenhar({ rastro }));

    expect(a.alfa).toBe(1);
    expect(b.alfa).toBeCloseTo(0.75 * 0.45);
  });

  it("escurece também o desenho do cérebro", () => {
    const nos = [A, B, C, TAG].map((n) => ({ ...n, progresso: 1 })) as NoVisual[];

    const linhas = tracos(
      desenhar({
        interativo: false,
        nos,
        links: [],
        rastro: { ...VAZIO, foco: 0.5 },
        arestasDoCerebro: resolvidas(nos, [{ de: "A.md", para: "B.md", tipo: "contorno" }]),
      }),
    );

    expect(linhas[0].alfa).toBeCloseTo(0.95 * 0.5);
  });
});

describe("modo fundo com movimento reduzido", () => {
  it("não respira: a posição não muda com o tempo", () => {
    const em = (tempo: number) =>
      preenchimentos(
        desenhar({ interativo: false, tempo, intensidade: 6, movimentoReduzido: true }),
      )[0];

    expect(em(0)).toMatchObject({ x: em(1.3).x, y: em(1.3).y });
  });
});

describe("onde cada nó foi desenhado", () => {
  it("grava a posição de tela no nó, para o clique acertar", () => {
    const alvo = no("A.md", 100, 100);

    desenhar({ nos: [alvo], links: [], camera: { x: 10, y: 20, k: 2 } });

    expect(alvo).toMatchObject({ tx: 210, ty: 220, px: 100, py: 100 });
  });

  it("no modo fundo, grava também a respiração", () => {
    const alvo = no("A.md", 100, 100);

    desenhar({ nos: [alvo], links: [], interativo: false, tempo: 0, intensidade: 6 });

    expect(alvo.py).not.toBe(100);
    expect(alvo.ty).toBe(alvo.py);
  });
});

describe("posição desenhada", () => {
  it("usa dx/dy e não a posição da simulação", () => {
    const deslocado = no("A.md", 100, 100, { dx: 40, dy: 60 });

    const [bolinha] = preenchimentos(desenhar({ nos: [deslocado], links: [] }));

    expect(bolinha).toMatchObject({ x: 40, y: 60 });
  });
});

describe("neurônios", () => {
  type Forma = Exclude<Chamada, { tipo: "texto" }>;
  const neuronio = (id: string, x: number, y: number, extra: Partial<NoVisual> = {}) =>
    no(id, x, y, { neuronio: true, ...extra } as Partial<NoVisual>);
  /** O que foi preenchido ou traçado com centro no ponto (sem os rótulos). */
  const formasEm = (chamadas: Chamada[], x: number, y: number) =>
    chamadas.filter(
      (c): c is Forma => c.tipo !== "texto" && Math.abs(c.x - x) < 1e-9 && Math.abs(c.y - y) < 1e-9,
    );
  const comEstado = (estado: EstadoDoNeuronio) =>
    desenhar({ nos: [neuronio("n", 150, 150)], links: [], estadosWiki: new Map([["n", estado]]) });
  const AZUIS: unknown[] = [CORES.destaque, CORES.destaqueSuave, CORES.destaqueTexto];

  it("o vivo tem halo, anel no painel com traço azul e núcleo, nessa ordem", () => {
    const geometria = geometriaDoNeuronio(5);

    const formas = formasEm(desenhar({ nos: [neuronio("n", 150, 150)], links: [] }), 150, 150);

    expect(formas.map((c) => [c.tipo, c.cor])).toEqual([
      ["preencher", CORES.destaqueSuave],
      ["preencher", CORES.painel],
      ["tracar", CORES.destaque],
      ["preencher", CORES.destaqueTexto],
    ]);
    expect(formas[0].raio).toBeCloseTo(geometria.halo);
    expect(formas[1].raio).toBeCloseTo(geometria.anel);
    expect(formas[3].raio).toBeCloseTo(geometria.nucleo);
    expect(formas.every((c) => c.alfa === 1)).toBe(true);
    // Maior que a bolinha de uma nota (raio 5), com o halo bem maior que o anel.
    expect(geometria.anel).toBeGreaterThan(5);
    expect(geometria.halo).toBeGreaterThan(geometria.anel * 2);
  });

  it("o halo vai por baixo das bolinhas das notas, e o neurônio por cima", () => {
    const chamadas = desenhar({ nos: [neuronio("n", 150, 150), A], links: [] });
    const indice = (cor: unknown) => chamadas.findIndex((c) => c.tipo === "preencher" && c.cor === cor);

    expect(indice(CORES.destaqueSuave)).toBeLessThan(indice("grupo-0"));
    expect(indice("grupo-0")).toBeLessThan(indice(CORES.painel));
  });

  it("o selecionado cresce e ganha o sinal de seleção entre o anel e o halo", () => {
    const foco = { id: "n", vizinhos: new Set<string>() };
    const geometria = geometriaDoNeuronio(5, true);

    const formas = formasEm(desenhar({ nos: [neuronio("n", 150, 150)], links: [], foco }), 150, 150);

    expect(formas[0].raio).toBeCloseTo(geometria.halo);
    expect(geometria.anel).toBeGreaterThan(geometriaDoNeuronio(5).anel);
    const selecao = formas.find((c) => c.tipo === "tracar" && c.cor === CORES.destaqueTexto);
    expect(selecao!.raio).toBeGreaterThan(geometria.anel);
    expect(selecao!.raio).toBeLessThan(geometria.halo);
  });

  it("'seu' perde o azul: anel e núcleo na cor do texto, sem halo, e só um ponto azul fora do centro", () => {
    const chamadas = comEstado("seu");

    const formas = formasEm(chamadas, 150, 150);
    expect(formas.some((c) => AZUIS.includes(c.cor))).toBe(false);
    expect(formas.find((c) => c.tipo === "tracar")?.cor).toBe(CORES.texto);
    const ponto = preenchimentos(chamadas).find((c) => c.cor === CORES.destaqueTexto)!;
    expect(ponto.x).toBeGreaterThan(150);
    expect(ponto.y).toBeLessThan(150);
    expect(textos(chamadas)[0].cor).toBe(CORES.texto);
  });

  it("reconsolidando: halo e anel tracejados no lugar do halo cheio", () => {
    const formas = formasEm(comEstado("reconsolidando"), 150, 150);

    expect(formas.some((c) => c.tipo === "preencher" && c.cor === CORES.destaqueSuave)).toBe(false);
    expect(formas.filter((c) => c.tipo === "tracar" && c.tracejado.length > 0)).toHaveLength(2);
  });

  it("em tensão: a metade do anel na cor da tensão", () => {
    const formas = formasEm(comEstado("em_tensao"), 150, 150);

    expect(formas.some((c) => c.tipo === "preencher" && c.cor === CORES.tensao)).toBe(true);
  });

  it("sem raízes: anel cinza e tracejado, sem halo e sem nada de azul", () => {
    const chamadas = comEstado("sem_raizes");

    const formas = formasEm(chamadas, 150, 150);
    expect(formas.some((c) => AZUIS.includes(c.cor))).toBe(false);
    expect(
      formas.some((c) => c.tipo === "tracar" && c.cor === CORES.textoSuave && c.tracejado.length > 0),
    ).toBe(true);
    expect(textos(chamadas)[0].cor).toBe(CORES.texto);
  });

  it("em pausa: anel esmaecido e barras de pausa no lugar do núcleo", () => {
    const formas = formasEm(comEstado("em_pausa"), 150, 150);

    expect(formas.some((c) => c.tipo === "preencher" && c.cor === CORES.destaqueSuave)).toBe(false);
    expect(formas.find((c) => c.tipo === "tracar" && c.cor === CORES.destaque)!.alfa).toBeLessThan(1);
    // As barras (retângulos) e nenhum núcleo redondo.
    expect(formas.some((c) => c.tipo === "preencher" && c.raio === 0)).toBe(true);
    expect(formas.some((c) => c.tipo === "preencher" && c.cor === CORES.destaqueTexto && c.raio > 0)).toBe(false);
  });

  it("recém-nascido (menos de 24 h): um anel tracejado por fora do halo", () => {
    const n = neuronio("n", 150, 150, { nascidoEm: new Date().toISOString() } as Partial<NoVisual>);

    const formas = formasEm(desenhar({ nos: [n], links: [] }), 150, 150);

    const anel = formas.find((c) => c.tipo === "tracar" && c.tracejado.length > 0)!;
    expect(anel.raio).toBeGreaterThan(geometriaDoNeuronio(5).halo);
  });

  describe("nascendo", () => {
    const n = neuronio("n", 150, 150);
    const sinapse = { source: A, target: n, tipo: "sinapse" as const };
    const nascendo = (extra: Partial<Quadro> = {}) =>
      desenhar({
        nos: [A, n],
        links: [sinapse],
        nascimentos: new Map([["n", 0]]),
        ligacoesPorNo: new Map([["n", [sinapse]]]),
        tempo: 0.3,
        ...extra,
      });

    it("enquanto a sinapse cresce, só o esboço tracejado marca o lugar", () => {
      const formas = formasEm(nascendo(), 150, 150);

      expect(formas.every((c) => c.tipo === "tracar" && c.tracejado.length > 0)).toBe(true);
      expect(formas).toHaveLength(1);
    });

    it("depois das sinapses, o núcleo surge e o neurônio fica pronto", () => {
      const formas = formasEm(nascendo({ tempo: 1 }), 150, 150);

      expect(formas.map((c) => c.cor)).toContain(CORES.destaqueSuave);
      expect(formas[0].raio).toBeCloseTo(geometriaDoNeuronio(5).halo);
    });

    it("com movimento reduzido, já aparece pronto", () => {
      const formas = formasEm(nascendo({ movimentoReduzido: true }), 150, 150);

      expect(formas.map((c) => c.cor)).toContain(CORES.destaqueSuave);
    });
  });

  it("a ligação de um neurônio sem raízes perde o azul: cinza e tracejada", () => {
    const n = neuronio("n", 150, 150);

    const linhas = tracos(
      desenhar({
        nos: [A, n],
        links: [{ source: A, target: n, tipo: "sinapse" }],
        estadosWiki: new Map([["n", "sem_raizes"]]),
      }),
    ).filter((c) => c.segmentos > 0);

    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ cor: CORES.textoSuave, tracejado: [2, 4] });
  });

  describe("títulos", () => {
    const n1 = neuronio("n1", 100, 100);
    const n2 = neuronio("n2", 300, 100);

    it("no canvas largo, todo neurônio leva o título em azul, abaixo do halo", () => {
      const escritos = textos(desenhar({ nos: [A, n1, n2], links: [] }));

      expect(escritos.map((t) => t.texto)).toEqual(["n1", "n2"]);
      expect(escritos.every((t) => t.cor === CORES.destaqueTexto)).toBe(true);
      expect(escritos[0].y).toBeGreaterThan(100 + geometriaDoNeuronio(5).halo);
    });

    it("no canvas estreito, só o selecionado", () => {
      const foco = { id: "n1", vizinhos: new Set<string>() };

      expect(textos(desenhar({ largura: 500, nos: [A, n1, n2], links: [] }))).toEqual([]);
      expect(textos(desenhar({ largura: 500, nos: [A, n1, n2], links: [], foco })).map((t) => t.texto)).toEqual(["n1"]);
    });

    it("limita os títulos dos neurônios: muitos não viram sopa de letrinhas", () => {
      const muitos = Array.from({ length: 60 }, (_, i) => neuronio(`n${i}`, i * 10, 0));

      expect(textos(desenhar({ nos: muitos, links: [] }))).toHaveLength(40);
    });

    it("no modo fundo, nem os neurônios levam título", () => {
      expect(textos(desenhar({ interativo: false, nos: [n1, n2], links: [] }))).toEqual([]);
    });
  });

  describe("neuroniosVisiveis", () => {
    const n1 = neuronio("n1", 100, 100);
    const n2 = neuronio("n2", 300, 100);
    const links = [
      { source: A, target: n1, tipo: "sinapse" as const },
      { source: n1, target: n2, tipo: "neuronios" as const },
    ];

    it("com só neurônios, esconde quem está fora da lista: desenho, ligações e título", () => {
      const chamadas = desenhar({
        nos: [A, n1, n2],
        links,
        somenteNeuronios: true,
        neuroniosVisiveis: new Set(["n1"]),
      });

      expect(formasEm(chamadas, n2.tx, n2.ty)).toEqual([]);
      expect(formasEm(chamadas, n1.tx, n1.ty).length).toBeGreaterThan(0);
      expect(tracos(chamadas).filter((c) => c.segmentos > 0)).toEqual([]);
      expect(textos(chamadas).map((t) => t.texto)).toEqual(["n1"]);
    });

    it("sem só neurônios, a lista não filtra nada", () => {
      const chamadas = desenhar({ nos: [A, n1, n2], links, neuroniosVisiveis: new Set(["n1"]) });

      expect(formasEm(chamadas, n2.tx, n2.ty).length).toBeGreaterThan(0);
      expect(tracos(chamadas).filter((c) => c.segmentos > 0)).toHaveLength(2);
    });

    it("noVisivel é o mesmo filtro que o clique usa", () => {
      const filtro = { somenteNeuronios: true, neuroniosVisiveis: new Set(["n1"]) };

      expect(noVisivel(n1, filtro)).toBe(true);
      expect(noVisivel(n2, filtro)).toBe(false);
      expect(noVisivel(A, filtro)).toBe(false);
      expect(noVisivel(n2, { somenteNeuronios: true, neuroniosVisiveis: null })).toBe(true);
      expect(noVisivel(A, { somenteNeuronios: false, neuroniosVisiveis: new Set(["n1"]) })).toBe(true);
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
    expect(cores.noNeutro).toBe("#c9c6bd");
    expect(cores.arestaNeutra).toBe("#d8d4c9");
    expect(cores.destaqueTexto).toBe("#1e66c4");
    expect(cores.destaqueSuave).toBe("#e8f1fc");
    expect(cores.textoSuave).toBe("#8b8f94");
    expect(cores.tensao).toBe("#eb6834");
    expect(cores.paleta).toHaveLength(3);
  });

  it("lê as variáveis CSS do documento, para o canvas seguir o tema", () => {
    document.documentElement.style.setProperty("--destaque", "#123456");
    document.documentElement.style.setProperty("--grafo-cor-2", "#abcdef");
    document.documentElement.style.setProperty("--destaque-texto", "#6ea8f2");

    const cores = lerCores(2);

    expect(cores.destaque).toBe("#123456");
    expect(cores.paleta[1]).toBe("#abcdef");
    expect(cores.destaqueTexto).toBe("#6ea8f2");
  });
});
