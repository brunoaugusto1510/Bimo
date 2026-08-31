import { render, screen } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { Composer } from "./Composer";

// O `LinearGradient` vira uma View marcada para dar para afirmar a ausencia
// dele: sem o mock, o componente real nao deixa rastro consultavel na arvore.
jest.mock("expo-linear-gradient", () => {
  const { View: ViewDoRn } = jest.requireActual("react-native");
  return {
    LinearGradient: (props: Record<string, unknown>) => (
      <ViewDoRn testID="protecao-do-dock" {...props} />
    ),
  };
});

async function renderizar() {
  return render(
    <ProvedorDeTema>
      <Composer valor="" aoMudar={() => {}} aoEnviar={() => {}} />
    </ProvedorDeTema>,
  );
}

describe("Composer", () => {
  it("mostra o campo e o botao de enviar", async () => {
    await renderizar();
    expect(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault...")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeOnTheScreen();
  });

  // A faixa de `protecaoDock` cobria 96px de ponta a ponta atras do dock e, no
  // tema escuro, aparecia como um retangulo escuro cortando o fim da conversa.
  // O vidro do proprio dock ja separa o composer do chat; a faixa so somava
  // peso visual.
  it("nao desenha a faixa de protecao atras do dock", async () => {
    await renderizar();
    expect(screen.queryByTestId("protecao-do-dock")).toBeNull();
  });

  it("mantem o vidro do dock", async () => {
    await renderizar();
    expect(screen.getByTestId("vidro-do-dock")).toBeOnTheScreen();
  });

  // O Android Autofill classificava o campo como formulario e abria a faixa de
  // sugestoes inline em cima do teclado — com enderecos de e-mail, num campo de
  // "Pergunte ao Bimo". Essa faixa e desenhada por cima da janela do IME, entao
  // nao entra no `getWindowVisibleDisplayFrame` de onde sai o `screenY` do
  // `keyboardDidShow` (`ReactRootView.java:951` e `:977`): a
  // `AreaQueEvitaTeclado` levantava o composer ate o topo do teclado e a faixa
  // continuava cobrindo o fim dele. Desligar o autofill remove a faixa em vez
  // de compensar uma altura que so existe as vezes.
  it("nao deixa o autofill do Android abrir faixa de sugestoes", async () => {
    await renderizar();
    const campo = screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault...");
    expect(campo.props.autoComplete).toBe("off");
    expect(campo.props.importantForAutofill).toBe("no");
  });
});
