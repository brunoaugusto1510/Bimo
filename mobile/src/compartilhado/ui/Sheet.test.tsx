import { render, screen, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { Sheet } from "./Sheet";

async function renderizar(elemento: React.ReactElement) {
  return render(<ProvedorDeTema>{elemento}</ProvedorDeTema>);
}

describe("Sheet", () => {
  it("não renderiza o conteúdo quando fechada", async () => {
    await renderizar(
      <Sheet aberta={false} aoFechar={jest.fn()}>
        <Text>Perfil</Text>
      </Sheet>,
    );
    expect(screen.queryByText("Perfil")).toBeNull();
  });

  it("renderiza o conteúdo quando aberta", async () => {
    await renderizar(
      <Sheet aberta aoFechar={jest.fn()}>
        <Text>Perfil</Text>
      </Sheet>,
    );
    expect(screen.getByText("Perfil")).toBeOnTheScreen();
  }, 10000);

  it("fecha ao tocar no backdrop", async () => {
    const aoFechar = jest.fn();
    await renderizar(
      <Sheet aberta aoFechar={aoFechar}>
        <Text>Perfil</Text>
      </Sheet>,
    );
    await fireEvent.press(screen.getByTestId("backdrop-da-sheet"));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("mostra a sobrancelha quando recebida", async () => {
    await renderizar(
      <Sheet aberta aoFechar={jest.fn()} sobrancelha="BIMO NESTA NOTA">
        <Text>Sugerir links</Text>
      </Sheet>,
    );
    expect(screen.getByText("BIMO NESTA NOTA")).toBeOnTheScreen();
  });
});
