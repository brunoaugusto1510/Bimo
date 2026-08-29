import { useEstadoConta } from "./estado";
import { perfil } from "@/dados/fixtures/perfil";

describe("useEstadoConta", () => {
  beforeEach(() =>
    useEstadoConta.setState({
      perfil,
      interruptores: { grafo: true, particulas: true, tagsAutomaticas: true, linksAutomaticos: false, somenteWifi: true },
      densidade: 60,
    }),
  );

  it("começa com os padrões do handoff", () => {
    const { interruptores } = useEstadoConta.getState();
    expect(interruptores.grafo).toBe(true);
    expect(interruptores.particulas).toBe(true);
    expect(interruptores.tagsAutomaticas).toBe(true);
    expect(interruptores.linksAutomaticos).toBe(false);
    expect(interruptores.somenteWifi).toBe(true);
  });

  it("alterna um interruptor sem mexer nos outros", () => {
    useEstadoConta.getState().alternar("linksAutomaticos");
    expect(useEstadoConta.getState().interruptores.linksAutomaticos).toBe(true);
    expect(useEstadoConta.getState().interruptores.grafo).toBe(true);
  });

  it("troca a densidade", () => {
    useEstadoConta.getState().definirDensidade(80);
    expect(useEstadoConta.getState().densidade).toBe(80);
  });

  it("edita o perfil", () => {
    useEstadoConta.getState().definirPerfil({ ...perfil, nome: "Marina A." });
    expect(useEstadoConta.getState().perfil.nome).toBe("Marina A.");
  });
});
