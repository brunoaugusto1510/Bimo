import { describe, expect, it } from "vitest";
import {
  DURACAO_DA_IGNICAO_MS,
  DESVANECIMENTO_FINAL_MS,
  ECO_DA_ESCRITA_MS,
  ESCURECIMENTO,
  INTERVALO_ENTRE_CANDIDATAS_MS,
  RAMPA_DO_ESCURECIMENTO_MS,
  VIAGEM_DA_FAISCA_MS,
  caminhoMaisCurto,
  encerrarRastro,
  iniciarRastro,
  quadroDoRastro,
  registrarPasso,
  type PassoDoAgente,
  type Rastro,
} from "./rastro-do-agente";

/** Monta um rastro a partir de pares [passo, instante]; `fim` opcional. */
function montar(passos: Array<[PassoDoAgente, number]>, fim: number | null = null): Rastro {
  let rastro = iniciarRastro(1000);
  for (const [passo, em] of passos) rastro = registrarPasso(rastro, passo, em);
  return fim === null ? rastro : encerrarRastro(rastro, fim);
}

describe("constantes de tempo", () => {
  it("têm os valores combinados com o desenho", () => {
    expect(INTERVALO_ENTRE_CANDIDATAS_MS).toBe(140);
    expect(DURACAO_DA_IGNICAO_MS).toBe(320);
    expect(VIAGEM_DA_FAISCA_MS).toBe(700);
    expect(ECO_DA_ESCRITA_MS).toBe(1400);
    expect(DESVANECIMENTO_FINAL_MS).toBe(900);
    expect(ESCURECIMENTO).toBe(0.55);
    expect(RAMPA_DO_ESCURECIMENTO_MS).toBe(300);
  });
});

describe("iniciarRastro / registrarPasso / encerrarRastro", () => {
  it("começa vazio, sem fim", () => {
    expect(iniciarRastro(1000)).toEqual({ inicio: 1000, passos: [], fim: null });
  });

  it("registrarPasso devolve um rastro novo com o instante e não muda o original", () => {
    const original = iniciarRastro(1000);
    const novo = registrarPasso(original, { tipo: "leitura", id: "a" }, 1500);
    expect(novo).not.toBe(original);
    expect(original.passos).toHaveLength(0);
    expect(novo.passos).toEqual([{ tipo: "leitura", id: "a", em: 1500 }]);
  });

  it("registrarPasso copia a lista de ids da busca", () => {
    const ids = ["a", "b"];
    const rastro = registrarPasso(iniciarRastro(0), { tipo: "busca", ids }, 10);
    ids.push("c");
    expect(rastro.passos[0]).toEqual({ tipo: "busca", ids: ["a", "b"], em: 10 });
  });

  it("ignora passos registrados depois do fim", () => {
    const encerrado = montar([], 2000);
    const depois = registrarPasso(encerrado, { tipo: "leitura", id: "a" }, 2500);
    expect(depois).toBe(encerrado);
    expect(depois.passos).toHaveLength(0);
  });

  it("encerrarRastro devolve um rastro novo e não muda o original", () => {
    const original = iniciarRastro(1000);
    const encerrado = encerrarRastro(original, 3000);
    expect(encerrado).not.toBe(original);
    expect(original.fim).toBeNull();
    expect(encerrado.fim).toBe(3000);
  });

  it("encerrarRastro é idempotente e mantém o primeiro fim", () => {
    const encerrado = encerrarRastro(iniciarRastro(1000), 3000);
    const outraVez = encerrarRastro(encerrado, 9000);
    expect(outraVez).toBe(encerrado);
    expect(outraVez.fim).toBe(3000);
  });
});

describe("quadroDoRastro sem rastro", () => {
  it("devolve um quadro vazio, inativo e com foco 1", () => {
    const quadro = quadroDoRastro(null, 5000);
    expect(quadro.notas.size).toBe(0);
    expect(quadro.segmentos).toEqual([]);
    expect(quadro.faisca).toBeNull();
    expect(quadro.foco).toBe(1);
    expect(quadro.ativo).toBe(false);
  });
});

describe("quadroDoRastro: busca", () => {
  const rastro = montar([[{ tipo: "busca", ids: ["a", "b", "c"] }, 2000]]);

  it("acende as candidatas em ordem de ranking, cada uma subindo de 0 a 1", () => {
    const quadro = quadroDoRastro(rastro, 2160);
    expect(quadro.notas.get("a")).toEqual({ estado: "candidata", intensidade: 0.5, desde: 2000 });
    expect(quadro.notas.get("b")?.intensidade).toBeCloseTo(20 / 320);
    expect(quadro.notas.get("b")?.desde).toBe(2140);
    expect(quadro.notas.get("c")?.intensidade).toBe(0);
  });

  it("todas chegam a intensidade 1 depois da última ignição", () => {
    const quando = 2000 + 2 * INTERVALO_ENTRE_CANDIDATAS_MS + DURACAO_DA_IGNICAO_MS;
    const quadro = quadroDoRastro(rastro, quando);
    for (const id of ["a", "b", "c"]) {
      expect(quadro.notas.get(id)).toMatchObject({ estado: "candidata", intensidade: 1 });
    }
  });

  it("a busca sem resultados não acende nada", () => {
    const vazia = montar([[{ tipo: "busca", ids: [] }, 2000]]);
    const quadro = quadroDoRastro(vazia, 2500);
    expect(quadro.notas.size).toBe(0);
    expect(quadro.segmentos).toEqual([]);
    expect(quadro.ativo).toBe(true);
  });

  it("as candidatas não lidas viram vistas quando o agente lê ou escreve algo", () => {
    const lendo = montar([
      [{ tipo: "busca", ids: ["a", "b", "c"] }, 2000],
      [{ tipo: "leitura", id: "b" }, 3000],
    ]);
    const quadro = quadroDoRastro(lendo, 3100);
    expect(quadro.notas.get("a")).toEqual({ estado: "vista", intensidade: 1, desde: 3000 });
    expect(quadro.notas.get("b")?.estado).toBe("lendo");
    expect(quadro.notas.get("c")?.estado).toBe("vista");
  });

  it("uma nova busca não rebaixa nota que já foi lida", () => {
    const refeita = montar([
      [{ tipo: "leitura", id: "a" }, 2000],
      [{ tipo: "busca", ids: ["a", "b"] }, 3000],
    ]);
    const quadro = quadroDoRastro(refeita, 3500);
    expect(quadro.notas.get("a")?.estado).toBe("lendo");
    expect(quadro.notas.get("b")?.estado).toBe("candidata");
  });
});

describe("quadroDoRastro: leitura", () => {
  it("só a leitura mais recente está lendo; as anteriores estão lidas", () => {
    const rastro = montar([
      [{ tipo: "leitura", id: "a" }, 2000],
      [{ tipo: "leitura", id: "b" }, 3000],
    ]);
    const quadro = quadroDoRastro(rastro, 3100);
    expect(quadro.notas.get("a")).toEqual({ estado: "lida", intensidade: 1, desde: 2000 });
    expect(quadro.notas.get("b")).toEqual({ estado: "lendo", intensidade: 1, desde: 3000 });
  });

  it("ler a mesma nota de novo a deixa lendo, com o instante da última leitura", () => {
    const rastro = montar([
      [{ tipo: "leitura", id: "a" }, 2000],
      [{ tipo: "leitura", id: "b" }, 3000],
      [{ tipo: "leitura", id: "a" }, 4000],
    ]);
    const quadro = quadroDoRastro(rastro, 4100);
    expect(quadro.notas.get("a")).toEqual({ estado: "lendo", intensidade: 1, desde: 4000 });
    expect(quadro.notas.get("b")?.estado).toBe("lida");
    expect(quadro.notas.size).toBe(2);
  });

  it("depois do fim, as lidas viram citadas e continuam acesas", () => {
    const rastro = montar(
      [
        [{ tipo: "leitura", id: "a" }, 2000],
        [{ tipo: "leitura", id: "b" }, 3000],
      ],
      4000,
    );
    const muitoDepois = quadroDoRastro(rastro, 4000 + 60_000);
    expect(muitoDepois.notas.get("a")).toEqual({ estado: "citada", intensidade: 1, desde: 4000 });
    expect(muitoDepois.notas.get("b")?.estado).toBe("citada");
  });
});

describe("quadroDoRastro: desvanecimento após o fim", () => {
  const rastro = montar(
    [
      [{ tipo: "busca", ids: ["a", "b"] }, 2000],
      [{ tipo: "leitura", id: "a" }, 3000],
    ],
    4000,
  );

  it("as vistas desvanecem de 1 a 0 e depois somem das notas", () => {
    const meio = quadroDoRastro(rastro, 4000 + DESVANECIMENTO_FINAL_MS / 2);
    expect(meio.notas.get("b")?.estado).toBe("vista");
    expect(meio.notas.get("b")?.intensidade).toBeCloseTo(0.5);
    const fim = quadroDoRastro(rastro, 4000 + DESVANECIMENTO_FINAL_MS);
    expect(fim.notas.has("b")).toBe(false);
    expect(fim.notas.get("a")?.estado).toBe("citada");
  });

  it("as candidatas que não chegaram a ser lidas também desvanecem", () => {
    const soBusca = montar([[{ tipo: "busca", ids: ["a"] }, 2000]], 3000);
    expect(quadroDoRastro(soBusca, 3000 + DESVANECIMENTO_FINAL_MS / 2).notas.get("a")?.intensidade)
      .toBeCloseTo(0.5);
    expect(quadroDoRastro(soBusca, 3000 + DESVANECIMENTO_FINAL_MS).notas.size).toBe(0);
  });
});

describe("quadroDoRastro: escrita", () => {
  it("fica escrevendo durante o eco e depois vira nova quando foi criada", () => {
    const rastro = montar([[{ tipo: "escrita", id: "n", criada: true }, 2000]]);
    expect(quadroDoRastro(rastro, 2000 + ECO_DA_ESCRITA_MS - 1).notas.get("n"))
      .toEqual({ estado: "escrevendo", intensidade: 1, desde: 2000 });
    expect(quadroDoRastro(rastro, 2000 + ECO_DA_ESCRITA_MS).notas.get("n"))
      .toEqual({ estado: "nova", intensidade: 1, desde: 2000 + ECO_DA_ESCRITA_MS });
  });

  it("vira citada quando a nota já existia", () => {
    const rastro = montar([[{ tipo: "escrita", id: "n", criada: false }, 2000]]);
    expect(quadroDoRastro(rastro, 2000 + ECO_DA_ESCRITA_MS).notas.get("n")?.estado).toBe("citada");
  });

  it("a nota pode ir de candidata a lendo e a escrevendo; o último passo vale", () => {
    const busca: [PassoDoAgente, number] = [{ tipo: "busca", ids: ["n"] }, 2000];
    const leitura: [PassoDoAgente, number] = [{ tipo: "leitura", id: "n" }, 3000];
    const escrita: [PassoDoAgente, number] = [{ tipo: "escrita", id: "n", criada: false }, 4000];
    expect(quadroDoRastro(montar([busca]), 2300).notas.get("n")?.estado).toBe("candidata");
    expect(quadroDoRastro(montar([busca, leitura]), 3500).notas.get("n")?.estado).toBe("lendo");
    expect(quadroDoRastro(montar([busca, leitura, escrita]), 4500).notas.get("n")?.estado).toBe(
      "escrevendo",
    );
  });

  it("escrever sem ter lido nada funciona e não gera segmentos", () => {
    const rastro = montar([[{ tipo: "escrita", id: "n", criada: true }, 2000]]);
    const quadro = quadroDoRastro(rastro, 2100);
    expect(quadro.notas.get("n")?.estado).toBe("escrevendo");
    expect(quadro.segmentos).toEqual([]);
    expect(quadro.faisca).toBeNull();
  });

  it("a escrita termina em citada/nova mesmo depois do fim; só a leitura anterior vira citada", () => {
    const rastro = montar(
      [
        [{ tipo: "leitura", id: "a" }, 2000],
        [{ tipo: "escrita", id: "n", criada: true }, 3000],
      ],
      3200,
    );
    const quadro = quadroDoRastro(rastro, 3200 + 60_000);
    expect(quadro.notas.get("a")?.estado).toBe("citada");
    expect(quadro.notas.get("n")?.estado).toBe("nova");
  });
});

describe("quadroDoRastro: segmentos e faísca", () => {
  const rastro = montar([
    [{ tipo: "leitura", id: "a" }, 2000],
    [{ tipo: "leitura", id: "b" }, 3000],
    [{ tipo: "escrita", id: "c", criada: false }, 4000],
  ]);

  it("liga cada par de notas tocadas em sequência, com progresso por tempo", () => {
    const quadro = quadroDoRastro(rastro, 4350);
    expect(quadro.segmentos).toEqual([
      { ids: ["a", "b"], progresso: 1 },
      { ids: ["b", "c"], progresso: 0.5 },
    ]);
  });

  it("a faísca é o último segmento enquanto ele ainda viaja", () => {
    const viajando = quadroDoRastro(rastro, 4350);
    expect(viajando.faisca).toEqual({ ids: ["b", "c"], progresso: 0.5 });
    const chegou = quadroDoRastro(rastro, 4000 + VIAGEM_DA_FAISCA_MS);
    expect(chegou.faisca).toBeNull();
    expect(chegou.segmentos[1].progresso).toBe(1);
  });

  it("junta repetições consecutivas da mesma nota", () => {
    const repetido = montar([
      [{ tipo: "leitura", id: "a" }, 2000],
      [{ tipo: "leitura", id: "a" }, 2500],
      [{ tipo: "escrita", id: "a", criada: false }, 3000],
    ]);
    expect(quadroDoRastro(repetido, 9000).segmentos).toEqual([]);
  });

  it("ler A, B e A de novo gera dois segmentos", () => {
    const voltou = montar([
      [{ tipo: "leitura", id: "a" }, 2000],
      [{ tipo: "leitura", id: "b" }, 3000],
      [{ tipo: "leitura", id: "a" }, 4000],
    ]);
    const ids = quadroDoRastro(voltou, 9000).segmentos.map((s) => s.ids);
    expect(ids).toEqual([["a", "b"], ["b", "a"]]);
  });

  it("usa o caminho informado e volta ao par direto quando ele devolve null", () => {
    const caminho = (de: string) => (de === "a" ? ["a", "x", "b"] : null);
    const quadro = quadroDoRastro(rastro, 9000, caminho);
    expect(quadro.segmentos.map((s) => s.ids)).toEqual([["a", "x", "b"], ["b", "c"]]);
  });

  it("o progresso fica em 0 quando o relógio ainda não chegou ao passo", () => {
    const quadro = quadroDoRastro(rastro, 3500);
    expect(quadro.segmentos[1].progresso).toBe(0);
  });
});

describe("quadroDoRastro: foco", () => {
  const rastro = montar([[{ tipo: "leitura", id: "a" }, 2000]], 5000);

  it("vale 1 antes do primeiro passo", () => {
    expect(quadroDoRastro(montar([]), 9000).foco).toBe(1);
    expect(quadroDoRastro(rastro, 1500).foco).toBe(1);
  });

  it("escurece até 1 menos o escurecimento ao longo da rampa", () => {
    const metade = quadroDoRastro(rastro, 2000 + RAMPA_DO_ESCURECIMENTO_MS / 2).foco;
    expect(metade).toBeCloseTo(1 - ESCURECIMENTO / 2);
    expect(quadroDoRastro(rastro, 2000 + RAMPA_DO_ESCURECIMENTO_MS).foco).toBeCloseTo(1 - ESCURECIMENTO);
    expect(quadroDoRastro(rastro, 4000).foco).toBeCloseTo(1 - ESCURECIMENTO);
  });

  it("volta a 1 depois do fim, ao longo do desvanecimento", () => {
    expect(quadroDoRastro(rastro, 5000 + DESVANECIMENTO_FINAL_MS / 2).foco)
      .toBeCloseTo(1 - ESCURECIMENTO / 2);
    expect(quadroDoRastro(rastro, 5000 + DESVANECIMENTO_FINAL_MS).foco).toBe(1);
  });

  it("um rastro encerrado sem passos não escurece", () => {
    expect(quadroDoRastro(montar([], 3000), 3100).foco).toBe(1);
  });
});

describe("quadroDoRastro: ativo", () => {
  it("fica ativo enquanto o agente trabalha, mesmo sem animação pendente", () => {
    const rastro = montar([[{ tipo: "leitura", id: "a" }, 2000]]);
    expect(quadroDoRastro(rastro, 60_000).ativo).toBe(true);
  });

  it("continua ativo durante o desvanecimento e para depois dele", () => {
    const rastro = montar([[{ tipo: "leitura", id: "a" }, 2000]], 5000);
    expect(quadroDoRastro(rastro, 5000 + DESVANECIMENTO_FINAL_MS - 1).ativo).toBe(true);
    expect(quadroDoRastro(rastro, 5000 + DESVANECIMENTO_FINAL_MS).ativo).toBe(false);
  });

  it("espera a escrita e a faísca pendentes terminarem mesmo após o fim", () => {
    const rastro = montar([[{ tipo: "escrita", id: "n", criada: true }, 5000]], 5100);
    expect(quadroDoRastro(rastro, 5100 + DESVANECIMENTO_FINAL_MS).ativo).toBe(true);
    expect(quadroDoRastro(rastro, 5000 + ECO_DA_ESCRITA_MS).ativo).toBe(false);
  });

  it("espera a última candidata terminar de acender", () => {
    const rastro = montar([[{ tipo: "busca", ids: ["a", "b", "c"] }, 5000]], 5010);
    const acendeATudo = 5000 + 2 * INTERVALO_ENTRE_CANDIDATAS_MS + DURACAO_DA_IGNICAO_MS;
    expect(quadroDoRastro(rastro, acendeATudo - 1).ativo).toBe(true);
    expect(quadroDoRastro(rastro, 5010 + DESVANECIMENTO_FINAL_MS).ativo).toBe(false);
  });
});

describe("caminhoMaisCurto", () => {
  const vizinhos = new Map<string, ReadonlySet<string>>([
    ["a", new Set(["b"])],
    ["b", new Set(["a", "c"])],
    ["c", new Set(["b", "d"])],
    ["d", new Set(["c"])],
    ["ilha", new Set()],
  ]);

  it("devolve só a própria nota quando origem e destino são iguais", () => {
    expect(caminhoMaisCurto(vizinhos, "a", "a")).toEqual(["a"]);
  });

  it("acha o vizinho direto", () => {
    expect(caminhoMaisCurto(vizinhos, "a", "b")).toEqual(["a", "b"]);
  });

  it("acha caminho de dois saltos, inclusive nas duas pontas", () => {
    expect(caminhoMaisCurto(vizinhos, "a", "c")).toEqual(["a", "b", "c"]);
    expect(caminhoMaisCurto(vizinhos, "c", "a")).toEqual(["c", "b", "a"]);
  });

  it("devolve null quando não há caminho", () => {
    expect(caminhoMaisCurto(vizinhos, "a", "ilha")).toBeNull();
    expect(caminhoMaisCurto(vizinhos, "a", "desconhecida")).toBeNull();
  });

  it("devolve null quando o caminho passa de maxPassos", () => {
    expect(caminhoMaisCurto(vizinhos, "a", "d", 2)).toBeNull();
    expect(caminhoMaisCurto(vizinhos, "a", "d", 3)).toEqual(["a", "b", "c", "d"]);
  });

  it("prefere o caminho mais curto quando há mais de um", () => {
    const atalho = new Map<string, ReadonlySet<string>>([
      ["a", new Set(["b", "d"])],
      ["b", new Set(["a", "c"])],
      ["c", new Set(["b", "d"])],
      ["d", new Set(["a", "c"])],
    ]);
    expect(caminhoMaisCurto(atalho, "a", "d")).toEqual(["a", "d"]);
  });

  it("não trava com ciclos", () => {
    const ciclo = new Map<string, ReadonlySet<string>>([
      ["a", new Set(["b"])],
      ["b", new Set(["a", "c"])],
      ["c", new Set(["a", "b"])],
    ]);
    expect(caminhoMaisCurto(ciclo, "a", "x")).toBeNull();
  });
});
