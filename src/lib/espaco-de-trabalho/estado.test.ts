import { describe, expect, it } from "vitest";
import {
  ABA_DO_GRAFICO,
  ESTADO_INICIAL,
  LIMITE_DO_HISTORICO,
  abaAtiva,
  idAtual,
  reduzir,
  type AbaDeNota,
  type Acao,
  type EstadoDoEspaco,
} from "./estado";

function aplicar(acoes: Acao[], inicial: EstadoDoEspaco = ESTADO_INICIAL): EstadoDoEspaco {
  return acoes.reduce(reduzir, inicial);
}

function abasDeNota(estado: EstadoDoEspaco): AbaDeNota[] {
  return estado.abas.filter((aba): aba is AbaDeNota => aba.tipo === "nota");
}

describe("estado inicial", () => {
  it("começa no gráfico, sem abas e sem recentes", () => {
    expect(ESTADO_INICIAL).toMatchObject({ abas: [], ativa: ABA_DO_GRAFICO, recentes: [] });
    expect(abaAtiva(ESTADO_INICIAL)).toBeNull();
  });
});

describe("abrir-nota", () => {
  it("a partir do gráfico, abre uma aba nova e a ativa", () => {
    const estado = aplicar([{ tipo: "abrir-nota", id: "1" }]);

    expect(estado.abas).toHaveLength(1);
    expect(estado.ativa).toBe(estado.abas[0].chave);
    expect(idAtual(estado.abas[0] as AbaDeNota)).toBe("1");
  });

  it("numa aba de nota, navega dentro dela e guarda o histórico", () => {
    const estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2" },
      { tipo: "abrir-nota", id: "3" },
    ]);

    const [aba] = abasDeNota(estado);
    expect(estado.abas).toHaveLength(1);
    expect(aba.historico).toEqual({ pilha: ["1", "2", "3"], indice: 2 });
  });

  it("com novaAba, abre ao lado da aba ativa em vez de navegar nela", () => {
    const estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2", novaAba: true },
    ]);

    expect(abasDeNota(estado).map(idAtual)).toEqual(["1", "2"]);
    expect(estado.ativa).toBe(estado.abas[1].chave);
  });

  it("a nova aba entra logo depois da ativa", () => {
    let estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2", novaAba: true },
      { tipo: "abrir-nota", id: "3", novaAba: true },
    ]);
    estado = reduzir(estado, { tipo: "ativar-aba", chave: estado.abas[0].chave });
    estado = reduzir(estado, { tipo: "abrir-nota", id: "4", novaAba: true });

    expect(abasDeNota(estado).map(idAtual)).toEqual(["1", "4", "2", "3"]);
  });

  it("abrir uma nota que já está aberta em outra aba só a ativa", () => {
    const estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2", novaAba: true },
      { tipo: "abrir-nota", id: "1", novaAba: true },
    ]);

    expect(estado.abas).toHaveLength(2);
    expect(estado.ativa).toBe(estado.abas[0].chave);
  });

  it("numa aba vazia, a nota toma o lugar dela", () => {
    const estado = aplicar([{ tipo: "nova-aba-vazia" }, { tipo: "abrir-nota", id: "1" }]);

    expect(estado.abas).toHaveLength(1);
    expect(estado.abas[0].tipo).toBe("nota");
    expect(estado.ativa).toBe(estado.abas[0].chave);
  });

  it("navegar depois de voltar descarta o que era 'avançar'", () => {
    const estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2" },
      { tipo: "abrir-nota", id: "3" },
      { tipo: "voltar" },
      { tipo: "voltar" },
      { tipo: "abrir-nota", id: "9" },
    ]);

    expect(abasDeNota(estado)[0].historico).toEqual({ pilha: ["1", "9"], indice: 1 });
  });

  it("limita o histórico de uma aba, descartando as notas mais antigas e mantendo a atual", () => {
    const acoes: Acao[] = Array.from({ length: LIMITE_DO_HISTORICO + 30 }, (_, i): Acao => ({ tipo: "abrir-nota", id: String(i) }));

    const aba = abasDeNota(aplicar(acoes))[0];

    expect(aba.historico.pilha).toHaveLength(LIMITE_DO_HISTORICO);
    expect(idAtual(aba)).toBe(String(LIMITE_DO_HISTORICO + 29));
    expect(aba.historico.indice).toBe(LIMITE_DO_HISTORICO - 1);
  });

  it("guarda as recentes, sem repetir, com a última primeiro e no máximo 20", () => {
    const acoes: Acao[] = Array.from({ length: 25 }, (_, i): Acao => ({ tipo: "abrir-nota", id: String(i), novaAba: true }));
    const estado = aplicar([...acoes, { tipo: "abrir-nota", id: "5", novaAba: true }]);

    expect(estado.recentes).toHaveLength(20);
    expect(estado.recentes[0]).toBe("5");
    expect(new Set(estado.recentes).size).toBe(20);
  });

  it("abre as notas novas em modo leitura", () => {
    expect(abasDeNota(aplicar([{ tipo: "abrir-nota", id: "1" }]))[0].modo).toBe("leitura");
  });
});

describe("voltar e avançar", () => {
  const tres = (): EstadoDoEspaco =>
    aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2" },
      { tipo: "abrir-nota", id: "3" },
    ]);

  it("andam pelo histórico da aba ativa", () => {
    let estado = reduzir(tres(), { tipo: "voltar" });
    expect(idAtual(abasDeNota(estado)[0])).toBe("2");

    estado = reduzir(estado, { tipo: "voltar" });
    expect(idAtual(abasDeNota(estado)[0])).toBe("1");

    estado = reduzir(estado, { tipo: "avancar" });
    expect(idAtual(abasDeNota(estado)[0])).toBe("2");
  });

  it("não passam das pontas do histórico", () => {
    const noInicio = aplicar([{ tipo: "voltar" }, { tipo: "voltar" }, { tipo: "voltar" }, { tipo: "voltar" }], tres());
    expect(idAtual(abasDeNota(noInicio)[0])).toBe("1");

    const noFim = aplicar([{ tipo: "avancar" }], tres());
    expect(idAtual(abasDeNota(noFim)[0])).toBe("3");
  });

  it("voltar para uma nota que já está aberta em outra aba ativa essa aba, em vez de duplicá-la", () => {
    let estado = aplicar([
      { tipo: "abrir-nota", id: "X" },
      { tipo: "abrir-nota", id: "Y" },
      { tipo: "abrir-nota", id: "Z", novaAba: true },
      { tipo: "abrir-nota", id: "X" },
    ]);
    estado = reduzir(estado, { tipo: "ativar-aba", chave: estado.abas[0].chave });
    // A segunda aba já mostra X; voltar na primeira (X -> Y) não chega a repetir nada.
    estado = reduzir(estado, { tipo: "voltar" });

    const mostradas = abasDeNota(estado).map(idAtual);
    expect(new Set(mostradas).size).toBe(mostradas.length);
  });

  it("não fazem nada no gráfico", () => {
    expect(reduzir(ESTADO_INICIAL, { tipo: "voltar" })).toBe(ESTADO_INICIAL);
  });
});

describe("fechar-aba", () => {
  const tres = (): EstadoDoEspaco =>
    aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2", novaAba: true },
      { tipo: "abrir-nota", id: "3", novaAba: true },
    ]);

  it("fechar a aba ativa ativa a vizinha da direita", () => {
    let estado = tres();
    estado = reduzir(estado, { tipo: "ativar-aba", chave: estado.abas[1].chave });

    estado = reduzir(estado, { tipo: "fechar-aba", chave: estado.ativa });

    expect(abasDeNota(estado).map(idAtual)).toEqual(["1", "3"]);
    expect(idAtual(abaAtiva(estado) as AbaDeNota)).toBe("3");
  });

  it("fechar a última aba ativa a da esquerda", () => {
    const estado = tres();

    const depois = reduzir(estado, { tipo: "fechar-aba", chave: estado.ativa });

    expect(idAtual(abaAtiva(depois) as AbaDeNota)).toBe("2");
  });

  it("fechar a única aba volta ao gráfico", () => {
    const estado = aplicar([{ tipo: "abrir-nota", id: "1" }]);

    const depois = reduzir(estado, { tipo: "fechar-aba", chave: estado.ativa });

    expect(depois.abas).toEqual([]);
    expect(depois.ativa).toBe(ABA_DO_GRAFICO);
  });

  it("fechar uma aba que não é a ativa não muda qual está ativa", () => {
    const estado = tres();

    const depois = reduzir(estado, { tipo: "fechar-aba", chave: estado.abas[0].chave });

    expect(depois.ativa).toBe(estado.ativa);
  });

  it("ignora uma chave que não existe", () => {
    const estado = tres();

    expect(reduzir(estado, { tipo: "fechar-aba", chave: "nao-existe" })).toBe(estado);
  });
});

describe("ativar-aba e nova-aba-vazia", () => {
  it("ativa o gráfico ou uma aba pela chave", () => {
    let estado = aplicar([{ tipo: "abrir-nota", id: "1" }]);

    estado = reduzir(estado, { tipo: "ativar-aba", chave: ABA_DO_GRAFICO });
    expect(estado.ativa).toBe(ABA_DO_GRAFICO);

    estado = reduzir(estado, { tipo: "ativar-aba", chave: estado.abas[0].chave });
    expect(estado.ativa).toBe(estado.abas[0].chave);
  });

  it("ignora a ativação de uma aba que não existe", () => {
    const estado = aplicar([{ tipo: "abrir-nota", id: "1" }]);

    expect(reduzir(estado, { tipo: "ativar-aba", chave: "nao-existe" })).toBe(estado);
  });

  it("abre uma aba vazia, e uma segunda chamada só volta a ela", () => {
    let estado = reduzir(ESTADO_INICIAL, { tipo: "nova-aba-vazia" });
    expect(estado.abas.map((aba) => aba.tipo)).toEqual(["vazia"]);
    expect(estado.ativa).toBe(estado.abas[0].chave);

    estado = reduzir(estado, { tipo: "ativar-aba", chave: ABA_DO_GRAFICO });
    estado = reduzir(estado, { tipo: "nova-aba-vazia" });

    expect(estado.abas).toHaveLength(1);
    expect(estado.ativa).toBe(estado.abas[0].chave);
  });

  it("as chaves das abas nunca se repetem, mesmo depois de fechar", () => {
    let estado = aplicar([{ tipo: "abrir-nota", id: "1" }]);
    const primeira = estado.abas[0].chave;
    estado = reduzir(estado, { tipo: "fechar-aba", chave: primeira });

    estado = reduzir(estado, { tipo: "abrir-nota", id: "2" });

    expect(estado.abas[0].chave).not.toBe(primeira);
  });
});

describe("alternar-modo", () => {
  it("troca entre leitura e edição na aba pedida", () => {
    let estado = aplicar([{ tipo: "abrir-nota", id: "1" }]);
    const chave = estado.abas[0].chave;

    estado = reduzir(estado, { tipo: "alternar-modo", chave });
    expect(abasDeNota(estado)[0].modo).toBe("edicao");

    estado = reduzir(estado, { tipo: "alternar-modo", chave });
    expect(abasDeNota(estado)[0].modo).toBe("leitura");
  });
});

describe("descartar-inexistentes", () => {
  it("tira do histórico e das recentes as notas que não existem mais", () => {
    const estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2" },
      { tipo: "abrir-nota", id: "3" },
    ]);

    const depois = reduzir(estado, { tipo: "descartar-inexistentes", existentes: new Set(["1", "3"]) });

    expect(abasDeNota(depois)[0].historico).toEqual({ pilha: ["1", "3"], indice: 1 });
    expect(depois.recentes).toEqual(["3", "1"]);
  });

  it("uma aba que ficou sem nenhuma nota some, e a ativa passa para uma vizinha", () => {
    const estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2", novaAba: true },
    ]);

    const depois = reduzir(estado, { tipo: "descartar-inexistentes", existentes: new Set(["1"]) });

    expect(abasDeNota(depois).map(idAtual)).toEqual(["1"]);
    expect(depois.ativa).toBe(depois.abas[0].chave);
  });

  it("se a nota atual some, o histórico fica na vizinha mais próxima", () => {
    const estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2" },
    ]);

    const depois = reduzir(estado, { tipo: "descartar-inexistentes", existentes: new Set(["1"]) });

    expect(abasDeNota(depois)[0].historico).toEqual({ pilha: ["1"], indice: 0 });
  });

  it("a aba ativa que some passa para a vizinha na ordem original, mesmo depois de várias saírem", () => {
    let estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2", novaAba: true },
      { tipo: "abrir-nota", id: "3", novaAba: true },
    ]);
    estado = reduzir(estado, { tipo: "ativar-aba", chave: estado.abas[2].chave });

    const depois = reduzir(estado, { tipo: "descartar-inexistentes", existentes: new Set(["1"]) });

    expect(depois.ativa).toBe(depois.abas[0].chave);
    expect(abasDeNota(depois).map(idAtual)).toEqual(["1"]);
  });

  it("prefere a vizinha da direita que sobrou à da esquerda", () => {
    let estado = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2", novaAba: true },
      { tipo: "abrir-nota", id: "3", novaAba: true },
      { tipo: "abrir-nota", id: "4", novaAba: true },
    ]);
    estado = reduzir(estado, { tipo: "ativar-aba", chave: estado.abas[1].chave });

    const depois = reduzir(estado, { tipo: "descartar-inexistentes", existentes: new Set(["1", "4"]) });

    expect(idAtual(abaAtiva(depois) as AbaDeNota)).toBe("4");
  });

  it("junta repetidos que ficaram lado a lado no histórico, para 'voltar' não parecer parado", () => {
    const estado = aplicar([
      { tipo: "abrir-nota", id: "A" },
      { tipo: "abrir-nota", id: "B" },
      { tipo: "abrir-nota", id: "A" },
    ]);

    const depois = reduzir(estado, { tipo: "descartar-inexistentes", existentes: new Set(["A"]) });

    expect(abasDeNota(depois)[0].historico).toEqual({ pilha: ["A"], indice: 0 });
  });

  it("com a lista de notas vazia, não faz nada: uma lista que ainda não carregou não pode apagar as abas", () => {
    const estado = aplicar([{ tipo: "abrir-nota", id: "1" }]);

    expect(reduzir(estado, { tipo: "descartar-inexistentes", existentes: new Set() })).toBe(estado);
  });

  it("devolve o mesmo estado quando nada some", () => {
    const estado = aplicar([{ tipo: "abrir-nota", id: "1" }]);

    expect(reduzir(estado, { tipo: "descartar-inexistentes", existentes: new Set(["1"]) })).toBe(estado);
  });
});

describe("restaurar", () => {
  it("normaliza uma aba ativa que não existe: vira o gráfico", () => {
    const estado = reduzir(ESTADO_INICIAL, { tipo: "restaurar", estado: { ...ESTADO_INICIAL, ativa: "zzz" } });

    expect(estado.ativa).toBe(ABA_DO_GRAFICO);
  });

  it("uma chave absurdamente grande não faz o contador perder a precisão nem repetir chaves", () => {
    const salvo: EstadoDoEspaco = {
      ...ESTADO_INICIAL,
      abas: [{ tipo: "vazia", chave: "aba-99999999999999999999999" }],
      ativa: "aba-99999999999999999999999",
    };

    let estado = reduzir(ESTADO_INICIAL, { tipo: "restaurar", estado: salvo });
    estado = reduzir(estado, { tipo: "abrir-nota", id: "1", novaAba: true });
    estado = reduzir(estado, { tipo: "abrir-nota", id: "2", novaAba: true });

    const chaves = estado.abas.map((aba) => aba.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("troca o estado pelo restaurado e continua numerando as chaves sem colidir", () => {
    const salvo = aplicar([
      { tipo: "abrir-nota", id: "1" },
      { tipo: "abrir-nota", id: "2", novaAba: true },
    ]);

    let estado = reduzir(ESTADO_INICIAL, { tipo: "restaurar", estado: salvo });
    estado = reduzir(estado, { tipo: "abrir-nota", id: "3", novaAba: true });

    const chaves = estado.abas.map((aba) => aba.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(abasDeNota(estado).map(idAtual)).toEqual(["1", "2", "3"]);
  });
});
