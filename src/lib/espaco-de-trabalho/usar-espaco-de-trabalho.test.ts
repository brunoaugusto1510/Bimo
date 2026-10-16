import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ABA_DO_GRAFICO, ESTADO_INICIAL, reduzir, type AbaDeNota } from "./estado";
import { CHAVE_DO_ESPACO, serializarEstado } from "./persistencia";
import { useEspacoDeTrabalho } from "./usar-espaco-de-trabalho";

const EXISTENTES = new Set(["1", "2", "3"]);

function guardarNoNavegador(...ids: string[]) {
  let estado = ESTADO_INICIAL;
  for (const id of ids) estado = reduzir(estado, { tipo: "abrir-nota", id, novaAba: true });
  localStorage.setItem(CHAVE_DO_ESPACO, serializarEstado(estado));
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useEspacoDeTrabalho", () => {
  it("começa no gráfico, sem abas, quando não há nada guardado", () => {
    const { result } = renderHook(() => useEspacoDeTrabalho(EXISTENTES));

    expect(result.current.estado.abas).toEqual([]);
    expect(result.current.estado.ativa).toBe(ABA_DO_GRAFICO);
  });

  it("restaura as abas guardadas, sem as notas que não existem mais", () => {
    guardarNoNavegador("1", "99", "2");

    const { result } = renderHook(() => useEspacoDeTrabalho(EXISTENTES));

    const notas = result.current.estado.abas.filter((aba): aba is AbaDeNota => aba.tipo === "nota");
    expect(notas.map((aba) => aba.historico.pilha[aba.historico.indice])).toEqual(["1", "2"]);
  });

  it("guarda as mudanças a cada ação", () => {
    const { result } = renderHook(() => useEspacoDeTrabalho(EXISTENTES));

    act(() => result.current.despachar({ tipo: "abrir-nota", id: "3" }));

    expect(localStorage.getItem(CHAVE_DO_ESPACO)).toContain('"3"');
  });

  it("não apaga o que estava guardado antes de restaurá-lo", () => {
    guardarNoNavegador("1", "2");

    renderHook(() => useEspacoDeTrabalho(EXISTENTES));

    expect(localStorage.getItem(CHAVE_DO_ESPACO)).toContain('"1"');
    expect(localStorage.getItem(CHAVE_DO_ESPACO)).toContain('"2"');
  });

  it("uma lista de notas vazia (ainda não carregou) não apaga as abas guardadas", () => {
    guardarNoNavegador("1");

    const { result } = renderHook(() => useEspacoDeTrabalho(new Set<string>()));

    expect(result.current.estado.abas).toHaveLength(1);
  });

  it("ignora um texto guardado que está quebrado", () => {
    localStorage.setItem(CHAVE_DO_ESPACO, "{ quebrado");

    const { result } = renderHook(() => useEspacoDeTrabalho(EXISTENTES));

    expect(result.current.estado.abas).toEqual([]);
  });
});
