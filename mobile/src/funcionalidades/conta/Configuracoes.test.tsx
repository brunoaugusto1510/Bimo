import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { useEstadoConta } from "./estado";
import { Configuracoes } from "./Configuracoes";

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));

async function renderizar() {
  return render(
    <ProvedorDeTema>
      <Configuracoes />
    </ProvedorDeTema>,
  );
}

describe("Configuracoes", () => {
  it("mostra os três grupos do handoff", async () => {
    await renderizar();
    expect(screen.getByText("GRAFO DE FUNDO")).toBeOnTheScreen();
    expect(screen.getByText("INTELIGÊNCIA")).toBeOnTheScreen();
    expect(screen.getByText("SINCRONIZAÇÃO")).toBeOnTheScreen();
  });

  it("alterna um interruptor", async () => {
    await renderizar();
    const antes = useEstadoConta.getState().interruptores.linksAutomaticos;
    await fireEvent.press(screen.getByRole("switch", { name: "Sugerir links enquanto escrevo" }));
    expect(useEstadoConta.getState().interruptores.linksAutomaticos).toBe(!antes);
  });

  it("troca a densidade e atualiza o hint", async () => {
    await renderizar();
    await fireEvent.press(screen.getByRole("button", { name: "80" }));
    expect(useEstadoConta.getState().densidade).toBe(80);
    expect(screen.getByText("80 nós no campo de fundo")).toBeOnTheScreen();
  });

  it("mostra o status de sync e a versão", async () => {
    await renderizar();
    expect(screen.getByText("Sincronizado")).toBeOnTheScreen();
    expect(screen.getByText("Bimo 1.4.0 · vault local com sincronização")).toBeOnTheScreen();
  });
});
