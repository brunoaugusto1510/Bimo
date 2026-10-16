import { describe, expect, it } from "vitest";
import { ABA_DO_GRAFICO, ESTADO_INICIAL, reduzir, type EstadoDoEspaco } from "./estado";
import { CHAVE_DO_ESPACO, carregarEstadoSalvo, lerEstado, salvarEstado, serializarEstado } from "./persistencia";

function estadoComDuasNotas(): EstadoDoEspaco {
  let estado = reduzir(ESTADO_INICIAL, { tipo: "abrir-nota", id: "1" });
  estado = reduzir(estado, { tipo: "abrir-nota", id: "2" });
  return reduzir(estado, { tipo: "abrir-nota", id: "3", novaAba: true });
}

/** Um `localStorage` de mentira, para o teste não depender do navegador. */
function armazenamentoFalso(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
    dados,
  };
}

describe("serializarEstado e lerEstado", () => {
  it("ida e volta devolvem o mesmo estado", () => {
    const estado = estadoComDuasNotas();

    expect(lerEstado(serializarEstado(estado))).toEqual(estado);
  });

  it("devolve null para texto ausente, vazio ou que não é JSON", () => {
    expect(lerEstado(null)).toBeNull();
    expect(lerEstado("")).toBeNull();
    expect(lerEstado("{ quebrado")).toBeNull();
  });

  it("devolve null para um formato que não é o nosso", () => {
    expect(lerEstado("[]")).toBeNull();
    expect(lerEstado(JSON.stringify({ versao: 99, abas: [] }))).toBeNull();
    expect(lerEstado(JSON.stringify({ versao: 1, abas: "x" }))).toBeNull();
  });

  it("descarta só as abas inválidas e mantém as boas", () => {
    const bom = estadoComDuasNotas();
    const texto = JSON.stringify({
      ...JSON.parse(serializarEstado(bom)),
      abas: [
        ...bom.abas,
        { tipo: "nota", chave: "x", historico: { pilha: [], indice: 0 }, modo: "leitura" },
        { tipo: "nota", chave: "y", historico: { pilha: ["1"], indice: 5 }, modo: "leitura" },
        { tipo: "nota", chave: "z", historico: { pilha: [1], indice: 0 }, modo: "leitura" },
        { tipo: "nota", chave: "w", historico: { pilha: ["1"], indice: 0 }, modo: "invalido" },
        { tipo: "desconhecida", chave: "q" },
        null,
      ],
    });

    expect(lerEstado(texto)?.abas).toEqual(bom.abas);
  });

  it("só aceita chaves no formato que nós mesmos geramos, e nunca a do gráfico", () => {
    const base = JSON.parse(serializarEstado(estadoComDuasNotas()));
    const aba = base.abas[0];
    const texto = JSON.stringify({
      ...base,
      abas: [
        aba,
        { ...aba, chave: "grafico" },
        { ...aba, chave: "aba-9007199254740992" },
        { ...aba, chave: "aba-" + "9".repeat(310) },
        { ...aba, chave: "qualquer-coisa" },
      ],
      ativa: "grafico",
    });

    const lido = lerEstado(texto);

    expect(lido?.abas.map((a) => a.chave)).toEqual([aba.chave]);
    expect(lido?.ativa).toBe(ABA_DO_GRAFICO);
  });

  it("não deixa entrar duas abas vazias, duas abas da mesma nota nem recentes repetidas", () => {
    const base = JSON.parse(serializarEstado(estadoComDuasNotas()));
    const nota = base.abas[0];
    const texto = JSON.stringify({
      ...base,
      abas: [
        nota,
        { ...nota, chave: "aba-50" },
        { tipo: "vazia", chave: "aba-51" },
        { tipo: "vazia", chave: "aba-52" },
      ],
      recentes: ["A", "A", "B"],
    });

    const lido = lerEstado(texto);

    expect(lido?.abas.map((aba) => aba.chave)).toEqual([nota.chave, "aba-51"]);
    expect(lido?.recentes).toEqual(["A", "B"]);
  });

  it("guarda o contador de chaves: uma aba fechada não tem a chave reaproveitada depois de recarregar", () => {
    let estado = reduzir(ESTADO_INICIAL, { tipo: "abrir-nota", id: "1" });
    estado = reduzir(estado, { tipo: "abrir-nota", id: "2", novaAba: true });
    estado = reduzir(estado, { tipo: "fechar-aba", chave: estado.abas[1].chave });

    const lido = lerEstado(serializarEstado(estado));
    const depois = reduzir(lido!, { tipo: "abrir-nota", id: "3", novaAba: true });

    expect(depois.abas.map((aba) => aba.chave)).not.toContain("aba-2");
  });

  it("recusa textos de tamanho absurdo dentro de cada campo", () => {
    const base = JSON.parse(serializarEstado(estadoComDuasNotas()));
    const texto = JSON.stringify({ ...base, recentes: ["x".repeat(10_000), "ok"] });

    expect(lerEstado(texto)?.recentes).toEqual(["ok"]);
  });

  it("um histórico legítimo, no limite, sobrevive ao recarregar", () => {
    let estado = ESTADO_INICIAL;
    for (let i = 0; i < 150; i++) estado = reduzir(estado, { tipo: "abrir-nota", id: String(i) });

    const lido = lerEstado(serializarEstado(estado));

    expect(lido?.abas).toEqual(estado.abas);
  });

  it("uma aba ativa que não existe mais vira o gráfico", () => {
    const estado = estadoComDuasNotas();
    const texto = JSON.stringify({ ...JSON.parse(serializarEstado(estado)), ativa: "sumiu" });

    expect(lerEstado(texto)?.ativa).toBe(ABA_DO_GRAFICO);
  });

  it("não deixa chaves repetidas nem recentes demais", () => {
    const estado = estadoComDuasNotas();
    const base = JSON.parse(serializarEstado(estado));
    const texto = JSON.stringify({
      ...base,
      abas: [base.abas[0], base.abas[0]],
      recentes: Array.from({ length: 80 }, (_, i) => String(i)),
    });

    const lido = lerEstado(texto);

    expect(lido?.abas).toHaveLength(1);
    expect(lido?.recentes).toHaveLength(20);
  });

  it("limita o tamanho do que aceita, para um texto adulterado não pesar", () => {
    const base = JSON.parse(serializarEstado(estadoComDuasNotas()));
    const abas = Array.from({ length: 500 }, (_, i) => ({ ...base.abas[0], chave: `aba-${i}` }));

    expect(lerEstado(JSON.stringify({ ...base, abas }))?.abas.length).toBeLessThanOrEqual(50);
  });
});

describe("carregarEstadoSalvo e salvarEstado", () => {
  it("guarda e recupera pela chave do espaço", () => {
    const armazenamento = armazenamentoFalso();
    const estado = estadoComDuasNotas();

    salvarEstado(estado, armazenamento);

    expect(armazenamento.dados.has(CHAVE_DO_ESPACO)).toBe(true);
    expect(carregarEstadoSalvo(armazenamento)).toEqual(estado);
  });

  it("sem nada guardado, devolve null", () => {
    expect(carregarEstadoSalvo(armazenamentoFalso())).toBeNull();
  });

  it("não deixa o armazenamento quebrado (modo privado, cota cheia) derrubar a página", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("cheio");
      },
    };

    expect(carregarEstadoSalvo(quebrado)).toBeNull();
    expect(() => salvarEstado(estadoComDuasNotas(), quebrado)).not.toThrow();
  });
});
