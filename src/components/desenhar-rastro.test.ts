import { describe, expect, it } from "vitest";
import type { Camera } from "@/lib/camera-do-grafo";
import type { EstadoDaNota, QuadroDoRastro } from "@/lib/rastro-do-agente";
import { criarContextoFalso, preenchimentos, textos, tracos, type Gradiente } from "./contexto-falso";
import { desenharQuadro, type Cores, type NoVisual, type Quadro } from "./desenhar-grafo";

const CORES: Cores = {
  linha: "#e7e3d9",
  destaque: "#2574e0",
  naoResolvida: "#8b8f94",
  tag: "#5f8f8b",
  texto: "#23252b",
  fundo: "#fbfaf8",
  fonte: "sans-serif",
  noNeutro: "#808080",
  arestaNeutra: "#c0c0c0",
  destaqueTexto: "#6ea8f2",
  sobreDestaque: "#ffffff",
  painel: "#fffffe",
  bordaSuave: "#cfe0f8",
  destaqueSuave: "#e8f1fc",
  textoSuave: "#8b8f94",
  tensao: "#eb6834",
  paleta: ["#6b6b73"],
};

const CAMERA: Camera = { x: 0, y: 0, k: 1 };
const RAIO = 5;

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

function rastroCom(
  notas: Array<[string, EstadoDaNota, Partial<{ intensidade: number; desde: number }>?]>,
  extra: Partial<QuadroDoRastro> = {},
): QuadroDoRastro {
  return {
    notas: new Map(
      notas.map(([id, estado, dados]) => [id, { estado, intensidade: 1, desde: 0, ...dados }]),
    ),
    segmentos: [],
    faisca: null,
    foco: 1,
    ativo: true,
    ...extra,
  };
}

function desenhar(rastro: QuadroDoRastro, extra: Partial<Quadro> = {}) {
  return desenharComPilha(rastro, extra).chamadas;
}

function desenharComPilha(rastro: QuadroDoRastro, extra: Partial<Quadro> = {}) {
  const { contexto, chamadas, pilha } = criarContextoFalso();
  desenharQuadro(contexto, {
    largura: 800,
    altura: 600,
    camera: CAMERA,
    tempo: 0,
    // Sem respiração: as posições são exatamente as do nó.
    intensidade: 0,
    interativo: false,
    notaAberta: null,
    foco: null,
    hover: null,
    nos: [A, B, C, TAG],
    links: [
      { source: A, target: B },
      { source: B, target: C },
    ],
    cores: CORES,
    corDoNo: () => CORES.paleta[0],
    raioNaTela: () => RAIO,
    movimentoReduzido: true,
    rastro,
    ...extra,
  });
  return { chamadas, pilha };
}

/** Os brilhos são preenchimentos com gradiente. */
const brilhos = (chamadas: ReturnType<typeof desenhar>) =>
  preenchimentos(chamadas).filter((c) => (c.cor as Gradiente).tipo === "gradiente");
const aneis = (chamadas: ReturnType<typeof desenhar>) =>
  tracos(chamadas).filter((t) => t.segmentos === 0 && t.cor === CORES.destaque);
/** O nó A é o primeiro desenhado entre os preenchimentos sólidos. */
const bolinhaDeA = (chamadas: ReturnType<typeof desenhar>) =>
  preenchimentos(chamadas).find((c) => typeof c.cor === "string" && c.x === 100 && c.y === 100)!;

describe("candidata e vista", () => {
  it("candidata mistura o azul na cor do nó, na proporção da intensidade, e ganha um brilho pequeno", () => {
    const chamadas = desenhar(rastroCom([["A.md", "candidata", { intensidade: 0.5 }]]));

    expect(bolinhaDeA(chamadas).cor).not.toBe(CORES.paleta[0]);
    expect(bolinhaDeA(chamadas).cor).not.toBe(CORES.destaque);
    expect(brilhos(chamadas)).toHaveLength(1);
    expect(brilhos(chamadas)[0]).toMatchObject({ raio: 16 });
  });

  it("a candidata com intensidade 1 já é azul", () => {
    const chamadas = desenhar(rastroCom([["A.md", "candidata"]]));

    expect(bolinhaDeA(chamadas).cor).toBe(CORES.destaque);
  });

  it("vista é só um azul fraco: sem brilho nem anel", () => {
    const chamadas = desenhar(rastroCom([["A.md", "vista"]]));

    expect(bolinhaDeA(chamadas).cor).not.toBe(CORES.destaque);
    expect(bolinhaDeA(chamadas).cor).not.toBe(CORES.paleta[0]);
    expect(brilhos(chamadas)).toHaveLength(0);
    expect(aneis(chamadas)).toHaveLength(0);
  });
});

describe("lendo", () => {
  it("azul sólido, 3px maior, com anel e um brilho grande (60px)", () => {
    const chamadas = desenhar(rastroCom([["A.md", "lendo"]]));

    expect(bolinhaDeA(chamadas)).toMatchObject({ cor: CORES.destaque, raio: RAIO + 3 });
    expect(brilhos(chamadas)[0]).toMatchObject({ raio: 60 });
    expect(aneis(chamadas)[0]).toMatchObject({ raio: RAIO + 3 + 5, tracejado: [] });
  });

  it("o brilho usa a cor do texto azul (mais clara no tema escuro)", () => {
    const [brilho] = brilhos(desenhar(rastroCom([["A.md", "lendo"]])));

    expect((brilho.cor as Gradiente).paradas[0][1]).toBe("rgba(110, 168, 242, 0.5)");
  });

  it("o brilho pulsa com o tempo, e fica parado com movimento reduzido", () => {
    const forca = (tempo: number, reduzido: boolean) =>
      (brilhos(
        desenhar(rastroCom([["A.md", "lendo"]]), { tempo, movimentoReduzido: reduzido }),
      )[0].cor as Gradiente).paradas[0][1];

    expect(forca(0, false)).not.toBe(forca(0.3, false));
    expect(forca(0, true)).toBe(forca(0.3, true));
  });
});

describe("escrevendo", () => {
  it("azul sólido com brilho e um anel tracejado que gira", () => {
    const em = (tempo: number) =>
      desenhar(rastroCom([["A.md", "escrevendo"]]), { tempo, movimentoReduzido: false });

    const chamadas = em(0.5);

    expect(bolinhaDeA(chamadas).cor).toBe(CORES.destaque);
    expect(brilhos(chamadas)).toHaveLength(1);
    expect(aneis(chamadas)[0].tracejado).toEqual([4, 4]);
  });

  it("escreve o título com '· editando' no rótulo", () => {
    const escritos = textos(desenhar(rastroCom([["A.md", "escrevendo"]]))).map((t) => t.texto);

    expect(escritos).toEqual(["A · editando"]);
  });
});

describe("lida e citada", () => {
  it.each(["lida", "citada"] as const)("%s: azul sólido com anel e sem brilho", (estado) => {
    const chamadas = desenhar(rastroCom([["A.md", estado]]));

    expect(bolinhaDeA(chamadas)).toMatchObject({ cor: CORES.destaque, raio: RAIO });
    expect(aneis(chamadas)).toHaveLength(1);
    expect(brilhos(chamadas)).toHaveLength(0);
  });

  it("citada ganha rótulo; lida não", () => {
    expect(textos(desenhar(rastroCom([["A.md", "citada"]]))).map((t) => t.texto)).toEqual(["A"]);
    expect(textos(desenhar(rastroCom([["A.md", "lida"]])))).toEqual([]);
  });
});

describe("nova", () => {
  const nova = (tempoMs: number, extra: Partial<Quadro> = {}, nascimentos?: Map<string, number>) =>
    desenhar(rastroCom([["A.md", "nova", { desde: 0 }]]), {
      tempo: tempoMs / 1000,
      movimentoReduzido: false,
      nascimentos,
      ...extra,
    });

  it("começa pequena e cresce passando um pouco do tamanho final", () => {
    const raioEm = (ms: number) => bolinhaDeA(nova(ms)).raio;

    expect(raioEm(0)).toBe(0);
    expect(raioEm(100)).toBeLessThan(RAIO);
    expect(Math.max(...[150, 250, 350, 450].map(raioEm))).toBeGreaterThan(RAIO);
    expect(raioEm(900)).toBeCloseTo(RAIO);
  });

  it("solta duas ondas, a segunda 260ms depois da primeira", () => {
    const ondas = (ms: number) => aneis(nova(ms)).length;

    expect(ondas(100)).toBe(1);
    expect(ondas(500)).toBe(2);
    // A primeira onda acaba em 1s; a segunda ainda corre, e o anel fixo já apareceu.
    expect(ondas(1100)).toBe(2);
    // Depois das ondas e do crescimento, resta só o anel fixo.
    expect(ondas(1500)).toBe(1);
  });

  it("depois do nascimento fica com brilho suave, anel e a etiqueta 'nova' no rótulo", () => {
    const chamadas = nova(2000);

    expect(brilhos(chamadas)[0]).toMatchObject({ raio: 30 });
    expect(aneis(chamadas)).toHaveLength(1);
    expect(textos(chamadas).map((t) => t.texto)).toEqual(["A", "nova"]);
  });

  it("espera o nó aparecer no layout: o nascimento conta da primeira vez em que ele existiu", () => {
    const chamadas = nova(1600, {}, new Map([["A.md", 1500]]));

    // 100ms de vida: ainda crescendo e com uma onda, embora a nota seja "nova" há 1,6s.
    expect(bolinhaDeA(chamadas).raio).toBeLessThan(RAIO);
    expect(aneis(chamadas)).toHaveLength(1);
  });

  it("acende em azul as ligações reais da nota, aos poucos", () => {
    const ligacoes = (ms: number) =>
      tracos(nova(ms)).filter((t) => t.cor === CORES.destaque && t.segmentos === 1);

    expect(ligacoes(350)[0].alfa).toBeCloseTo((350 / 700) * 0.9);
    expect(ligacoes(2000)[0].alfa).toBeCloseTo(0.9);
  });

  it("com movimento reduzido já aparece pronta, sem ondas", () => {
    const chamadas = nova(0, { movimentoReduzido: true });

    expect(bolinhaDeA(chamadas).raio).toBe(RAIO);
    expect(aneis(chamadas)).toHaveLength(1);
  });
});

describe("caminho e faísca", () => {
  const segmento = (progresso: number) => ({ ids: ["A.md", "B.md", "C.md"], progresso });

  it("traça o caminho em azul, 2px, numa polilinha só", () => {
    const rastro = rastroCom([], { segmentos: [segmento(1)] });

    const [linha] = tracos(desenhar(rastro)).filter((t) => t.largura === 2);

    expect(linha).toMatchObject({ cor: CORES.destaque, segmentos: 1 });
  });

  it("não traça o que ainda não começou a ser percorrido", () => {
    const rastro = rastroCom([], { segmentos: [segmento(0)] });

    expect(tracos(desenhar(rastro, { movimentoReduzido: false })).filter((t) => t.largura === 2)).toEqual([]);
  });

  it("a faísca é um ponto azul com brilho na ponta do trecho percorrido", () => {
    const seg = segmento(0.5);
    const rastro = rastroCom([], { segmentos: [seg], faisca: seg });

    const chamadas = desenhar(rastro, { movimentoReduzido: false });

    // Metade do caminho A→B→C (200px) é exatamente B.
    expect(brilhos(chamadas).find((b) => b.raio === 18)).toMatchObject({ x: 200, y: 100 });
    expect(preenchimentos(chamadas).find((p) => p.raio === 3.5)).toMatchObject({
      cor: CORES.destaque,
      x: 200,
      y: 100,
    });
  });

  it("sem faísca no rastro, não desenha o ponto", () => {
    const rastro = rastroCom([], { segmentos: [segmento(1)], faisca: null });

    expect(preenchimentos(desenhar(rastro, { movimentoReduzido: false })).find((p) => p.raio === 3.5)).toBeUndefined();
  });

  it("com movimento reduzido mostra o caminho inteiro e nenhuma faísca", () => {
    const seg = segmento(0.1);
    const rastro = rastroCom([], { segmentos: [seg], faisca: seg });

    const chamadas = desenhar(rastro, { movimentoReduzido: true });

    expect(tracos(chamadas).filter((t) => t.largura === 2)).toHaveLength(1);
    expect(preenchimentos(chamadas).find((p) => p.raio === 3.5)).toBeUndefined();
  });

  it("ignora ids que não estão no grafo", () => {
    const rastro = rastroCom([], { segmentos: [{ ids: ["A.md", "fora.md"], progresso: 1 }] });

    expect(tracos(desenhar(rastro)).filter((t) => t.largura === 2)).toEqual([]);
  });
});

describe("rótulos do rastro", () => {
  it("cobrem lendo, escrevendo, nova e citada, e nada mais", () => {
    const rastro = rastroCom([
      ["A.md", "lendo"],
      ["B.md", "citada"],
      ["C.md", "vista"],
    ]);

    expect(textos(desenhar(rastro)).map((t) => t.texto).sort()).toEqual(["A", "B"]);
  });

  it("desenha a pílula com o fundo do painel e a borda azul suave", () => {
    const chamadas = desenhar(rastroCom([["A.md", "lendo"]]));

    expect(preenchimentos(chamadas).some((p) => p.cor === CORES.painel)).toBe(true);
    expect(tracos(chamadas).some((t) => t.cor === CORES.bordaSuave)).toBe(true);
    expect(textos(chamadas)[0].cor).toBe(CORES.destaqueTexto);
  });

  it("pula nós que não são notas", () => {
    expect(textos(desenhar(rastroCom([["tag:x", "lendo"]])))).toEqual([]);
  });

  it("fica dentro do canvas, mesmo com a nota no canto", () => {
    const noCanto = no("canto.md", 2, 2);

    const [texto] = textos(
      desenhar(rastroCom([["canto.md", "lendo"]]), { nos: [noCanto], links: [] }),
    );

    expect(texto.x).toBeGreaterThanOrEqual(6);
    expect(texto.y).toBeGreaterThanOrEqual(6);
  });

  it("vai para cima da nota quando não cabe embaixo", () => {
    const embaixo = no("fundo.md", 400, 598);
    const meio = no("meio.md", 400, 300);
    const y = (n: NoVisual) =>
      textos(desenhar(rastroCom([[n.id, "lendo"]]), { nos: [n], links: [] }))[0].y;

    expect(y(embaixo)).toBeLessThan(598);
    expect(y(meio)).toBeGreaterThan(300);
  });

  it("limita a quantidade de rótulos", () => {
    const muitos = Array.from({ length: 30 }, (_, i) => no(`n${i}.md`, 20 * i, 50));
    const rastro = rastroCom(muitos.map((n) => [n.id, "citada"] as [string, EstadoDaNota]));

    expect(textos(desenhar(rastro, { nos: muitos, links: [] })).length).toBeLessThanOrEqual(12);
  });
});

describe("nota criada pelo agente", () => {
  const criadas = new Set(["A.md"]);
  const escrevendo = rastroCom([["A.md", "escrevendo", { desde: 0 }]]);

  it("nasce quando o nó entra no layout, sem esperar o fim do eco da escrita", () => {
    // O nó apareceu há 100ms; a nota ainda está "escrevendo" (a "nova" só vem 1,4s depois da escrita).
    const chamadas = desenhar(escrevendo, {
      tempo: 1.6,
      movimentoReduzido: false,
      criadas,
      nascimentos: new Map([["A.md", 1500]]),
    });

    expect(bolinhaDeA(chamadas).raio).toBeLessThan(RAIO + 2);
    // A onda do nascimento + o anel tracejado de quem está escrevendo.
    expect(aneis(chamadas).length).toBe(2);
  });

  it("acende as ligações reais em azul já nessa hora", () => {
    const chamadas = desenhar(escrevendo, {
      tempo: 1.85,
      movimentoReduzido: false,
      criadas,
      nascimentos: new Map([["A.md", 1500]]),
    });

    const ligacoes = tracos(chamadas).filter((t) => t.cor === CORES.destaque && t.segmentos === 1);
    expect(ligacoes[0].alfa).toBeCloseTo((350 / 700) * 0.9);
  });

  it("sem ser da lista de criadas, a escrita de uma nota existente não nasce de novo", () => {
    const chamadas = desenhar(escrevendo, {
      tempo: 1.6,
      movimentoReduzido: false,
      nascimentos: new Map([["A.md", 1500]]),
    });

    expect(bolinhaDeA(chamadas).raio).toBe(RAIO + 2);
    expect(aneis(chamadas)).toHaveLength(1);
  });
});

describe("caminho com nó ausente", () => {
  it("não liga os vizinhos de um nó que não está no grafo", () => {
    const rastro = rastroCom([], { segmentos: [{ ids: ["A.md", "fora.md", "C.md"], progresso: 1 }] });

    expect(tracos(desenhar(rastro)).filter((t) => t.largura === 2)).toEqual([]);
  });

  it("desenha os pedaços que sobram de cada lado", () => {
    const rastro = rastroCom([], {
      segmentos: [{ ids: ["A.md", "B.md", "fora.md", "C.md", "TAG"], progresso: 1 }],
    });
    const comTag = no("TAG", 400, 100);

    const linhas = tracos(desenhar(rastro, { nos: [A, B, C, comTag] })).filter((t) => t.largura === 2);

    // O id ausente quebra o caminho: sobram A–B e C–TAG, sem ligar B a C por cima do vazio.
    expect(linhas).toHaveLength(2);
  });
});

describe("nota selecionada ou aberta que também está no rastro", () => {
  it("mantém o destaque (azul cheio e crescido) mesmo sendo só candidata", () => {
    const rastro = rastroCom([["A.md", "candidata", { intensidade: 0.2 }]]);

    const chamadas = desenhar(rastro, { notaAberta: "A.md" });

    expect(bolinhaDeA(chamadas)).toMatchObject({ cor: CORES.destaque, raio: RAIO + 2, alfa: 1 });
  });
});

describe("estado do canvas", () => {
  it("o que o rastro muda (traço, fonte, alinhamento) fica entre save e restore", () => {
    const rastro = rastroCom([["A.md", "lendo"]], { segmentos: [{ ids: ["A.md", "B.md"], progresso: 1 }] });

    const { pilha } = desenharComPilha(rastro);

    expect(pilha.maxima).toBeGreaterThanOrEqual(1);
    expect(pilha.profundidade).toBe(0);
  });
});
