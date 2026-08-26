import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { coresClaro } from "@/compartilhado/tema/tokens/cores";
import { Avatar, Botao, Chip, Interruptor, Pill, CampoDeBusca } from "./index";

async function renderizar(elemento: React.ReactElement) {
  return render(<ProvedorDeTema>{elemento}</ProvedorDeTema>);
}

describe("Botao", () => {
  it("dispara aoTocar", async () => {
    const aoTocar = jest.fn();
    await renderizar(<Botao variante="primario" rotulo="Nova Nota" aoTocar={aoTocar} />);
    await fireEvent.press(screen.getByRole("button", { name: "Nova Nota" }));
    expect(aoTocar).toHaveBeenCalledTimes(1);
  });

  it("respeita o alvo de toque mínimo de 44", async () => {
    await renderizar(<Botao variante="primario" rotulo="Abrir Nota" aoTocar={jest.fn()} testID="botao" />);
    expect(screen.getByTestId("botao")).toHaveStyle({ minHeight: 44 });
  });

  it("não dispara quando desabilitado", async () => {
    const aoTocar = jest.fn();
    await renderizar(<Botao variante="outline" rotulo="Perguntar" aoTocar={aoTocar} desabilitado />);
    await fireEvent.press(screen.getByRole("button", { name: "Perguntar" }));
    expect(aoTocar).not.toHaveBeenCalled();
  });
});

describe("Avatar", () => {
  it("mostra as iniciais", async () => {
    await renderizar(<Avatar iniciais="MA" tamanho={32} />);
    expect(screen.getByText("MA")).toBeOnTheScreen();
  });
});

describe("Chip", () => {
  it("usa a família mono", async () => {
    await renderizar(<Chip rotulo="#método" testID="chip" />);
    expect(screen.getByTestId("chip")).toHaveStyle({ fontFamily: "JetBrainsMono_400Regular" });
  });
});

describe("Pill", () => {
  it("pinta o fundo de primária quando ativo", async () => {
    await renderizar(<Pill rotulo="90" ativo aoTocar={jest.fn()} testID="pill" />);
    expect(screen.getByTestId("pill")).toHaveStyle({ backgroundColor: coresClaro.primaria });
  });
});

describe("CampoDeBusca", () => {
  it("chama aoMudar com o texto digitado", async () => {
    const aoMudar = jest.fn();
    await renderizar(<CampoDeBusca valor="" aoMudar={aoMudar} placeholder="Buscar no vault..." />);
    await fireEvent.changeText(screen.getByPlaceholderText("Buscar no vault..."), "atômica");
    expect(aoMudar).toHaveBeenCalledWith("atômica");
  });
});

describe("Interruptor", () => {
  it("inverte o valor ao ser tocado", async () => {
    const aoMudar = jest.fn();
    await renderizar(<Interruptor ligado={false} aoMudar={aoMudar} rotuloAcessivel="Campo do grafo" />);
    await fireEvent.press(screen.getByRole("switch", { name: "Campo do grafo" }));
    expect(aoMudar).toHaveBeenCalledWith(true);
  });

  it("expõe o estado para leitores de tela", async () => {
    await renderizar(<Interruptor ligado aoMudar={jest.fn()} rotuloAcessivel="Partículas de raciocínio" />);
    expect(screen.getByRole("switch", { name: "Partículas de raciocínio" })).toBeChecked();
  });
});
