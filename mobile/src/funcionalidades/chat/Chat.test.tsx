import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
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
  // Timers falsos: o serviço de IA fake responde depois de um atraso simulado.
  // Com timers reais, "mostra o indicador de digitação" fica dependente de
  // carga — a resposta às vezes chega antes da asserção síncrona, e o teste
  // falha só quando a suíte roda inteira. (O motivo antigo era outro: o
  // setInterval de 30fps do campo de grafo, que saiu com a troca para
  // useFrameCallback.)
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

  // O Expo já injeta `android:windowSoftInputMode="adjustResize"`, mas com o
  // edge-to-edge obrigatório do SDK 57 a janela não encolhe mais quando o
  // teclado sobe — o app desenha por trás dele e o composer fica escondido.
  // Quem levanta o composer é a `AreaQueEvitaTeclado`; o cálculo do recuo está
  // coberto em `AreaQueEvitaTeclado.test.tsx`, aqui só se verifica a ligação.
  it("levanta o composer acima do teclado", async () => {
    await renderizar();
    const area = screen.getByTestId("area-que-evita-o-teclado");
    const estilo = StyleSheet.flatten(area.props.style) as { paddingBottom?: number };
    expect(typeof estilo.paddingBottom).toBe("number");
  });
});
