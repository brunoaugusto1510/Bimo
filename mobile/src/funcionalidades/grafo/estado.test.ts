import { useEstadoGrafo } from "./estado";

describe("useEstadoGrafo", () => {
  beforeEach(() => useEstadoGrafo.setState({ pulso: 0, crescer: 0 }));

  it("incrementa o pulso", () => {
    useEstadoGrafo.getState().pulsar();
    useEstadoGrafo.getState().pulsar();
    expect(useEstadoGrafo.getState().pulso).toBe(2);
  });

  it("incrementa o contador de nós novos", () => {
    useEstadoGrafo.getState().crescerNo();
    expect(useEstadoGrafo.getState().crescer).toBe(1);
  });

  it("mantém os dois contadores independentes", () => {
    useEstadoGrafo.getState().pulsar();
    expect(useEstadoGrafo.getState().crescer).toBe(0);
  });
});
