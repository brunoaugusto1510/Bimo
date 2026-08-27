import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import type { NoDoGrafo } from "@/dados/tipos";
import { GrafoInterativo } from "./implementacao-svg/GrafoInterativo";

const nos: NoDoGrafo[] = [
  { id: "a", titulo: "Notas atômicas", x: 0.5, y: 0.5, peso: 1.4 },
  { id: "b", titulo: "Zettelkasten", x: 0.3, y: 0.4, peso: 0.8 },
];

async function renderizar(props: Partial<React.ComponentProps<typeof GrafoInterativo>> = {}) {
  const aoSelecionarNo = jest.fn();
  await render(
    <ProvedorDeTema>
      <GrafoInterativo nos={nos} arestas={[{ de: "a", para: "b" }]} noSelecionado={null} aoSelecionarNo={aoSelecionarNo} {...props} />
    </ProvedorDeTema>,
  );
  return { aoSelecionarNo };
}

describe("GrafoInterativo", () => {
  it("rotula só os nós de peso 1,2 ou mais", async () => {
    await renderizar();
    expect(screen.getByText("Notas atômicas")).toBeOnTheScreen();
    expect(screen.queryByText("Zettelkasten")).toBeNull();
  });

  it("rotula o nó selecionado mesmo com peso baixo", async () => {
    await renderizar({ noSelecionado: "b" });
    expect(screen.getByText("Zettelkasten")).toBeOnTheScreen();
  });

  it("aceita toque, diferente do modo ambiente", async () => {
    await renderizar();
    expect(screen.getByTestId("grafo-interativo")).toBeOnTheScreen();
  });

  it("seleciona o nó tocado", async () => {
    const { aoSelecionarNo } = await renderizar();
    await fireEvent.press(screen.getByTestId("alvo-do-no-a"));
    expect(aoSelecionarNo).toHaveBeenCalledWith("a");
  });

  it("limpa a seleção ao tocar fora dos nós", async () => {
    const { aoSelecionarNo } = await renderizar({ noSelecionado: "a" });
    await fireEvent.press(screen.getByTestId("fundo-do-grafo"));
    expect(aoSelecionarNo).toHaveBeenCalledWith(null);
  });
});
