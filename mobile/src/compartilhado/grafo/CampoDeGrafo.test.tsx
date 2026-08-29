import { render, screen } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { CampoDeGrafo } from "./index";

async function renderizar(props: Partial<React.ComponentProps<typeof CampoDeGrafo>> = {}) {
  return render(
    <ProvedorDeTema>
      <CampoDeGrafo modo="ambiente" densidade={60} ligado particulasLigadas pulso={0} crescer={0} {...props} />
    </ProvedorDeTema>,
  );
}

describe("CampoDeGrafo em modo ambiente", () => {
  // Timers falsos: o campo abre um setInterval de 30fps assim que monta. Com
  // timers reais, esse intervalo dispara enquanto o `act()` assíncrono do
  // RNTL v14 ainda está de olho em atualizações pendentes — como ele nunca
  // pára sozinho, o `act()` nunca conclui e o teste estoura o timeout. Isso é
  // adaptação de ambiente (timer real vs. falso), não mudança do que se
  // verifica: as asserções continuam as mesmas.
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "queueMicrotask"] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("desenha o campo quando ligado", async () => {
    await renderizar();
    expect(screen.getByTestId("campo-de-grafo")).toBeOnTheScreen();
  });

  it("não desenha nada quando desligado", async () => {
    await renderizar({ ligado: false });
    expect(screen.queryByTestId("campo-de-grafo")).toBeNull();
  });

  it("não intercepta toques em modo ambiente", async () => {
    await renderizar();
    expect(screen.getByTestId("campo-de-grafo")).toHaveStyle({ pointerEvents: "none" });
  });
});
