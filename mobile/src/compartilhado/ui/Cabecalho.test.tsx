import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { Cabecalho } from "./Cabecalho";

async function renderizar(destinoAtivo: "bimo" | "nota", aoTrocarDestino = jest.fn(), aoAbrirConta = jest.fn()) {
  await render(
    <ProvedorDeTema>
      <Cabecalho destinoAtivo={destinoAtivo} aoTrocarDestino={aoTrocarDestino} aoAbrirConta={aoAbrirConta} iniciais="MA" />
    </ProvedorDeTema>,
  );
  return { aoTrocarDestino, aoAbrirConta };
}

describe("Cabecalho", () => {
  it("mostra os dois destinos", async () => {
    await renderizar("bimo");
    expect(screen.getByRole("button", { name: "Bimo" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Nota" })).toBeOnTheScreen();
  });

  it("marca o destino ativo", async () => {
    await renderizar("nota");
    expect(screen.getByRole("button", { name: "Nota" })).toBeSelected();
    expect(screen.getByRole("button", { name: "Bimo" })).not.toBeSelected();
  });

  it("avisa a troca de destino", async () => {
    const { aoTrocarDestino } = await renderizar("bimo");
    await fireEvent.press(screen.getByRole("button", { name: "Nota" }));
    expect(aoTrocarDestino).toHaveBeenCalledWith("nota");
  });

  it("não avisa quando o destino tocado já é o ativo", async () => {
    const { aoTrocarDestino } = await renderizar("bimo");
    await fireEvent.press(screen.getByRole("button", { name: "Bimo" }));
    expect(aoTrocarDestino).not.toHaveBeenCalled();
  });

  it("abre o menu de conta pelo avatar", async () => {
    const { aoAbrirConta } = await renderizar("bimo");
    await fireEvent.press(screen.getByRole("button", { name: "Abrir menu de conta" }));
    expect(aoAbrirConta).toHaveBeenCalledTimes(1);
  });

  it("tem 56 de altura", async () => {
    await renderizar("bimo");
    expect(screen.getByTestId("cabecalho")).toHaveStyle({ height: 56 });
  });
});
