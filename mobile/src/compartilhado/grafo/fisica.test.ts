import {
  avancarCampo, avancarParticulas, calcularLigacoes, criarCampo, criarParticulas,
  deveRotular, nascerNo, opacidadeDaParticula, raioDoCampo,
  deveRecalcularLigacoes,
} from "./fisica";

const OPCOES = { largura: 402, altura: 700, quantidade: 60, aleatorio: () => 0.5 };

describe("raioDoCampo", () => {
  it("usa 62% da menor dimensão", () => {
    expect(raioDoCampo(402, 700)).toBeCloseTo(402 * 0.62);
  });
});

describe("criarCampo", () => {
  it("cria a quantidade pedida", () => {
    expect(criarCampo(OPCOES)).toHaveLength(60);
  });

  it("usa os três tamanhos do handoff, com a maioria em 1,1", () => {
    const nos = criarCampo({ ...OPCOES, quantidade: 2000, aleatorio: Math.random });
    expect(new Set(nos.map((no) => no.raio))).toEqual(new Set([1.1, 2, 3.2]));

    const conta = (raio: number) => nos.filter((no) => no.raio === raio).length / nos.length;
    expect(conta(3.2)).toBeGreaterThan(0.005);
    expect(conta(3.2)).toBeLessThan(0.045);
    expect(conta(2)).toBeGreaterThan(0.05);
    expect(conta(2)).toBeLessThan(0.12);
    expect(conta(1.1)).toBeGreaterThan(0.85);
  });

  it("marca cerca de 6% dos nós como sinal", () => {
    const nos = criarCampo({ ...OPCOES, quantidade: 1000, aleatorio: Math.random });
    const sinais = nos.filter((no) => no.tom === "sinal").length;
    expect(sinais).toBeGreaterThan(30);
    expect(sinais).toBeLessThan(90);
  });

  it("nasce todo mundo dentro do raio do campo", () => {
    const raio = raioDoCampo(OPCOES.largura, OPCOES.altura);
    const centroX = OPCOES.largura / 2;
    const centroY = OPCOES.altura / 2;
    for (const no of criarCampo({ ...OPCOES, quantidade: 200, aleatorio: Math.random })) {
      expect(Math.hypot(no.x - centroX, no.y - centroY)).toBeLessThanOrEqual(raio);
    }
  });

  it("usa exatamente 0,12 px/frame de velocidade máxima de deriva", () => {
    const [no] = criarCampo({ ...OPCOES, quantidade: 1, aleatorio: () => 1 });
    expect(Math.abs(no.vx)).toBeCloseTo(0.12);
    expect(Math.abs(no.vy)).toBeCloseTo(0.12);
  });
});

describe("avancarCampo", () => {
  it("move cada nó pela sua velocidade", () => {
    const [antes] = criarCampo({ ...OPCOES, quantidade: 1 });
    const [depois] = avancarCampo([antes], OPCOES);
    expect(depois.x).toBeCloseTo(antes.x + antes.vx);
    expect(depois.y).toBeCloseTo(antes.y + antes.vy);
  });

  it("inverte a velocidade quando o nó passa de 1,1x o raio", () => {
    const raio = raioDoCampo(OPCOES.largura, OPCOES.altura);
    const fugitivo = {
      x: OPCOES.largura / 2 + raio * 1.15, y: OPCOES.altura / 2,
      vx: 0.12, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null,
    };
    const [depois] = avancarCampo([fugitivo], OPCOES);
    expect(depois.vx).toBeCloseTo(-0.12);
  });

  it("não inverte quem está dentro do limite", () => {
    const raio = raioDoCampo(OPCOES.largura, OPCOES.altura);
    const dentro = {
      x: OPCOES.largura / 2 + raio * 1.05, y: OPCOES.altura / 2,
      vx: 0.12, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null,
    };
    const [depois] = avancarCampo([dentro], OPCOES);
    expect(depois.vx).toBeCloseTo(0.12);
  });

  it("faz a fase avançar para o pulso de ±6%", () => {
    const [antes] = criarCampo({ ...OPCOES, quantidade: 1 });
    const [depois] = avancarCampo([antes], OPCOES);
    expect(depois.fase).toBeGreaterThan(antes.fase);
  });
});

describe("calcularLigacoes", () => {
  it("liga só pares a menos de 22% do raio", () => {
    const raio = 100;
    const perto = { x: 0, y: 0, vx: 0, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null };
    const vizinho = { ...perto, x: 21 };
    const longe = { ...perto, x: 23 };
    const ligacoes = calcularLigacoes([perto, vizinho, longe], raio);
    expect(ligacoes).toContainEqual([0, 1]);
    expect(ligacoes).not.toContainEqual([0, 2]);
  });

  it("respeita o teto de 6 ligações por nó", () => {
    const base = { y: 0, vx: 0, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null };
    const nos = Array.from({ length: 12 }, (_, i) => ({ ...base, x: i }));
    const ligacoes = calcularLigacoes(nos, 100);
    for (let indice = 0; indice < nos.length; indice += 1) {
      const grau = ligacoes.filter(([a, b]) => a === indice || b === indice).length;
      expect(grau).toBeLessThanOrEqual(6);
    }
  });

  it("não liga um nó a ele mesmo nem repete o par", () => {
    const base = { y: 0, vx: 0, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null };
    const ligacoes = calcularLigacoes([{ ...base, x: 0 }, { ...base, x: 1 }], 100);
    expect(ligacoes).toEqual([[0, 1]]);
  });
});

describe("partículas", () => {
  it("cria a quantidade pedida entre nós existentes", () => {
    const nos = criarCampo({ ...OPCOES, quantidade: 20, aleatorio: Math.random });
    expect(criarParticulas(nos, 8, Math.random)).toHaveLength(8);
  });

  it("sorteia a velocidade no piso da faixa do handoff (0,012)", () => {
    const nos = criarCampo({ ...OPCOES, quantidade: 20, aleatorio: Math.random });
    const [particula] = criarParticulas(nos, 1, () => 0);
    expect(particula.velocidade).toBeCloseTo(0.012);
  });

  it("sorteia a velocidade no teto da faixa do handoff (0,024)", () => {
    const nos = criarCampo({ ...OPCOES, quantidade: 20, aleatorio: Math.random });
    // criarParticulas chama aleatorio() três vezes por partícula: origem, destino, velocidade.
    // As duas primeiras precisam ficar dentro dos índices válidos; só a terceira testa o teto.
    let chamada = 0;
    const aleatorioQuaseUm = () => (chamada++ === 2 ? 1 : 0);
    const [particula] = criarParticulas(nos, 1, aleatorioQuaseUm);
    expect(particula.velocidade).toBeCloseTo(0.024);
  });

  it("avança o progresso pela velocidade e descarta as que chegaram", () => {
    const particula = { deX: 0, deY: 0, paraX: 10, paraY: 0, progresso: 0.99, velocidade: 0.02 };
    expect(avancarParticulas([particula])).toHaveLength(0);
  });

  it("mantém as que ainda estão no caminho", () => {
    const particula = { deX: 0, deY: 0, paraX: 10, paraY: 0, progresso: 0.2, velocidade: 0.02 };
    const [depois] = avancarParticulas([particula]);
    expect(depois.progresso).toBeCloseTo(0.22);
  });

  it("chega ao pico de opacidade no meio do caminho", () => {
    expect(opacidadeDaParticula(0.5)).toBeCloseTo(1);
    expect(opacidadeDaParticula(0)).toBeCloseTo(0);
    expect(opacidadeDaParticula(1)).toBeCloseTo(0);
  });
});

describe("nascerNo", () => {
  it("acrescenta um nó sinal a 30% do raio, começando em 0,4 de escala", () => {
    const raio = raioDoCampo(OPCOES.largura, OPCOES.altura);
    const nos = nascerNo([], { ...OPCOES, aleatorio: () => 0 });
    expect(nos).toHaveLength(1);
    expect(nos[0].tom).toBe("sinal");
    expect(nos[0].escala).toBeCloseTo(0.4);
    expect(Math.hypot(nos[0].x - OPCOES.largura / 2, nos[0].y - OPCOES.altura / 2)).toBeCloseTo(raio * 0.3);
  });

  it("cresce até 1 em cerca de 50 frames", () => {
    let nos = nascerNo([], { ...OPCOES, aleatorio: () => 0 });
    for (let frame = 0; frame < 50; frame += 1) nos = avancarCampo(nos, OPCOES);
    expect(nos[0].escala).toBeCloseTo(1, 1);
  });

  it("nasce com velocidade máxima de 0,12 px/frame", () => {
    const [no] = nascerNo([], { ...OPCOES, aleatorio: () => 1 });
    expect(Math.abs(no.vx)).toBeCloseTo(0.12);
    expect(Math.abs(no.vy)).toBeCloseTo(0.12);
  });
});

describe("deveRotular", () => {
  it("rotula nós de peso 1,2 ou mais", () => {
    expect(deveRotular(1.2, false)).toBe(true);
    expect(deveRotular(1.19, false)).toBe(false);
  });

  it("sempre rotula o nó selecionado", () => {
    expect(deveRotular(0.4, true)).toBe(true);
  });
});

describe("deveRecalcularLigacoes", () => {
  // Com densidade 60, calcularLigacoes testa 1770 pares. Rodar isso a cada
  // quadro era o caminho quente que travava a 120 Hz — e as ligações mudam
  // devagar demais para justificar.
  it("calcula na primeira vez", () => {
    expect(deveRecalcularLigacoes(0, 0)).toBe(true);
  });

  it("não recalcula dentro do intervalo", () => {
    expect(deveRecalcularLigacoes(1000, 1050)).toBe(false);
  });

  it("recalcula quando o intervalo fecha", () => {
    expect(deveRecalcularLigacoes(1000, 1250)).toBe(true);
  });
});
