import { act, render, screen } from "@testing-library/react-native";
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

  // Este teste existe por causa de um bug que passou por todas as outras
  // verificações: o loop chegou a ser escrito com `useFrameCallback` do
  // Reanimated, cujo callback o plugin transforma em worklet — e o loop chama
  // `setNos`, que é dispatch de estado do React. No aparelho isso derruba a
  // tela ("Tried to synchronously call a Remote Function"); em teste passava
  // despercebido, porque o mock do Reanimated nunca executa o callback. Um
  // teste que prova que o campo realmente anda fecha esse buraco.
  it("anda com o passar dos quadros", async () => {
    jest.useFakeTimers();

    try {
      const resultado = await renderizar();
      const desenho = () => JSON.stringify(resultado.toJSON());

      const antes = desenho();
      await act(async () => {
        jest.advanceTimersByTime(200);
      });

      expect(desenho()).not.toBe(antes);
    } finally {
      jest.useRealTimers();
    }
  });
});
