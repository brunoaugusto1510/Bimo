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
