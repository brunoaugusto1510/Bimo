import { render, screen, fireEvent } from "@testing-library/react-native";
import { Dimensions, StyleSheet, useColorScheme } from "react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { Intro } from "./Intro";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));

jest.mock("react-native/Libraries/Utilities/useColorScheme");
const useColorSchemeMock = useColorScheme as jest.Mock;

const mockUseVideoPlayer = jest.fn((_fonte: unknown, configurar: (player: unknown) => void) => {
  const player = {
    loop: false,
    muted: true,
    play: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  };
  configurar(player);
  return player;
});

jest.mock("expo-video", () => ({
  useVideoPlayer: (fonte: unknown, configurar: (player: unknown) => void) =>
    mockUseVideoPlayer(fonte, configurar),
  VideoView: require("react-native").View,
}));

// Mesmo caminho relativo usado dentro de Intro.tsx (o arquivo de teste vive na
// mesma pasta) — garante que comparamos com o mesmo modulo de asset resolvido
// pelo Metro/Jest, e nao com um valor arbitrario.
const VIDEO_CLARO = require("../../../assets/videos/intro-claro.mp4");
const VIDEO_ESCURO = require("../../../assets/videos/intro-escuro.mp4");

async function renderizar() {
  return render(
    <ProvedorDeTema>
      <Intro />
    </ProvedorDeTema>,
  );
}

describe("Intro", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockUseVideoPlayer.mockClear();
    useColorSchemeMock.mockReturnValue("light");
  });

  it("oferece pular a intro", async () => {
    await renderizar();
    expect(screen.getByRole("button", { name: "Pular" })).toBeOnTheScreen();
  });

  it("vai para o chat ao pular", async () => {
    await renderizar();
    await fireEvent.press(screen.getByRole("button", { name: "Pular" }));
    expect(mockReplace).toHaveBeenCalledWith("/bimo");
  });

  it("usa o video do tema claro quando o sistema esta em claro", async () => {
    useColorSchemeMock.mockReturnValue("light");
    await renderizar();
    expect(mockUseVideoPlayer).toHaveBeenCalledWith(VIDEO_CLARO, expect.any(Function));
  });

  it("usa o video do tema escuro quando o sistema esta em escuro", async () => {
    useColorSchemeMock.mockReturnValue("dark");
    await renderizar();
    expect(mockUseVideoPlayer).toHaveBeenCalledWith(VIDEO_ESCURO, expect.any(Function));
  });

  // Os dois MP4 sao 1920x1920 — quadrados, matriz identidade no `tkhd`. Numa
  // tela de celular em retrato, `contentFit="cover"` sobre a tela inteira
  // escalava o quadrado pela altura e cortava as laterais: sobrava so a faixa
  // central, ampliada. A caixa quadrada centralizada mantem o quadro inteiro.
  it("mostra o video numa caixa quadrada, sem cortar o quadro", async () => {
    await renderizar();
    const video = screen.getByTestId("video-da-intro");
    const estilo = StyleSheet.flatten(video.props.style) as { width: number; height: number };
    expect(estilo.width).toBe(estilo.height);
    expect(video.props.contentFit).toBe("contain");
  });

  it("nao deixa o quadrado passar da menor dimensao da tela", async () => {
    await renderizar();
    const video = screen.getByTestId("video-da-intro");
    const estilo = StyleSheet.flatten(video.props.style) as { width: number; height: number };
    const { width, height } = Dimensions.get("window");
    expect(estilo.width).toBe(Math.min(width, height));
  });
});
