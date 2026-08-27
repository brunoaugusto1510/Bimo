import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { notas } from "@/dados/fixtures/notas";
import { useEstadoConta } from "./estado";
import { Perfil } from "./Perfil";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack }) }));

async function renderizar() {
  return render(
    <ProvedorDeTema>
      <Perfil />
    </ProvedorDeTema>,
  );
}

describe("Perfil", () => {
  it("mostra os três cartões de estatística", async () => {
    await renderizar();
    // Espera pelo número, não pelo rótulo "Notas": o rótulo já está na tela
    // no primeiro render (é estático, não depende dos dados), então esperar
    // por ele não provaria que os dados do vault chegaram — mesmo defeito de
    // forma do indicador de digitação que passava com o elemento nunca
    // desenhado.
    expect(await screen.findByText(String(notas.length))).toBeOnTheScreen();
    expect(screen.getByText("Notas")).toBeOnTheScreen();
    expect(screen.getByText("Conexões")).toBeOnTheScreen();
    expect(screen.getByText("Pastas")).toBeOnTheScreen();
  });

  it("edita o nome e salva", async () => {
    await renderizar();
    await fireEvent.changeText(screen.getByLabelText("Nome"), "Marina A.");
    await fireEvent.press(screen.getByRole("button", { name: "Salvar Alterações" }));
    expect(useEstadoConta.getState().perfil.nome).toBe("Marina A.");
  });

  it("tem o campo de instruções para a IA", async () => {
    await renderizar();
    expect(screen.getByLabelText("Como o Bimo deve te tratar")).toBeOnTheScreen();
  });
});
