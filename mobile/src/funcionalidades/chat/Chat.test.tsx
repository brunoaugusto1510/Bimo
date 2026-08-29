import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { ProvedorDeServicos, type Servicos } from "@/servicos";
import { servicoVaultFake } from "@/servicos/fake/servicoVaultFake";
import { atraso } from "@/servicos/fake/atraso";
import { notas } from "@/dados/fixtures/notas";
import { useEstadoChat } from "./estado";
import { Chat } from "./Chat";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const servicos: Servicos = {
  vault: servicoVaultFake,
  ia: {
    // Um atraso real (via setTimeout) é proposital aqui: sem ele, a resposta
    // resolve inteira dentro do mesmo laço de microtarefas que o `act()`
    // assíncrono do RNTL v14 drena durante o `fireEvent.press`, e o
    // "digitando" nunca fica observável entre o envio e a resposta — a
    // asserção do indicador de digitação passaria mesmo que ele nunca
    // tivesse sido desenhado. O valor é pequeno para o teste continuar
    // rápido; o `waitFor` abaixo avança os timers falsos até ele resolver.
    conversar: async () => {
      await atraso(50);
      return { texto: "Encontrei 1 nota.", cartoes: [notas[0].id] };
    },
    acaoNaNota: async () => ({ tipo: "resumo", rotulo: "Resumir a nota", texto: "resumo" }),
  },
};

async function renderizar() {
  return render(
    <ProvedorDeTema>
      <ProvedorDeServicos servicos={servicos}>
        <Chat />
      </ProvedorDeServicos>
    </ProvedorDeTema>,
  );
}

describe("Chat", () => {
  // Timers falsos: o Chat renderiza o CampoDeGrafo em modo ambiente, que abre
  // um setInterval de 30fps assim que monta (mesmo motivo do CampoDeGrafo.test.tsx
  // da Task 10). Com timers reais, esse intervalo dispara enquanto o `act()`
  // assíncrono do RNTL v14 ainda está de olho em atualizações pendentes — como
  // ele nunca pára sozinho, o `act()` nunca conclui e o teste estoura o
  // timeout. Isso é adaptação de ambiente, não mudança do que se verifica.
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "queueMicrotask"] });
    mockPush.mockClear();
    useEstadoChat.setState({ mensagens: [], rascunho: "", digitando: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("mostra o placeholder do composer", async () => {
    await renderizar();
    expect(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault...")).toBeOnTheScreen();
  });

  it("envia a mensagem e mostra a bolha do usuário", async () => {
    await renderizar();
    await fireEvent.changeText(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault..."), "notas atômicas");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("notas atômicas")).toBeOnTheScreen();
  });

  it("mostra o indicador de digitação enquanto espera", async () => {
    await renderizar();
    await fireEvent.changeText(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault..."), "oi");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByTestId("indicador-de-digitacao")).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId("indicador-de-digitacao")).toBeNull());
  });

  it("mostra a resposta com um cartão de resultado", async () => {
    await renderizar();
    await fireEvent.changeText(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault..."), "oi");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(notas[0].titulo)).toBeOnTheScreen();
  });

  it("abre o editor ao tocar num cartão", async () => {
    await renderizar();
    await fireEvent.changeText(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault..."), "oi");
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    await fireEvent.press(await screen.findByText(notas[0].titulo));
    expect(mockPush).toHaveBeenCalledWith(`/editor/${notas[0].id}`);
  });

  it("não envia com o composer vazio", async () => {
    await renderizar();
    await fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    expect(useEstadoChat.getState().mensagens).toHaveLength(0);
  });
});
