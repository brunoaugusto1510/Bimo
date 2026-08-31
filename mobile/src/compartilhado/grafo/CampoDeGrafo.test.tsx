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
  // Timers falsos: o campo mantém um loop de `requestAnimationFrame` vivo
  // enquanto ligado, e com timers reais o `act()` assíncrono do RNTL v14 fica
  // esperando atualizações que não cessam até estourar o timeout.
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "queueMicrotask"] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

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

  // Aqui existia um teste que avançava os quadros e exigia que o desenho
  // mudasse. Ele valia enquanto o loop era `requestAnimationFrame`; agora o
  // campo roda em `useFrameCallback`, que o mock do Reanimated não executa —
  // e um mock que executasse quadros trava a suíte com cascata de timers.
  //
  // O que sobrou coberto: as funções de física em fisica.test.ts (que não
  // precisam de render) e o liga/desliga do loop em useSimulacao.test.ts. Que
  // o campo realmente anda no aparelho é verificação manual.
});

describe("CampoDeGrafo em modo interativo", () => {
  it("não monta o campo decorativo por baixo do grafo real", async () => {
    // Dois grafos em tela cheia empilhados custavam ~240 elementos extras com
    // re-render a 30fps, e a tela de Nota rodava a 9-10fps por causa disso.
    await render(
      <ProvedorDeTema>
        <CampoDeGrafo modo="interativo" densidade={60} ligado particulasLigadas pulso={0} crescer={0} nos={[]} arestas={[]} />
      </ProvedorDeTema>,
    );

    expect(screen.queryByTestId("campo-de-grafo")).toBeNull();
    expect(screen.getByTestId("grafo-interativo")).toBeOnTheScreen();
  });
});
