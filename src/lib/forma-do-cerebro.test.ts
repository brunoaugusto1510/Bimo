import { describe, expect, it } from "vitest";
import {
  ATRASO_MAXIMO,
  montarFormaDoCerebro,
  progressoDoNo,
  type FormaDoCerebro,
  type PontoDoCerebro,
} from "./forma-do-cerebro";

type NoDeTeste = { id: string; x: number; y: number };

/** Silhueta usada pelo módulo (cópia só para conferir o resultado). */
const SILHUETA: ReadonlyArray<readonly [number, number]> = [
  [12, 80], [14, 62], [22, 44], [36, 28], [54, 16], [76, 8], [100, 5], [124, 6],
  [146, 12], [166, 24], [182, 42], [192, 62], [194, 82], [188, 100], [176, 110],
  [186, 120], [182, 136], [166, 146], [148, 146], [136, 140], [134, 156], [132, 172],
  [120, 172], [120, 154], [118, 136], [100, 134], [80, 130], [62, 122], [48, 110],
  [46, 100], [54, 92], [40, 96], [26, 96], [16, 90],
];
const CENTRO_DO_CEREBRO = { x: 103, y: 88.5 };
const LARGURA_DO_CEREBRO = 182;
const EPSILON = 0.75;

function sementeAleatoria(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nosAleatorios(quantidade: number, semente = 7, lado = 400): NoDeTeste[] {
  const aleatorio = sementeAleatoria(semente);
  return Array.from({ length: quantidade }, (_, i) => ({
    id: `no-${i}`,
    x: aleatorio() * lado,
    y: aleatorio() * lado,
  }));
}

/** Globo com poucos aglomerados, como o grafo de força produz. */
function nosAglomerados(quantidade: number, semente = 11): NoDeTeste[] {
  const aleatorio = sementeAleatoria(semente);
  const centros = Array.from({ length: 6 }, () => ({ x: aleatorio() * 400, y: aleatorio() * 400 }));
  return Array.from({ length: quantidade }, (_, i) => {
    const centro = centros[i % centros.length];
    return { id: `no-${i}`, x: centro.x + (aleatorio() - 0.5) * 50, y: centro.y + (aleatorio() - 0.5) * 50 };
  });
}

function caixaDosNos(nos: readonly NoDeTeste[]) {
  const xs = nos.map((n) => n.x);
  const ys = nos.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const lado = Math.max(maxX - minX, maxY - minY);
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, escala: lado > 0 ? lado / LARGURA_DO_CEREBRO : 1 };
}

function paraCoordenadasDoCerebro(ponto: PontoDoCerebro, nos: readonly NoDeTeste[]): PontoDoCerebro {
  const { cx, cy, escala } = caixaDosNos(nos);
  return {
    x: (ponto.x - cx) / escala + CENTRO_DO_CEREBRO.x,
    y: (ponto.y - cy) / escala + CENTRO_DO_CEREBRO.y,
  };
}

function dentroDaSilhueta(p: PontoDoCerebro): boolean {
  let dentro = false;
  for (let i = 0, j = SILHUETA.length - 1; i < SILHUETA.length; j = i++) {
    const [xi, yi] = SILHUETA[i];
    const [xj, yj] = SILHUETA[j];
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function distanciaAteSegmento(p: PontoDoCerebro, a: readonly [number, number], b: readonly [number, number]) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a[0] + t * dx), p.y - (a[1] + t * dy));
}

function distanciaAteASilhueta(p: PontoDoCerebro): number {
  return SILHUETA.reduce((menor, a, i) => {
    return Math.min(menor, distanciaAteSegmento(p, a, SILHUETA[(i + 1) % SILHUETA.length]));
  }, Infinity);
}

function pertenceAoCerebro(p: PontoDoCerebro): boolean {
  return dentroDaSilhueta(p) || distanciaAteASilhueta(p) <= EPSILON;
}

function cruzamentoProprio(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  d: readonly [number, number],
): boolean {
  const lado = (p: readonly [number, number], q: readonly [number, number], r: readonly [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = lado(a, b, c);
  const d2 = lado(a, b, d);
  const d3 = lado(c, d, a);
  const d4 = lado(c, d, b);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

function alvosEmCoordenadasDoCerebro(forma: FormaDoCerebro, nos: readonly NoDeTeste[]) {
  return new Map([...forma.alvos].map(([id, p]) => [id, paraCoordenadasDoCerebro(p, nos)]));
}

describe("montarFormaDoCerebro", () => {
  it.each([1, 2, 5, 120, 800])("dá exatamente um alvo e um atraso por nó com %i nós", (quantidade) => {
    const nos = nosAleatorios(quantidade);

    const forma = montarFormaDoCerebro(nos);

    expect(forma.alvos.size).toBe(quantidade);
    expect(forma.atrasos.size).toBe(quantidade);
    for (const no of nos) {
      expect(forma.alvos.has(no.id)).toBe(true);
      expect(forma.atrasos.has(no.id)).toBe(true);
    }
  });

  it("devolve estruturas vazias quando não há nós", () => {
    const forma = montarFormaDoCerebro([]);

    expect(forma.alvos.size).toBe(0);
    expect(forma.arestas).toEqual([]);
    expect(forma.atrasos.size).toBe(0);
    expect(forma.naBorda.size).toBe(0);
  });

  it("não deixa dois nós distintos no mesmo ponto", () => {
    const nos = nosAglomerados(120);

    const forma = montarFormaDoCerebro(nos);

    const pontos = [...alvosEmCoordenadasDoCerebro(forma, nos).values()];
    let menorDistancia = Infinity;
    for (let i = 0; i < pontos.length; i++) {
      for (let j = i + 1; j < pontos.length; j++) {
        menorDistancia = Math.min(menorDistancia, Math.hypot(pontos[i].x - pontos[j].x, pontos[i].y - pontos[j].y));
      }
    }
    expect(menorDistancia).toBeGreaterThan(0.5);
  });

  it.each([1, 2, 5, 120, 800])("mantém todos os alvos dentro da silhueta com %i nós", (quantidade) => {
    const nos = nosAglomerados(quantidade);

    const forma = montarFormaDoCerebro(nos);

    for (const [id, ponto] of alvosEmCoordenadasDoCerebro(forma, nos)) {
      expect(pertenceAoCerebro(ponto), `${id} em (${ponto.x}, ${ponto.y})`).toBe(true);
    }
  });

  it("devolve o mesmo resultado para a mesma entrada e a mesma semente", () => {
    const nos = nosAglomerados(150);

    const a = montarFormaDoCerebro(nos, { semente: 5 });
    const b = montarFormaDoCerebro(nos, { semente: 5 });

    expect([...a.alvos]).toEqual([...b.alvos]);
    expect(a.arestas).toEqual(b.arestas);
    expect([...a.atrasos]).toEqual([...b.atrasos]);
    expect([...a.naBorda]).toEqual([...b.naBorda]);
  });

  it("muda a disposição interna quando a semente muda", () => {
    const nos = nosAglomerados(150);

    const a = montarFormaDoCerebro(nos, { semente: 1 });
    const b = montarFormaDoCerebro(nos, { semente: 2 });

    expect([...a.alvos]).not.toEqual([...b.alvos]);
  });

  it("não depende do tamanho do globo, só da proporção", () => {
    const pequeno = nosAglomerados(80);
    const grande = pequeno.map((n) => ({ ...n, x: n.x * 3 + 50, y: n.y * 3 - 20 }));

    const formaPequena = montarFormaDoCerebro(pequeno);
    const formaGrande = montarFormaDoCerebro(grande);

    for (const no of pequeno) {
      const a = paraCoordenadasDoCerebro(formaPequena.alvos.get(no.id)!, pequeno);
      const b = paraCoordenadasDoCerebro(formaGrande.alvos.get(no.id)!, grande);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-6);
    }
  });

  it("não gera NaN quando todos os nós estão no mesmo ponto", () => {
    const nos = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, x: 5, y: 5 }));

    const forma = montarFormaDoCerebro(nos);

    for (const ponto of forma.alvos.values()) {
      expect(Number.isFinite(ponto.x)).toBe(true);
      expect(Number.isFinite(ponto.y)).toBe(true);
    }
    expect(forma.alvos.size).toBe(10);
  });

  it("mantém perto no cérebro os nós que estavam vizinhos no globo", () => {
    const nos = nosAglomerados(120);
    const forma = montarFormaDoCerebro(nos);
    const alvos = alvosEmCoordenadasDoCerebro(forma, nos);

    let soma = 0;
    for (const no of nos) {
      const vizinho = nos
        .filter((outro) => outro.id !== no.id)
        .reduce((melhor, outro) =>
          Math.hypot(outro.x - no.x, outro.y - no.y) < Math.hypot(melhor.x - no.x, melhor.y - no.y) ? outro : melhor,
        );
      const a = alvos.get(no.id)!;
      const b = alvos.get(vizinho.id)!;
      soma += Math.hypot(a.x - b.x, a.y - b.y);
    }

    expect(soma / nos.length).toBeLessThan(LARGURA_DO_CEREBRO * 0.2);
  });

  it("espalha os atrasos de 0 a ATRASO_MAXIMO da frente (esquerda) para trás (direita)", () => {
    const nos = nosAleatorios(200);
    const forma = montarFormaDoCerebro(nos);
    const alvos = alvosEmCoordenadasDoCerebro(forma, nos);

    const ordenados = [...alvos].sort((a, b) => a[1].x - b[1].x);
    const atrasosEmOrdem = ordenados.map(([id]) => forma.atrasos.get(id)!);
    for (let i = 1; i < atrasosEmOrdem.length; i++) {
      expect(atrasosEmOrdem[i]).toBeGreaterThanOrEqual(atrasosEmOrdem[i - 1] - 1e-9);
    }
    expect(Math.min(...atrasosEmOrdem)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...atrasosEmOrdem)).toBeLessThanOrEqual(ATRASO_MAXIMO);
    expect(atrasosEmOrdem[0]).toBeLessThan(0.02);
    expect(atrasosEmOrdem[atrasosEmOrdem.length - 1]).toBeGreaterThan(ATRASO_MAXIMO - 0.02);
  });

  it("marca como borda só ids que existem e que são uma fração do total", () => {
    const nos = nosAleatorios(120);
    const forma = montarFormaDoCerebro(nos);

    expect(forma.naBorda.size).toBeGreaterThan(30);
    expect(forma.naBorda.size).toBeLessThan(120);
    for (const id of forma.naBorda) expect(forma.alvos.has(id)).toBe(true);
  });
});

describe("arestas do desenho", () => {
  it("fecha o contorno em anel, com um vizinho de cada lado em cada nó do contorno", () => {
    const nos = nosAleatorios(120);
    const forma = montarFormaDoCerebro(nos);

    const grau = new Map<string, number>();
    for (const aresta of forma.arestas.filter((a) => a.tipo === "contorno")) {
      grau.set(aresta.de, (grau.get(aresta.de) ?? 0) + 1);
      grau.set(aresta.para, (grau.get(aresta.para) ?? 0) + 1);
    }
    expect(grau.size).toBeGreaterThanOrEqual(40);
    for (const g of grau.values()) expect(g).toBe(2);
  });

  it("cria correntes de sulco quando há nós suficientes e nenhuma quando há poucos", () => {
    const muitos = montarFormaDoCerebro(nosAleatorios(120));
    const poucos = montarFormaDoCerebro(nosAleatorios(30));

    expect(muitos.arestas.filter((a) => a.tipo === "sulco").length).toBeGreaterThan(5);
    expect(poucos.arestas.filter((a) => a.tipo === "sulco")).toHaveLength(0);
  });

  it("liga só ids de entrada, sem laços nem pares repetidos", () => {
    const nos = nosAglomerados(300);
    const forma = montarFormaDoCerebro(nos);

    const chaves = new Set<string>();
    for (const { de, para } of forma.arestas) {
      expect(forma.alvos.has(de)).toBe(true);
      expect(forma.alvos.has(para)).toBe(true);
      expect(de).not.toBe(para);
      const chave = de < para ? `${de}|${para}` : `${para}|${de}`;
      expect(chaves.has(chave), chave).toBe(false);
      chaves.add(chave);
    }
  });

  it("liga todo nó de dentro (fora do contorno e dos sulcos) à malha", () => {
    const nos = nosAleatorios(120);
    const forma = montarFormaDoCerebro(nos);

    const comMalha = new Set<string>();
    for (const a of forma.arestas.filter((x) => x.tipo === "malha")) {
      comMalha.add(a.de);
      comMalha.add(a.para);
    }
    const internos = nos.filter((n) => !forma.naBorda.has(n.id));
    expect(internos.length).toBeGreaterThan(20);
    for (const no of internos) expect(comMalha.has(no.id), no.id).toBe(true);
  });

  it.each([60, 120, 400])("mantém abertas as fendas: nenhuma aresta da malha cruza a silhueta com %i nós", (quantidade) => {
    const nos = nosAglomerados(quantidade);
    const forma = montarFormaDoCerebro(nos);
    const alvos = alvosEmCoordenadasDoCerebro(forma, nos);

    for (const aresta of forma.arestas.filter((a) => a.tipo === "malha")) {
      const a = alvos.get(aresta.de)!;
      const b = alvos.get(aresta.para)!;
      for (let i = 0; i < SILHUETA.length; i++) {
        const c = SILHUETA[i];
        const d = SILHUETA[(i + 1) % SILHUETA.length];
        expect(
          cruzamentoProprio([a.x, a.y], [b.x, b.y], c, d),
          `${aresta.de} -> ${aresta.para} cruza a borda ${i}`,
        ).toBe(false);
      }
    }
  });

  it("não deixa nenhuma aresta da malha atravessar a boca da fenda entre [46,100] e [40,96]", () => {
    const nos = nosAglomerados(300);
    const forma = montarFormaDoCerebro(nos);
    const alvos = alvosEmCoordenadasDoCerebro(forma, nos);
    const labioA: readonly [number, number] = [46, 100];
    const labioB: readonly [number, number] = [40, 96];

    for (const aresta of forma.arestas.filter((a) => a.tipo === "malha")) {
      const a = alvos.get(aresta.de)!;
      const b = alvos.get(aresta.para)!;
      expect(cruzamentoProprio([a.x, a.y], [b.x, b.y], labioA, labioB)).toBe(false);
    }
  });
});

describe("desempenho", () => {
  // Folgado de propósito: o normal fica perto de 120 ms, mas a suíte roda em paralelo e uma
  // máquina carregada não pode reprovar o teste. Ele existe para pegar um salto de ordem de grandeza.
  it("monta a forma de 800 nós em menos de 1 s", () => {
    const nos = nosAleatorios(800);
    montarFormaDoCerebro(nos);

    const inicio = performance.now();
    montarFormaDoCerebro(nos);
    const duracao = performance.now() - inicio;

    expect(duracao).toBeLessThan(1000);
  });
});

describe("progressoDoNo", () => {
  const atrasos = [0, 0.1, ATRASO_MAXIMO];

  it.each(atrasos)("é 0 no começo (atraso %f)", (atraso) => {
    expect(progressoDoNo(0, atraso)).toBe(0);
  });

  it.each(atrasos)("é 1 no fim (atraso %f)", (atraso) => {
    expect(progressoDoNo(1, atraso)).toBe(1);
  });

  it("só começa a andar depois do atraso", () => {
    expect(progressoDoNo(0.2, 0.25)).toBe(0);
  });

  it.each(atrasos)("nunca diminui quando o progresso geral cresce (atraso %f)", (atraso) => {
    let anterior = -Infinity;
    for (let passo = 0; passo <= 100; passo++) {
      const valor = progressoDoNo(passo / 100, atraso);
      expect(valor).toBeGreaterThanOrEqual(anterior);
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThanOrEqual(1);
      anterior = valor;
    }
  });

  it("usa suavização cúbica de entrada e saída (0,5 no meio do trecho)", () => {
    const atraso = 0.2;
    const meio = atraso + (1 - ATRASO_MAXIMO) / 2;

    expect(progressoDoNo(meio, atraso)).toBeCloseTo(0.5, 10);
    expect(progressoDoNo(atraso + (1 - ATRASO_MAXIMO) / 4, atraso)).toBeCloseTo(0.0625, 10);
  });

  it("limita progressos fora de 0..1", () => {
    expect(progressoDoNo(-1, 0.1)).toBe(0);
    expect(progressoDoNo(2, 0.1)).toBe(1);
  });
});
