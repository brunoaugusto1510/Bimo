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
