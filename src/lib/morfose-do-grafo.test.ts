import { describe, expect, it } from "vitest";
import {
  DURACAO_DA_MORFOSE_MS,
  avancarProgresso,
  fatorDeRaioNoCerebro,
  posicaoAlvo,
  fatorDeSuavizacao,
  moverNoDesenhado,
  type NoMorfavel,
} from "./morfose-do-grafo";

describe("avancarProgresso", () => {
  it("sobe em direção ao cérebro na velocidade de 1/duração por milissegundo", () => {
    expect(avancarProgresso(0, 1, DURACAO_DA_MORFOSE_MS / 4)).toBeCloseTo(0.25);
  });

  it("desce em direção ao globo", () => {
    expect(avancarProgresso(1, 0, DURACAO_DA_MORFOSE_MS / 2)).toBeCloseTo(0.5);
  });

  it("não passa do alvo", () => {
    expect(avancarProgresso(0.9, 1, DURACAO_DA_MORFOSE_MS)).toBe(1);
    expect(avancarProgresso(0.1, 0, DURACAO_DA_MORFOSE_MS)).toBe(0);
  });

  it("fica parado quando já chegou", () => {
    expect(avancarProgresso(1, 1, 500)).toBe(1);
  });

  it("com movimento reduzido, pula direto para o alvo", () => {
    expect(avancarProgresso(0, 1, 16, true)).toBe(1);
    expect(avancarProgresso(1, 0, 16, true)).toBe(0);
  });

  it("ignora um intervalo negativo ou inválido", () => {
    expect(avancarProgresso(0.4, 1, -50)).toBe(0.4);
    expect(avancarProgresso(0.4, 1, Number.NaN)).toBe(0.4);
  });
});

describe("posicaoAlvo", () => {
  const globo = { x: 0, y: 100 };
  const cerebro = { x: 100, y: 0 };

  it("fica no globo com progresso 0 e no cérebro com progresso 1", () => {
    expect(posicaoAlvo(globo, cerebro, 0)).toEqual(globo);
    expect(posicaoAlvo(globo, cerebro, 1)).toEqual(cerebro);
  });

  it("interpola no meio do caminho", () => {
    expect(posicaoAlvo(globo, cerebro, 0.5)).toEqual({ x: 50, y: 50 });
  });

  it("sem vaga no cérebro, o nó fica no globo", () => {
    expect(posicaoAlvo(globo, undefined, 1)).toEqual(globo);
  });
});

describe("fatorDeSuavizacao", () => {
  it("é 0,2 num quadro de 60 fps", () => {
    expect(fatorDeSuavizacao(1000 / 60)).toBeCloseTo(0.2);
  });

  it("anda mais num quadro mais longo (independe da taxa de quadros)", () => {
    expect(fatorDeSuavizacao(64)).toBeGreaterThan(fatorDeSuavizacao(16));
  });

  it("não anda com intervalo zero ou inválido", () => {
    expect(fatorDeSuavizacao(0)).toBe(0);
    expect(fatorDeSuavizacao(Number.NaN)).toBe(0);
  });
});

describe("moverNoDesenhado", () => {
  function novoNo(extra: Partial<NoMorfavel> = {}): NoMorfavel {
    return { x: 10, y: 10, dx: 10, dy: 10, progresso: 0, cerebroX: 110, cerebroY: 10, atraso: 0, ...extra };
  }
  const fator = fatorDeSuavizacao(1000 / 60);
  const base = { progressoGeral: 1, interativo: false, fator, reduzido: false };

  it("no modo interativo com progresso 0, é a posição exata da simulação", () => {
    const no = novoNo({ dx: 500, dy: 500 });

    const mudou = moverNoDesenhado(no, { ...base, interativo: true, progressoGeral: 0 });

    expect(mudou).toBe(true);
    expect(no).toMatchObject({ dx: 10, dy: 10, progresso: 0 });
  });

  it("em movimento, desliza em direção ao alvo sem pular", () => {
    const no = novoNo();

    moverNoDesenhado(no, base);

    expect(no.dx).toBeGreaterThan(10);
    expect(no.dx).toBeLessThan(110);
    expect(no.progresso).toBe(1);
  });

  it("com movimento reduzido, vai direto ao alvo", () => {
    const no = novoNo();

    moverNoDesenhado(no, { ...base, reduzido: true });

    expect(no).toMatchObject({ dx: 110, dy: 10 });
  });

  it("encosta no alvo e avisa que parou de mexer", () => {
    const no = novoNo({ dx: 109.999, dy: 10 });

    expect(moverNoDesenhado(no, base)).toBe(true);
    expect(no.dx).toBe(110);
    expect(moverNoDesenhado(no, base)).toBe(false);
  });

  it("segue o globo quando o nó não tem vaga no cérebro", () => {
    const no = novoNo({ cerebroX: undefined, cerebroY: undefined });

    moverNoDesenhado(no, { ...base, reduzido: true });

    expect(no).toMatchObject({ dx: 10, dy: 10, progresso: 0 });
  });

  it("respeita o atraso da varredura: nó atrasado ainda não saiu do globo no início", () => {
    const no = novoNo({ atraso: 0.3 });

    moverNoDesenhado(no, { ...base, progressoGeral: 0.2, reduzido: true });

    expect(no).toMatchObject({ dx: 10, progresso: 0 });
  });
});

describe("fatorDeRaioNoCerebro", () => {
  it("não muda nada no globo", () => {
    expect(fatorDeRaioNoCerebro(10, 0)).toBe(1);
  });

  it("cresce com o grau no cérebro, até um teto", () => {
    expect(fatorDeRaioNoCerebro(0, 1)).toBe(1);
    expect(fatorDeRaioNoCerebro(3, 1)).toBeGreaterThan(1);
    expect(fatorDeRaioNoCerebro(100, 1)).toBe(fatorDeRaioNoCerebro(6, 1));
    expect(fatorDeRaioNoCerebro(100, 1)).toBeLessThan(1.5);
  });
});
