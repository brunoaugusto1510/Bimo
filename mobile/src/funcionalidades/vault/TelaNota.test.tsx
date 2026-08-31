import { render, screen, fireEvent, waitFor, within } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { ProvedorDeServicos } from "@/servicos";
import { notas } from "@/dados/fixtures/notas";
import { useEstadoVault } from "./estado";
import { TelaNota } from "./TelaNota";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));

async function renderizar() {
  return render(
    <ProvedorDeTema>
      <ProvedorDeServicos>
        <TelaNota />
      </ProvedorDeServicos>
    </ProvedorDeTema>,
  );
}

describe("TelaNota", () => {
  // Timers falsos: o TelaNota renderiza o CampoDeGrafo em modo interativo, que
  beforeEach(() => {
    mockPush.mockClear();
    useEstadoVault.setState({ busca: "", noSelecionado: null, alturaDaFolha: 0, alturaMinima: 0, alturaMaxima: 0 });
  });


  it("mostra a contagem de nós no chip de contexto", async () => {
    await renderizar();
    expect(await screen.findByText(`${notas.length} nós`)).toBeOnTheScreen();
  });

  it("mostra o escopo como vault inteiro quando não há seleção", async () => {
    await renderizar();
    expect(await screen.findByText("vault inteiro")).toBeOnTheScreen();
  });

  it("lista as notas recentes", async () => {
    await renderizar();
    expect(await screen.findByText("NOTAS RECENTES")).toBeOnTheScreen();
  });

  it("filtra a lista pela busca", async () => {
    await renderizar();
    // Escopado à folha: o próprio grafo também rotula o nó de maior peso
    // ("Notas atômicas", a nota com mais conexões) com o mesmo texto do
    // título, então `screen.findByText` sem escopo bateria em dois lugares
    // — o rótulo do grafo e o título do cartão. `within` restringe a busca
    // à lista de cartões, que é o que este teste verifica de fato.
    const folha = within(await screen.findByTestId("folha-de-notas"));
    await folha.findByText(notas[0].titulo);
    await fireEvent.changeText(screen.getByPlaceholderText("Buscar no vault..."), notas[0].titulo);
    await waitFor(() => expect(folha.queryByText(notas[1].titulo)).toBeNull());
    expect(folha.getByText(notas[0].titulo)).toBeOnTheScreen();
  });

  it("troca a sobrancelha e o escopo ao selecionar um nó", async () => {
    await renderizar();
    await fireEvent.press(await screen.findByTestId(`alvo-do-no-${notas[0].id}`));
    expect(await screen.findByText("NOTAS CONECTADAS")).toBeOnTheScreen();
    expect(screen.getByText(`vizinhança de '${notas[0].titulo}'`)).toBeOnTheScreen();
  });

  it("mostra Nova Nota sem seleção e Abrir Nota com seleção", async () => {
    await renderizar();
    expect(await screen.findByRole("button", { name: "+ Nova Nota" })).toBeOnTheScreen();
    // findByTestId, não getByTestId: o botão "+ Nova Nota" não depende das
    // notas terem carregado, então a linha acima pode resolver antes do
    // alvo do nó existir — esperar aqui evita uma corrida com o fetch fake
    // de 120ms do vault.
    await fireEvent.press(await screen.findByTestId(`alvo-do-no-${notas[0].id}`));
    expect(await screen.findByRole("button", { name: "Abrir Nota" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Perguntar" })).toBeOnTheScreen();
  });

  it("abre o editor pelo botão Abrir Nota", async () => {
    await renderizar();
    await fireEvent.press(await screen.findByTestId(`alvo-do-no-${notas[0].id}`));
    await fireEvent.press(await screen.findByRole("button", { name: "Abrir Nota" }));
    expect(mockPush).toHaveBeenCalledWith(`/editor/${notas[0].id}`);
  });

  it("recolhe a bandeja ao tocar na alça com ela aberta", async () => {
    await renderizar();
    // A tela mede alça e rodapé no layout; em teste o `onLayout` não dispara,
    // então os limites vêm da reserva e a bandeja abre na média.
    useEstadoVault.setState({ alturaMinima: 100, alturaMaxima: 800, alturaDaFolha: 450 });

    await fireEvent.press(await screen.findByRole("button", { name: "Ajustar altura da lista" }));

    expect(useEstadoVault.getState().alturaDaFolha).toBe(100);
  });
});
