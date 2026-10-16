import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../cliente-de-notas", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("../cliente-de-notas")>()),
  buscarNota: vi.fn(),
  buscarLigacoes: vi.fn(),
}));

import { ErroDoCliente, buscarLigacoes, buscarNota } from "../cliente-de-notas";
import { useLigacoes, useNota } from "./usar-nota";

const RESPOSTA = {
  nota: { id: "1", titulo: "A", pasta: null, tags: [], conteudo: "texto", criadoEm: null, atualizadoEm: null, revisao: 1 },
  capacidades: { escrita: false, datas: false },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useNota", () => {
  it("começa carregando e entrega a nota e as capacidades", async () => {
    vi.mocked(buscarNota).mockResolvedValue(RESPOSTA);

    const { result } = renderHook(() => useNota("1"));
    expect(result.current.estado).toBe("carregando");

    await waitFor(() => expect(result.current.estado).toBe("pronto"));
    expect(result.current.dados).toEqual(RESPOSTA);
  });

  it("sem id, não pede nada e fica parado", () => {
    const { result } = renderHook(() => useNota(null));

    expect(buscarNota).not.toHaveBeenCalled();
    expect(result.current.estado).toBe("carregando");
  });

  it("uma falha vira a mensagem do erro, com o status", async () => {
    vi.mocked(buscarNota).mockRejectedValue(new ErroDoCliente("Nota não encontrada.", 404));

    const { result } = renderHook(() => useNota("9"));

    await waitFor(() => expect(result.current.estado).toBe("erro"));
    expect(result.current.mensagem).toBe("Nota não encontrada.");
    expect(result.current.status).toBe(404);
  });

  it("recarregar pede de novo e volta a carregar", async () => {
    vi.mocked(buscarNota).mockRejectedValueOnce(new ErroDoCliente("Não consegui falar com o servidor."));
    vi.mocked(buscarNota).mockResolvedValueOnce(RESPOSTA);
    const { result } = renderHook(() => useNota("1"));
    await waitFor(() => expect(result.current.estado).toBe("erro"));

    act(() => result.current.recarregar());
    expect(result.current.estado).toBe("carregando");

    await waitFor(() => expect(result.current.estado).toBe("pronto"));
    expect(buscarNota).toHaveBeenCalledTimes(2);
  });

  it("ao trocar de nota, volta a carregar e não mistura com o resultado da anterior", async () => {
    let entregarA: (valor: typeof RESPOSTA) => void = () => {};
    vi.mocked(buscarNota).mockImplementation((id) =>
      id === "A"
        ? new Promise((resolver) => (entregarA = resolver))
        : Promise.resolve({ ...RESPOSTA, nota: { ...RESPOSTA.nota, id: "B", titulo: "B" } }),
    );

    const { result, rerender } = renderHook(({ id }) => useNota(id), { initialProps: { id: "A" } });
    rerender({ id: "B" });
    await waitFor(() => expect(result.current.dados?.nota.titulo).toBe("B"));

    await act(async () => entregarA(RESPOSTA));

    expect(result.current.dados?.nota.titulo).toBe("B");
  });

  it("cancela o pedido quando a nota troca ou o componente sai", async () => {
    const sinais: AbortSignal[] = [];
    vi.mocked(buscarNota).mockImplementation((_id, sinal) => {
      if (sinal) sinais.push(sinal);
      return new Promise(() => {});
    });

    const { rerender, unmount } = renderHook(({ id }) => useNota(id), { initialProps: { id: "A" } });
    rerender({ id: "B" });
    unmount();

    expect(sinais).toHaveLength(2);
    expect(sinais.every((sinal) => sinal.aborted)).toBe(true);
  });
});

describe("useLigacoes", () => {
  it("entrega as ligações da nota", async () => {
    const ligacoes = { ligacoes: { saida: [], entrada: [] }, mencoesSemLigacao: [] };
    vi.mocked(buscarLigacoes).mockResolvedValue(ligacoes);

    const { result } = renderHook(() => useLigacoes("1"));

    await waitFor(() => expect(result.current.estado).toBe("pronto"));
    expect(result.current.dados).toEqual(ligacoes);
    expect(buscarLigacoes).toHaveBeenCalledWith("1", expect.any(AbortSignal));
  });

  it("uma falha das ligações não derruba nada: vira estado de erro para o painel mostrar", async () => {
    vi.mocked(buscarLigacoes).mockRejectedValue(new ErroDoCliente("Não consegui falar com o servidor."));

    const { result } = renderHook(() => useLigacoes("1"));

    await waitFor(() => expect(result.current.estado).toBe("erro"));
  });
});
