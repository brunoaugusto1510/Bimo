import { render, screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import type { NoDoGrafo } from "@/dados/tipos";
import { GrafoInterativo } from "./implementacao-svg/GrafoInterativo";

const nos: NoDoGrafo[] = [
  { id: "a", titulo: "Notas atômicas", x: 0.5, y: 0.5, peso: 1.4 },
  { id: "b", titulo: "Zettelkasten", x: 0.3, y: 0.4, peso: 0.8 },
];

async function renderizar(props: Partial<React.ComponentProps<typeof GrafoInterativo>> = {}) {
  const aoSelecionarNo = jest.fn();
  const resultado = await render(
    <ProvedorDeTema>
      <GrafoInterativo nos={nos} arestas={[{ de: "a", para: "b" }]} noSelecionado={null} aoSelecionarNo={aoSelecionarNo} {...props} />
    </ProvedorDeTema>,
  );
  return { aoSelecionarNo, resultado };
}

// Nó da árvore que `RenderResult#toJSON()` devolve — o suficiente para andar
// por ela procurando um `testID`/`type`/prop específico.
type NoDaArvore = { type: string; props: Record<string, unknown>; children: (NoDaArvore | string)[] | null };

function acharTodos(no: NoDaArvore | null, predicado: (no: NoDaArvore) => boolean, achados: NoDaArvore[] = []): NoDaArvore[] {
  if (!no) return achados;
  if (predicado(no)) achados.push(no);
  for (const filho of no.children ?? []) {
    if (typeof filho === "string") continue;
    acharTodos(filho, predicado, achados);
  }
  return achados;
}

function acharPrimeiro(no: NoDaArvore | null, predicado: (no: NoDaArvore) => boolean): NoDaArvore | null {
  if (!no) return null;
  if (predicado(no)) return no;
  for (const filho of no.children ?? []) {
    if (typeof filho === "string") continue;
    const achado = acharPrimeiro(filho, predicado);
    if (achado) return achado;
  }
  return null;
}

describe("GrafoInterativo", () => {
  it("rotula só os nós de peso 1,2 ou mais", async () => {
    await renderizar();
    expect(screen.getByText("Notas atômicas")).toBeOnTheScreen();
    expect(screen.queryByText("Zettelkasten")).toBeNull();
  });

  it("rotula o nó selecionado mesmo com peso baixo", async () => {
    await renderizar({ noSelecionado: "b" });
    expect(screen.getByText("Zettelkasten")).toBeOnTheScreen();
  });

  it("aceita toque, diferente do modo ambiente", async () => {
    await renderizar();
    expect(screen.getByTestId("grafo-interativo")).toBeOnTheScreen();
  });

  it("seleciona o nó tocado", async () => {
    const { aoSelecionarNo } = await renderizar();
    await fireEvent.press(screen.getByTestId("alvo-do-no-a"));
    expect(aoSelecionarNo).toHaveBeenCalledWith("a");
  });

  it("limpa a seleção ao tocar fora dos nós", async () => {
    const { aoSelecionarNo } = await renderizar({ noSelecionado: "a" });
    await fireEvent.press(screen.getByTestId("fundo-do-grafo"));
    expect(aoSelecionarNo).toHaveBeenCalledWith(null);
  });

  it("tocar num alvo de nó dispara só o id, nunca null em seguida", async () => {
    // Isto NÃO prova hit-test por coordenada num aparelho real —
    // `fireEvent.press(testID)` dispara direto no elemento achado, sem
    // passar pela geometria da árvore. O que este teste prova é mais
    // estreito: que o próprio handler de "alvo-do-no-a" nunca encadeia uma
    // segunda chamada com `null` — uma guarda contra uma futura composição
    // tipo `Gesture.Tap()` no container inteiro disparar limpeza de seleção
    // além da seleção do nó, no mesmo evento.
    const { aoSelecionarNo } = await renderizar();
    await fireEvent.press(screen.getByTestId("alvo-do-no-a"));
    expect(aoSelecionarNo).toHaveBeenCalledTimes(1);
    expect(aoSelecionarNo).toHaveBeenCalledWith("a");
    expect(aoSelecionarNo).not.toHaveBeenCalledWith(null);
  });

  describe("empilhamento de toque (regressão: fundo do grafo inalcançável)", () => {
    // Estes dois testes não simulam um toque real — provam a estrutura da
    // árvore renderizada que faz o toque real funcionar. Antes da correção,
    // "fundo-do-grafo" era um IRMÃO ANTES do `GestureDetector`, ou seja,
    // fora da camada de tela cheia (`Animated.View` + `Svg`) que vinha
    // depois dele. Como aquela camada tinha `pointerEvents` no padrão
    // "auto", ela era a view mais à frente sob qualquer toque que não
    // caísse num nó — e ficava com o toque mesmo sem fazer nada com ele. O
    // fundo nunca era alcançado num aparelho real, apesar de
    // `fireEvent.press(getByTestId("fundo-do-grafo"))` passar (ele dispara
    // direto no elemento, ignorando a geometria). A correção: mover o fundo
    // para DENTRO da mesma camada (atrás do Svg) e marcar a camada e o Svg
    // como `pointerEvents="box-none"`, para que nenhum dos dois absorva
    // toques que deveriam cair nos descendentes.
    it("o fundo do grafo é filho da camada com pointerEvents box-none, atrás do Svg", async () => {
      const { resultado } = await renderizar();

      const camada = acharPrimeiro(
        resultado.toJSON() as NoDaArvore,
        (no) => no.type === "View" && no.props.pointerEvents === "box-none",
      );
      expect(camada).not.toBeNull();

      const filhos = (camada!.children ?? []).filter((filho): filho is NoDaArvore => typeof filho !== "string");
      const indiceDoFundo = filhos.findIndex((filho) => filho.props.testID === "fundo-do-grafo");
      const indiceDoSvg = filhos.findIndex((filho) => filho.type.includes("Svg"));

      // Se a regressão voltar (fundo movido para fora desta camada), o
      // fundo some da lista de filhos e este índice vira -1.
      expect(indiceDoFundo).toBeGreaterThanOrEqual(0);
      expect(indiceDoSvg).toBeGreaterThanOrEqual(0);
      // E precisa continuar atrás do Svg (índice menor = renderizado antes
      // = fica atrás no empilhamento do React Native), para não tampar os
      // alvos de toque dos nós, que vêm depois do Svg nesta mesma camada.
      expect(indiceDoFundo).toBeLessThan(indiceDoSvg);
    });

    it("a camada transformada e o Svg são transparentes ao toque (box-none)", async () => {
      const { resultado } = await renderizar();
      const arvore = resultado.toJSON() as NoDaArvore;

      const camada = acharPrimeiro(arvore, (no) => no.type === "View" && no.props.pointerEvents === "box-none");
      const svg = acharPrimeiro(arvore, (no) => no.type.includes("Svg"));

      expect(camada).not.toBeNull();
      expect(svg?.props.pointerEvents).toBe("box-none");
    });
  });

  describe("desenho vindo da simulação", () => {
    // O que dá para observar aqui tem limite: sob o mock do Reanimated,
    // `createAnimatedComponent` é a identidade, então `animatedProps` chega ao
    // `Circle` do react-native-svg, que descarta props que não conhece — a
    // posição do círculo não aparece na árvore. Já `useAnimatedStyle` é
    // invocado na hora e o estilo resultante vai para uma `View` comum, então
    // é pelos alvos de toque que a posição fica observável. É a mesma leitura
    // do mesmo shared value, só o lado testável dele.
    it("desenha um círculo por nó e uma linha por aresta", async () => {
      const { resultado } = await renderizar();
      const arvore = resultado.toJSON() as NoDaArvore;

      expect(acharTodos(arvore, (no) => no.type.includes("Circle"))).toHaveLength(2);
      expect(acharTodos(arvore, (no) => no.type.includes("Line"))).toHaveLength(1);
    });

    it("acrescenta o anel de seleção sem remover o círculo do nó", async () => {
      const { resultado } = await renderizar({ noSelecionado: "a" });
      expect(acharTodos(resultado.toJSON() as NoDaArvore, (no) => no.type.includes("Circle"))).toHaveLength(3);
    });

    it("posiciona os alvos de toque pelas posições da simulação", async () => {
      await renderizar();
      const estilo = StyleSheet.flatten(screen.getByTestId("alvo-do-no-a").parent!.props.style);

      expect(typeof estilo.left).toBe("number");
      expect(typeof estilo.top).toBe("number");
    });

    it("cada nó recebe a sua própria posição, não uma comum", async () => {
      await renderizar();
      const esquerdaDe = (id: string) =>
        StyleSheet.flatten(screen.getByTestId(`alvo-do-no-${id}`).parent!.props.style).left;

      expect(esquerdaDe("a")).not.toBe(esquerdaDe("b"));
    });
  });
});
