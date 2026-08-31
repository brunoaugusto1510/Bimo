# Grafo manipulável e bandeja de altura livre — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à bandeja de notas altura livre por arrasto e ao grafo da tela de Nota um motor de física com nós arrastáveis, sem re-render por frame.

**Architecture:** A lógica fica em módulos puros e testáveis (`alturaDaFolha.ts`, `simulacao.ts`, `posicionamento.ts`, `layoutPersistido.ts`); a animação roda na UI thread via shared values do Reanimated, com o motor executando dentro de um `useFrameCallback` e as posições publicadas por double buffering. O React só re-renderiza quando a lista de notas ou arestas muda.

**Tech Stack:** React Native 0.86 / Expo SDK 57, TypeScript strict, Reanimated 4.5, react-native-gesture-handler 2.32, react-native-svg 15.15, zustand 5, Jest + jest-expo + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-08-31-grafo-e-bandeja-design.md`

## Global Constraints

- Todo código em **pt-BR**: nomes de variáveis, funções, tipos, comentários e textos de UI. É a convenção do repositório inteiro.
- Todos os comandos rodam de dentro de `mobile/`.
- **Nenhuma cor literal**: só tokens do tema (`cores.*`). Nenhum valor hex ou `rgba()` novo em componente.
- **Mobile-first**: classes/estilos base para o layout do aparelho; nada de desenho pensado para tela grande.
- Testes ficam ao lado do código que cobrem (`simulacao.ts` → `simulacao.test.ts`).
- Estilo de commit do repositório: `tipo(mobile): assunto no imperativo`, corpo em pt-BR sem acentuação obrigatória, explicando o *porquê*. Trailers `Co-Authored-By:` e `Claude-Session:` como nos commits anteriores.
- A suíte precisa continuar verde a cada commit: `npx jest` e `npx tsc --noEmit`.
- Parâmetros da simulação (valores exatos do spec): repulsão `-30` por unidade de peso, comprimento de repouso da mola `60`, rigidez `0.05`, atração ao centro `0.02`, atrito `0.6`, decaimento do alpha `0.0228`, alpha mínimo `0.001`, alpha ao reaquecer `0.3`.
- Toque longo para pegar o nó: `250` ms.

---

### Task 1: Altura da bandeja — módulo puro

**Files:**
- Create: `mobile/src/funcionalidades/vault/alturaDaFolha.ts`
- Test: `mobile/src/funcionalidades/vault/alturaDaFolha.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `proximaAltura(atual: number, delta: number, minima: number, maxima: number): number`, `alturaMedia(minima: number, maxima: number): number`, `alternarAltura(atual: number, minima: number, maxima: number): number`. As três levam a diretiva `"worklet"` porque a Task 3 as chama de dentro de um gesto, que roda na UI thread.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// mobile/src/funcionalidades/vault/alturaDaFolha.test.ts
import { alternarAltura, alturaMedia, proximaAltura } from "./alturaDaFolha";

describe("proximaAltura", () => {
  it("soma o delta dentro da faixa", () => {
    expect(proximaAltura(300, 50, 100, 800)).toBe(350);
  });

  it("trava no mínimo", () => {
    expect(proximaAltura(120, -200, 100, 800)).toBe(100);
  });

  it("trava no máximo", () => {
    expect(proximaAltura(700, 500, 100, 800)).toBe(800);
  });
});

describe("alturaMedia", () => {
  it("é o ponto médio entre mínimo e máximo", () => {
    expect(alturaMedia(100, 800)).toBe(450);
  });
});

describe("alternarAltura", () => {
  it("sobe para a média quando está no mínimo", () => {
    expect(alternarAltura(100, 100, 800)).toBe(450);
  });

  it("recolhe para o mínimo quando está acima dele", () => {
    expect(alternarAltura(600, 100, 800)).toBe(100);
  });

  it("trata diferença de arredondamento como 'está no mínimo'", () => {
    // A altura vem de medida de layout, então chega com fração; sem a
    // tolerância, 100.4 contaria como "acima do mínimo" e o toque
    // recolheria para 100 em vez de abrir.
    expect(alternarAltura(100.4, 100, 800)).toBe(450);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/funcionalidades/vault/alturaDaFolha.test.ts`
Expected: FAIL — `Cannot find module './alturaDaFolha'`.

- [ ] **Step 3: Implementar**

```ts
// mobile/src/funcionalidades/vault/alturaDaFolha.ts

// A altura vem de `onLayout`, então chega fracionária. Um pixel de folga
// evita que 100.4 conte como "o usuário já abriu a bandeja".
const TOLERANCIA = 1;

export function proximaAltura(atual: number, delta: number, minima: number, maxima: number): number {
  "worklet";
  return Math.min(maxima, Math.max(minima, atual + delta));
}

export function alturaMedia(minima: number, maxima: number): number {
  "worklet";
  return (minima + maxima) / 2;
}

export function alternarAltura(atual: number, minima: number, maxima: number): number {
  "worklet";
  return atual > minima + TOLERANCIA ? minima : alturaMedia(minima, maxima);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/funcionalidades/vault/alturaDaFolha.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 5: Commitar**

```bash
git add src/funcionalidades/vault/alturaDaFolha.ts src/funcionalidades/vault/alturaDaFolha.test.ts
git commit -m "feat(mobile): modulo puro de altura da bandeja"
```

---

### Task 2: Estado do vault — altura contínua no lugar dos três passos

**Files:**
- Modify: `mobile/src/funcionalidades/vault/estado.ts`
- Test: `mobile/src/funcionalidades/vault/estado.test.ts`

**Interfaces:**
- Consumes: `alturaMedia` da Task 1.
- Produces: store `useEstadoVault` com `alturaDaFolha: number`, `alturaMinima: number`, `alturaMaxima: number`, `definirAlturaDaFolha(altura: number): void`, `definirLimitesDaFolha(minima: number, maxima: number): void`. `PassoDaFolha` e `avancarPasso` deixam de existir — a Task 3 e a Task 9 dependem desses nomes exatos.

- [ ] **Step 1: Escrever os testes que falham**

Abrir `estado.test.ts` e substituir os casos que citam `passoDaFolha`/`avancarPasso` por estes (os testes de `busca` e de seleção que já existem no arquivo permanecem):

```ts
describe("altura da folha", () => {
  beforeEach(() => {
    useEstadoVault.setState({
      alturaDaFolha: 0,
      alturaMinima: 0,
      alturaMaxima: 0,
      noSelecionado: null,
    });
  });

  it("guarda a altura definida pelo arrasto", () => {
    useEstadoVault.getState().definirAlturaDaFolha(420);
    expect(useEstadoVault.getState().alturaDaFolha).toBe(420);
  });

  it("ao receber os limites pela primeira vez, abre na altura média", () => {
    // A folha nasce sem medida (0). Quando o layout real chega, ela precisa
    // de uma altura utilizável — abrir no mínimo esconderia a lista inteira
    // logo na entrada da tela.
    useEstadoVault.getState().definirLimitesDaFolha(100, 800);
    expect(useEstadoVault.getState().alturaDaFolha).toBe(450);
  });

  it("ao receber limites de novo, reclampa sem descartar a altura escolhida", () => {
    useEstadoVault.getState().definirLimitesDaFolha(100, 800);
    useEstadoVault.getState().definirAlturaDaFolha(700);
    useEstadoVault.getState().definirLimitesDaFolha(100, 500);
    expect(useEstadoVault.getState().alturaDaFolha).toBe(500);
  });

  it("selecionar um nó sobe a bandeja até a média quando ela está mais baixa", () => {
    useEstadoVault.getState().definirLimitesDaFolha(100, 800);
    useEstadoVault.getState().definirAlturaDaFolha(120);
    useEstadoVault.getState().selecionarNo("a");
    expect(useEstadoVault.getState().alturaDaFolha).toBe(450);
  });

  it("selecionar um nó não abaixa a bandeja que já está alta", () => {
    useEstadoVault.getState().definirLimitesDaFolha(100, 800);
    useEstadoVault.getState().definirAlturaDaFolha(760);
    useEstadoVault.getState().selecionarNo("a");
    expect(useEstadoVault.getState().alturaDaFolha).toBe(760);
  });

  it("limpar a seleção não mexe na altura", () => {
    useEstadoVault.getState().definirLimitesDaFolha(100, 800);
    useEstadoVault.getState().definirAlturaDaFolha(300);
    useEstadoVault.getState().selecionarNo(null);
    expect(useEstadoVault.getState().alturaDaFolha).toBe(300);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/funcionalidades/vault/estado.test.ts`
Expected: FAIL — `definirAlturaDaFolha is not a function`.

- [ ] **Step 3: Implementar**

```ts
// mobile/src/funcionalidades/vault/estado.ts
import { create } from "zustand";
import { alturaMedia } from "./alturaDaFolha";

type EstadoVault = {
  busca: string;
  noSelecionado: string | null;
  // Em pixels. Zero significa "o layout ainda não chegou": a folha só ganha
  // altura real quando `definirLimitesDaFolha` é chamado pelo onLayout.
  alturaDaFolha: number;
  alturaMinima: number;
  alturaMaxima: number;
  definirBusca: (texto: string) => void;
  selecionarNo: (id: string | null) => void;
  limparSelecao: () => void;
  definirAlturaDaFolha: (altura: number) => void;
  definirLimitesDaFolha: (minima: number, maxima: number) => void;
};

export const useEstadoVault = create<EstadoVault>((set) => ({
  busca: "",
  noSelecionado: null,
  alturaDaFolha: 0,
  alturaMinima: 0,
  alturaMaxima: 0,

  definirBusca: (texto) => set({ busca: texto }),

  selecionarNo: (id) =>
    set((estado) => {
      if (id === null) return { noSelecionado: null };
      const media = alturaMedia(estado.alturaMinima, estado.alturaMaxima);
      // Selecionar um nó filtra a lista para a vizinhança dele; se a bandeja
      // estiver recolhida, o resultado do toque ficaria invisível.
      return { noSelecionado: id, alturaDaFolha: Math.max(estado.alturaDaFolha, media) };
    }),

  limparSelecao: () => set({ noSelecionado: null }),

  definirAlturaDaFolha: (altura) => set({ alturaDaFolha: altura }),

  definirLimitesDaFolha: (minima, maxima) =>
    set((estado) => ({
      alturaMinima: minima,
      alturaMaxima: maxima,
      alturaDaFolha:
        estado.alturaDaFolha === 0
          ? alturaMedia(minima, maxima)
          : Math.min(maxima, Math.max(minima, estado.alturaDaFolha)),
    })),
}));
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/funcionalidades/vault/estado.test.ts`
Expected: PASS.

- [ ] **Step 5: Ver o que quebrou no resto**

Run: `npx tsc --noEmit`
Expected: erros em `FolhaDeNotas.tsx`, `FolhaDeNotas.test.tsx` e `TelaNota.tsx`, que ainda usam `passo`/`aoAvancarPasso`. É esperado — a Task 3 os conserta. **Não commitar ainda**; esta task e a Task 3 fecham juntas no commit da Task 3.

---

### Task 3: Bandeja com arrasto, toque e mínimo medido

**Files:**
- Modify: `mobile/src/funcionalidades/vault/componentes/FolhaDeNotas.tsx`
- Modify: `mobile/src/funcionalidades/vault/TelaNota.tsx`
- Test: `mobile/src/funcionalidades/vault/componentes/FolhaDeNotas.test.tsx`

**Interfaces:**
- Consumes: `proximaAltura`, `alternarAltura` (Task 1); `useEstadoVault` com os campos da Task 2.
- Produces: `FolhaDeNotas` com as props `altura: number`, `alturaMinima: number`, `alturaMaxima: number`, `aoArrastar(altura: number): void`, `aoMedirMinimo(altura: number): void`. As props `passo` e `aoAvancarPasso` somem.

- [ ] **Step 1: Escrever os testes que falham**

Substituir em `FolhaDeNotas.test.tsx` o `propsPadrao` e os casos de passo:

```ts
function propsPadrao(sobrescritas: Partial<PropsDaFolha> = {}): PropsDaFolha {
  return {
    notas: [],
    busca: "",
    aoBuscar: jest.fn(),
    noSelecionado: null,
    aoSelecionarNota: jest.fn(),
    aoLimparSelecao: jest.fn(),
    altura: 450,
    alturaMinima: 100,
    alturaMaxima: 800,
    aoArrastar: jest.fn(),
    aoMedirMinimo: jest.fn(),
    aoAbrirNota: jest.fn(),
    aoPerguntar: jest.fn(),
    ...sobrescritas,
  };
}

describe("altura", () => {
  it("aplica a altura recebida", () => {
    render(elemento({ altura: 320 }));
    const folha = screen.getByTestId("folha-de-notas");
    expect(StyleSheet.flatten(folha.props.style)).toEqual(expect.objectContaining({ height: 320 }));
  });

  it("soma alça e rodapé e reporta o total como mínimo", () => {
    // Os dois não são irmãos adjacentes — o miolo fica entre eles —, então
    // não dá para medir o mínimo com um `onLayout` só.
    const aoMedirMinimo = jest.fn();
    render(elemento({ aoMedirMinimo }));
    fireEvent(screen.getByTestId("alca-da-folha"), "layout", { nativeEvent: { layout: { height: 44 } } });
    fireEvent(screen.getByTestId("rodape-da-folha"), "layout", { nativeEvent: { layout: { height: 88 } } });
    expect(aoMedirMinimo).toHaveBeenLastCalledWith(132);
  });

  it("não reporta mínimo enquanto só uma das duas medidas chegou", () => {
    const aoMedirMinimo = jest.fn();
    render(elemento({ aoMedirMinimo }));
    fireEvent(screen.getByTestId("alca-da-folha"), "layout", { nativeEvent: { layout: { height: 44 } } });
    expect(aoMedirMinimo).not.toHaveBeenCalled();
  });

  it("o miolo comprime até sumir, o rodapé não", () => {
    // É isto que faz o mínimo mostrar só alça + botão: o miolo tem
    // `flex: 1, minHeight: 0` e o rodapé fica fora do que encolhe.
    render(elemento());
    const miolo = StyleSheet.flatten(screen.getByTestId("miolo-da-folha").props.style);
    expect(miolo).toEqual(expect.objectContaining({ flex: 1, minHeight: 0 }));
  });

  it("toque na alça alterna para a média quando está no mínimo", () => {
    const aoArrastar = jest.fn();
    render(elemento({ altura: 100, aoArrastar }));
    fireEvent.press(screen.getByTestId("alca-da-folha"));
    expect(aoArrastar).toHaveBeenCalledWith(450);
  });

  it("toque na alça recolhe para o mínimo quando está aberta", () => {
    const aoArrastar = jest.fn();
    render(elemento({ altura: 600, aoArrastar }));
    fireEvent.press(screen.getByTestId("alca-da-folha"));
    expect(aoArrastar).toHaveBeenCalledWith(100);
  });
});
```

O arquivo já importa `render` e `screen`; acrescentar `fireEvent` de `@testing-library/react-native` e `StyleSheet` de `react-native`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/funcionalidades/vault/componentes/FolhaDeNotas.test.tsx`
Expected: FAIL — a folha ainda espera `passo`, e não existe `testID="base-da-folha"`.

- [ ] **Step 3: Implementar a folha**

Trocar o cálculo por fração e o `Pressable` da alça por gesto. Pontos obrigatórios:

```tsx
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { alternarAltura, proximaAltura } from "../alturaDaFolha";

const altura = useSharedValue(props.altura);

// A prop é a fonte assentada (store); o shared value é o que se move
// durante o gesto. Quando a altura muda por fora do arrasto — seleção de
// nó, toque, rotação — o shared value precisa acompanhar.
useEffect(() => {
  altura.value = withTiming(props.altura, {
    duration: movimento.duracaoLenta,
    easing: movimento.curvaPadrao,
  });
}, [props.altura, altura, movimento]);

const arrastar = Gesture.Pan()
  .onChange((evento) => {
    // Dedo para cima (changeY negativo) = bandeja maior, por isso o sinal.
    altura.value = proximaAltura(altura.value, -evento.changeY, props.alturaMinima, props.alturaMaxima);
  })
  .onEnd(() => {
    // Só ao soltar o valor volta para o store: gravar por frame
    // re-renderizaria a árvore inteira 120 vezes por segundo.
    runOnJS(props.aoArrastar)(altura.value);
  });

const tocar = Gesture.Tap().onEnd(() => {
  runOnJS(props.aoArrastar)(alternarAltura(altura.value, props.alturaMinima, props.alturaMaxima));
});

const gestos = Gesture.Exclusive(arrastar, tocar);

const estilo = useAnimatedStyle(() => ({ height: altura.value }));
```

Estrutura de layout dentro do `<Vidro>`:

```tsx
// As duas medidas chegam em eventos separados; o mínimo só é reportado
// quando as duas existem, senão o store receberia um mínimo pela metade e
// clamparia a bandeja no lugar errado por um quadro.
const medidas = useRef<{ alca: number | null; rodape: number | null }>({ alca: null, rodape: null });

function medir(parte: "alca" | "rodape", altura: number) {
  medidas.current[parte] = altura;
  const { alca, rodape } = medidas.current;
  if (alca !== null && rodape !== null) props.aoMedirMinimo(alca + rodape);
}

<GestureDetector gesture={gestos}>
  <View
    testID="alca-da-folha"
    accessibilityRole="button"
    accessibilityLabel="Ajustar altura da lista"
    onLayout={(e) => medir("alca", e.nativeEvent.layout.height)}
    style={{ minHeight: espacamento.alvoDeToque, paddingTop: espacamento.sm, paddingBottom: espacamento.xs, alignItems: "center", justifyContent: "center" }}
  >
    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: cores.contorno, opacity: 0.45 }} />
  </View>
</GestureDetector>

<View testID="miolo-da-folha" style={{ flex: 1, minHeight: 0 }}>
  {/* busca + sobrancelha + FlatList, como já estão */}
</View>

<View
  testID="rodape-da-folha"
  onLayout={(e) => medir("rodape", e.nativeEvent.layout.height)}
  style={{ flexDirection: "row", gap: espacamento.sm, paddingHorizontal: espacamento.md, paddingBottom: espacamento.md }}
>
  {/* os botões como já estão — sem `flex`, para não encolher */}
</View>
```

Manter a reserva para teste, pelo mesmo motivo já documentado no arquivo: `onLayout` não dispara no ambiente de teste, então sem um valor de partida a folha calcularia altura zero e nenhum cartão apareceria.

- [ ] **Step 4: Ligar em `TelaNota.tsx`**

```tsx
const alturaDaFolha = useEstadoVault((estado) => estado.alturaDaFolha);
const alturaMinima = useEstadoVault((estado) => estado.alturaMinima);
const alturaMaxima = useEstadoVault((estado) => estado.alturaMaxima);
const definirAlturaDaFolha = useEstadoVault((estado) => estado.definirAlturaDaFolha);
const definirLimitesDaFolha = useEstadoVault((estado) => estado.definirLimitesDaFolha);

// `alturaDisponivel` (a altura da tela, do onLayout que já existe) é o
// máximo: a bandeja em tela cheia.
useEffect(() => {
  if (alturaDisponivel > 0 && minimoMedido > 0) definirLimitesDaFolha(minimoMedido, alturaDisponivel);
}, [alturaDisponivel, minimoMedido, definirLimitesDaFolha]);
```

Seletores pontuais, não destructuring do store inteiro — é o padrão que o commit `4a1d5a7` estabeleceu para evitar re-render do campo de grafo.

- [ ] **Step 5: Rodar tudo**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS na suíte inteira, tsc limpo.

- [ ] **Step 6: Commitar (fecha as Tasks 2 e 3)**

```bash
git add src/funcionalidades/vault/
git commit -m "feat(mobile): bandeja de altura livre por arrasto na alca"
```

---

### Task 4: Motor de simulação

**Files:**
- Create: `mobile/src/compartilhado/grafo/simulacao.ts`
- Test: `mobile/src/compartilhado/grafo/simulacao.test.ts`

**Interfaces:**
- Consumes: `NoDoGrafo` e `Aresta` de `@/dados/tipos`.
- Produces: os tipos `NoSimulado` e `EstadoSimulacao` e as funções `criarSimulacao`, `avancarSimulacao`, `fixarNo`, `liberarNo`, `reaquecer`, `esfriou`, com as assinaturas exatas mostradas no Step 3. As Tasks 5, 6 e 8 dependem desses nomes.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// mobile/src/compartilhado/grafo/simulacao.test.ts
import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import { avancarSimulacao, criarSimulacao, esfriou, fixarNo, liberarNo, reaquecer } from "./simulacao";

const LARGURA = 400;
const ALTURA = 800;

function doisNos(): NoDoGrafo[] {
  return [
    { id: "a", titulo: "A", x: 0.2, y: 0.5, peso: 1 },
    { id: "b", titulo: "B", x: 0.8, y: 0.5, peso: 1 },
  ];
}

function distancia(estado: ReturnType<typeof criarSimulacao>): number {
  return Math.hypot(estado.nos[0].x - estado.nos[1].x, estado.nos[0].y - estado.nos[1].y);
}

function avancar(estado: ReturnType<typeof criarSimulacao>, passos: number) {
  for (let i = 0; i < passos; i += 1) avancarSimulacao(estado, 16.67);
}

describe("criarSimulacao", () => {
  it("posiciona os nós em pixels, não nas coordenadas normalizadas", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    expect(estado.nos[0].x).toBeGreaterThan(1);
    expect(estado.nos.every((no) => no.fixo === false)).toBe(true);
  });

  it("resolve as arestas para índices uma única vez", () => {
    const arestas: Aresta[] = [{ de: "a", para: "b" }];
    expect(criarSimulacao(doisNos(), arestas, LARGURA, ALTURA).ligacoes).toEqual([[0, 1]]);
  });

  it("descarta aresta cuja ponta não existe entre os nós", () => {
    const arestas: Aresta[] = [{ de: "a", para: "sumiu" }];
    expect(criarSimulacao(doisNos(), arestas, LARGURA, ALTURA).ligacoes).toEqual([]);
  });
});

describe("avancarSimulacao", () => {
  it("a mola aproxima nós ligados e distantes", () => {
    const estado = criarSimulacao(doisNos(), [{ de: "a", para: "b" }], LARGURA, ALTURA);
    const antes = distancia(estado);
    avancar(estado, 60);
    expect(distancia(estado)).toBeLessThan(antes);
  });

  it("a repulsão afasta nós sobrepostos e sem ligação", () => {
    const nos: NoDoGrafo[] = [
      { id: "a", titulo: "A", x: 0.5, y: 0.5, peso: 1 },
      { id: "b", titulo: "B", x: 0.5, y: 0.5, peso: 1 },
    ];
    const estado = criarSimulacao(nos, [], LARGURA, ALTURA);
    avancar(estado, 30);
    expect(distancia(estado)).toBeGreaterThan(0);
  });

  it("muta o estado recebido em vez de devolver um novo", () => {
    // A mutação in-place é deliberada: a 120 Hz, alocar um array de nós por
    // frame gera lixo que o GC recolhe 120 vezes por segundo.
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    const mesmoArray = estado.nos;
    const mesmoNo = estado.nos[0];
    avancar(estado, 1);
    expect(estado.nos).toBe(mesmoArray);
    expect(estado.nos[0]).toBe(mesmoNo);
  });

  it("o alpha decai e a simulação esfria", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    expect(esfriou(estado)).toBe(false);
    avancar(estado, 400);
    expect(esfriou(estado)).toBe(true);
  });
});

describe("nó fixo", () => {
  it("não se move nem acumula velocidade enquanto está fixo", () => {
    const estado = criarSimulacao(doisNos(), [{ de: "a", para: "b" }], LARGURA, ALTURA);
    fixarNo(estado, "a", 123, 456);
    avancar(estado, 30);
    expect(estado.nos[0].x).toBe(123);
    expect(estado.nos[0].y).toBe(456);
    expect(estado.nos[0].vx).toBe(0);
  });

  it("volta a se mover depois de liberado", () => {
    const estado = criarSimulacao(doisNos(), [{ de: "a", para: "b" }], LARGURA, ALTURA);
    fixarNo(estado, "a", 123, 456);
    avancar(estado, 5);
    liberarNo(estado, "a");
    reaquecer(estado, 0.3);
    avancar(estado, 30);
    expect(estado.nos[0].x).not.toBe(123);
  });

  it("fixar um id que não existe não quebra", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    expect(() => fixarNo(estado, "sumiu", 1, 2)).not.toThrow();
  });
});

describe("reaquecer", () => {
  it("devolve alpha a um grafo já frio", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    avancar(estado, 400);
    reaquecer(estado, 0.3);
    expect(esfriou(estado)).toBe(false);
  });

  it("nunca reduz o alpha de um grafo ainda quente", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    reaquecer(estado, 0.3);
    expect(estado.alpha).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/compartilhado/grafo/simulacao.test.ts`
Expected: FAIL — `Cannot find module './simulacao'`.

- [ ] **Step 3: Implementar**

```ts
// mobile/src/compartilhado/grafo/simulacao.ts
import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import { posicionarNo } from "./posicionamento";

const REPULSAO = -30;
const COMPRIMENTO_DA_MOLA = 60;
const RIGIDEZ = 0.05;
const ATRACAO_AO_CENTRO = 0.02;
const ATRITO = 0.6;
const DECAIMENTO_DO_ALPHA = 0.0228;
const ALPHA_MINIMO = 0.001;
// Dois nós exatamente sobrepostos não têm direção de repulsão definida.
// Este piso evita divisão por zero e dá um empurrão determinístico.
const DISTANCIA_MINIMA = 1;
const MILISSEGUNDOS_POR_QUADRO = 16.67;
const PASSO_MAXIMO = 2;

export type NoSimulado = {
  id: string; x: number; y: number; vx: number; vy: number; peso: number; fixo: boolean;
};

export type EstadoSimulacao = {
  nos: NoSimulado[];
  ligacoes: [number, number][];
  alpha: number;
  largura: number;
  altura: number;
};

export function criarSimulacao(nos: NoDoGrafo[], arestas: Aresta[], largura: number, altura: number): EstadoSimulacao {
  const indicePorId = new Map(nos.map((no, indice) => [no.id, indice]));

  return {
    nos: nos.map((no) => {
      const { x, y } = posicionarNo(no, largura, altura);
      return { id: no.id, x, y, vx: 0, vy: 0, peso: no.peso, fixo: false };
    }),
    ligacoes: arestas.flatMap((aresta): [number, number][] => {
      const de = indicePorId.get(aresta.de);
      const para = indicePorId.get(aresta.para);
      // Aresta que aponta para nota que sumiu do vault é descartada.
      return de === undefined || para === undefined ? [] : [[de, para]];
    }),
    alpha: 1,
    largura,
    altura,
  };
}

export function avancarSimulacao(estado: EstadoSimulacao, dt: number): void {
  "worklet";
  const passo = Math.min(dt / MILISSEGUNDOS_POR_QUADRO, PASSO_MAXIMO);
  const { nos, alpha } = estado;
  const centroX = estado.largura / 2;
  const centroY = estado.altura / 2;

  for (let a = 0; a < nos.length; a += 1) {
    for (let b = a + 1; b < nos.length; b += 1) {
      const primeiro = nos[a];
      const segundo = nos[b];
      let dx = segundo.x - primeiro.x;
      let dy = segundo.y - primeiro.y;
      let distancia = Math.hypot(dx, dy);
      if (distancia < DISTANCIA_MINIMA) {
        dx = DISTANCIA_MINIMA;
        dy = 0;
        distancia = DISTANCIA_MINIMA;
      }
      const forca = (REPULSAO * primeiro.peso * segundo.peso * alpha) / (distancia * distancia);
      const fx = (dx / distancia) * forca;
      const fy = (dy / distancia) * forca;
      primeiro.vx -= fx;
      primeiro.vy -= fy;
      segundo.vx += fx;
      segundo.vy += fy;
    }
  }

  for (let i = 0; i < estado.ligacoes.length; i += 1) {
    const primeiro = nos[estado.ligacoes[i][0]];
    const segundo = nos[estado.ligacoes[i][1]];
    const dx = segundo.x - primeiro.x;
    const dy = segundo.y - primeiro.y;
    const distancia = Math.max(Math.hypot(dx, dy), DISTANCIA_MINIMA);
    const forca = RIGIDEZ * (distancia - COMPRIMENTO_DA_MOLA) * alpha;
    const fx = (dx / distancia) * forca;
    const fy = (dy / distancia) * forca;
    primeiro.vx += fx;
    primeiro.vy += fy;
    segundo.vx -= fx;
    segundo.vy -= fy;
  }

  for (let i = 0; i < nos.length; i += 1) {
    const no = nos[i];
    if (no.fixo) {
      no.vx = 0;
      no.vy = 0;
      continue;
    }
    no.vx += (centroX - no.x) * ATRACAO_AO_CENTRO * alpha;
    no.vy += (centroY - no.y) * ATRACAO_AO_CENTRO * alpha;
    no.vx *= ATRITO;
    no.vy *= ATRITO;
    no.x += no.vx * passo;
    no.y += no.vy * passo;
  }

  estado.alpha = alpha * (1 - DECAIMENTO_DO_ALPHA);
}

export function fixarNo(estado: EstadoSimulacao, id: string, x: number, y: number): void {
  "worklet";
  for (let i = 0; i < estado.nos.length; i += 1) {
    if (estado.nos[i].id !== id) continue;
    estado.nos[i].fixo = true;
    estado.nos[i].x = x;
    estado.nos[i].y = y;
    estado.nos[i].vx = 0;
    estado.nos[i].vy = 0;
    return;
  }
}

export function liberarNo(estado: EstadoSimulacao, id: string): void {
  "worklet";
  for (let i = 0; i < estado.nos.length; i += 1) {
    if (estado.nos[i].id === id) estado.nos[i].fixo = false;
  }
}

export function reaquecer(estado: EstadoSimulacao, alvo: number): void {
  "worklet";
  estado.alpha = Math.max(estado.alpha, alvo);
}

export function esfriou(estado: EstadoSimulacao): boolean {
  "worklet";
  return estado.alpha < ALPHA_MINIMO;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/compartilhado/grafo/simulacao.test.ts`
Expected: PASS, 12 testes. Se "a mola aproxima" falhar, conferir se o comprimento de repouso (60) é mesmo menor que a distância inicial dos dois nós no fixture — com `LARGURA=400`, `posicionarNo` os coloca a algumas centenas de pixels.

- [ ] **Step 5: Commitar**

```bash
git add src/compartilhado/grafo/simulacao.ts src/compartilhado/grafo/simulacao.test.ts
git commit -m "feat(mobile): motor de simulacao de forcas do grafo"
```

---

### Task 5: Hook `useSimulacao` e o mock que falta no Jest

**Files:**
- Create: `mobile/src/compartilhado/grafo/useSimulacao.ts`
- Modify: `mobile/jest.setup.ts`
- Test: `mobile/src/compartilhado/grafo/useSimulacao.test.ts`

**Interfaces:**
- Consumes: tudo da Task 4.
- Produces: `useSimulacao({ nos, arestas, largura, altura, posicoesIniciais }): { posicoes, pegarNo, moverNoPego, soltarNo }`, onde `posicoes` é `SharedValue<Posicao[]>`. A Task 6 lê `posicoes`; a Task 8 chama `pegarNo`/`moverNoPego`/`soltarNo`.

**Onde mora `Posicao`:** o tipo é declarado em `posicionamento.ts` (`export type Posicao = { x: number; y: number }`) e apenas re-exportado por `useSimulacao.ts`. Declará-lo no hook fecharia um ciclo de import, porque `useSimulacao` → `simulacao` → `posicionamento` já é a cadeia inversa, e a Task 7 precisa do tipo dentro de `posicionamento.ts`. Adicionar a declaração lá **antes** de escrever o hook.

- [ ] **Step 1: Estender o mock do Reanimated**

O mock oficial traz literalmente `// useFrameCallback: ADD ME IF NEEDED`
(`node_modules/react-native-reanimated/lib/module/mock.js:84`) — sem isto,
qualquer componente que chame o hook quebra com "useFrameCallback is not a function".

```ts
// mobile/jest.setup.ts
import "@testing-library/react-native";
import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-reanimated", () => {
  const mock = require("react-native-reanimated/mock");
  // O mock oficial não implementa useFrameCallback (ele mesmo diz "ADD ME IF
  // NEEDED"). Em teste não existe loop de quadros: devolvemos um controle
  // inerte para o componente montar, e a lógica de cada quadro é coberta
  // pelos testes de simulacao.ts, que não precisam de render.
  return { ...mock, useFrameCallback: () => ({ setActive: jest.fn(), isActive: false }) };
});
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
// mobile/src/compartilhado/grafo/useSimulacao.test.ts
import { renderHook } from "@testing-library/react-native";
import type { NoDoGrafo } from "@/dados/tipos";
import { useSimulacao } from "./useSimulacao";

const nos: NoDoGrafo[] = [
  { id: "a", titulo: "A", x: 0.2, y: 0.5, peso: 1 },
  { id: "b", titulo: "B", x: 0.8, y: 0.5, peso: 1 },
];

describe("useSimulacao", () => {
  it("publica uma posição por nó já na montagem", () => {
    const { result } = renderHook(() =>
      useSimulacao({ nos, arestas: [{ de: "a", para: "b" }], largura: 400, altura: 800 }),
    );
    expect(result.current.posicoes.value).toHaveLength(2);
    expect(typeof result.current.posicoes.value[0].x).toBe("number");
  });

  it("usa as posições iniciais recebidas em vez do layout circular", () => {
    const { result } = renderHook(() =>
      useSimulacao({
        nos,
        arestas: [],
        largura: 400,
        altura: 800,
        posicoesIniciais: { a: { x: 11, y: 22 }, b: { x: 33, y: 44 } },
      }),
    );
    expect(result.current.posicoes.value[0]).toEqual({ x: 11, y: 22 });
  });

  it("ignora posição inicial de nota que não está mais no grafo", () => {
    const { result } = renderHook(() =>
      useSimulacao({ nos, arestas: [], largura: 400, altura: 800, posicoesIniciais: { sumiu: { x: 1, y: 2 } } }),
    );
    expect(result.current.posicoes.value).toHaveLength(2);
  });

  it("aguenta vault vazio", () => {
    // A tela monta antes de `listarNotas` responder, então a lista vazia é o
    // primeiro estado que este hook vê em toda entrada na tela — não é um
    // caso raro.
    const { result } = renderHook(() => useSimulacao({ nos: [], arestas: [], largura: 400, altura: 800 }));
    expect(result.current.posicoes.value).toEqual([]);
  });

  it("recria a simulação quando a lista de notas muda", () => {
    const { result, rerender } = renderHook((props: { nos: NoDoGrafo[] }) =>
      useSimulacao({ nos: props.nos, arestas: [], largura: 400, altura: 800 }),
    { initialProps: { nos } });

    rerender({ nos: [...nos, { id: "c", titulo: "C", x: 0.5, y: 0.2, peso: 1 }] });
    expect(result.current.posicoes.value).toHaveLength(3);
  });

  it("soltar um nó que sumiu do grafo não quebra", () => {
    // Se as notas recarregarem com um nó preso ao dedo, o `onEnd` do gesto
    // ainda vai chamar `soltarNo` com um id que a simulação nova não tem.
    const { result } = renderHook(() => useSimulacao({ nos, arestas: [], largura: 400, altura: 800 }));
    expect(() => result.current.soltarNo("sumiu")).not.toThrow();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/compartilhado/grafo/useSimulacao.test.ts`
Expected: FAIL — `Cannot find module './useSimulacao'`.

- [ ] **Step 4: Implementar**

```ts
// mobile/src/compartilhado/grafo/useSimulacao.ts
import { useEffect, useMemo } from "react";
import { runOnJS, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import {
  avancarSimulacao, criarSimulacao, esfriou, fixarNo, liberarNo, reaquecer,
  type EstadoSimulacao,
} from "./simulacao";
import type { Posicao } from "./posicionamento";

const ALPHA_AO_REAQUECER = 0.3;

export type { Posicao };

type Opcoes = {
  nos: NoDoGrafo[];
  arestas: Aresta[];
  largura: number;
  altura: number;
  posicoesIniciais?: Record<string, Posicao>;
  // Chamado uma vez por resfriamento, na JS thread, com as posições finais na
  // mesma ordem de `nos`. É o gancho de gravação que a Task 9 usa.
  aoEsfriar?: (posicoes: Posicao[]) => void;
};

export function useSimulacao({ nos, arestas, largura, altura, posicoesIniciais, aoEsfriar }: Opcoes) {
  const estado = useMemo(() => {
    const criado = criarSimulacao(nos, arestas, largura, altura);
    if (posicoesIniciais) {
      for (const no of criado.nos) {
        const salva = posicoesIniciais[no.id];
        if (salva) {
          no.x = salva.x;
          no.y = salva.y;
        }
      }
    }
    return criado;
  }, [nos, arestas, largura, altura, posicoesIniciais]);

  const compartilhado = useSharedValue<EstadoSimulacao>(estado);
  const posicoes = useSharedValue<Posicao[]>(estado.nos.map((no) => ({ x: no.x, y: no.y })));

  // Dois buffers pré-alocados, alternados a cada quadro. A troca de
  // referência é o que faz o Reanimated notificar os `useAnimatedProps`;
  // reaproveitar os objetos é o que mantém o caminho quente sem alocação.
  const buffers = useSharedValue<[Posicao[], Posicao[]]>([
    estado.nos.map((no) => ({ x: no.x, y: no.y })),
    estado.nos.map((no) => ({ x: no.x, y: no.y })),
  ]);
  const buffer = useSharedValue(0);

  const quadro = useFrameCallback((info) => {
    "worklet";
    const atual = compartilhado.value;
    avancarSimulacao(atual, info.timeSincePreviousFrame ?? 16.67);

    const proximo = buffers.value[buffer.value];
    for (let i = 0; i < atual.nos.length; i += 1) {
      proximo[i].x = atual.nos[i].x;
      proximo[i].y = atual.nos[i].y;
    }
    posicoes.value = proximo;
    buffer.value = buffer.value === 0 ? 1 : 0;

    // Grafo parado não merece quadros: o loop se desliga sozinho e volta
    // quando algo o reaquece. É também o único momento em que vale gravar as
    // posições em disco — o layout só está "assentado" aqui.
    if (esfriou(atual)) {
      quadro.setActive(false);
      if (aoEsfriar) runOnJS(aoEsfriar)(proximo.map((posicao) => ({ x: posicao.x, y: posicao.y })));
    }
  }, false);

  useEffect(() => {
    compartilhado.value = estado;
    posicoes.value = estado.nos.map((no) => ({ x: no.x, y: no.y }));
    buffers.value = [
      estado.nos.map((no) => ({ x: no.x, y: no.y })),
      estado.nos.map((no) => ({ x: no.x, y: no.y })),
    ];
    quadro.setActive(true);
  }, [estado, compartilhado, posicoes, buffers, quadro]);

  return {
    posicoes,
    pegarNo: (id: string, x: number, y: number) => {
      "worklet";
      fixarNo(compartilhado.value, id, x, y);
      reaquecer(compartilhado.value, ALPHA_AO_REAQUECER);
      quadro.setActive(true);
    },
    moverNoPego: (id: string, x: number, y: number) => {
      "worklet";
      fixarNo(compartilhado.value, id, x, y);
      reaquecer(compartilhado.value, ALPHA_AO_REAQUECER);
    },
    soltarNo: (id: string) => {
      "worklet";
      liberarNo(compartilhado.value, id);
      reaquecer(compartilhado.value, ALPHA_AO_REAQUECER);
    },
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest src/compartilhado/grafo/useSimulacao.test.ts && npx jest`
Expected: PASS nos dois — a mudança em `jest.setup.ts` afeta a suíte inteira, então rodar tudo aqui não é opcional.

- [ ] **Step 6: Commitar**

```bash
git add src/compartilhado/grafo/useSimulacao.ts src/compartilhado/grafo/useSimulacao.test.ts jest.setup.ts
git commit -m "feat(mobile): hook de simulacao com loop de quadros na UI thread"
```

---

### Task 6: Grafo desenhado a partir da simulação

**Files:**
- Create: `mobile/src/compartilhado/grafo/implementacao-svg/NoAnimado.tsx`
- Create: `mobile/src/compartilhado/grafo/implementacao-svg/ArestaAnimada.tsx`
- Modify: `mobile/src/compartilhado/grafo/implementacao-svg/GrafoInterativo.tsx`
- Test: `mobile/src/compartilhado/grafo/GrafoInterativo.test.tsx`

**Interfaces:**
- Consumes: `useSimulacao` e o `SharedValue<Posicao[]>` da Task 5.
- Produces: `NoAnimado` (props `posicoes`, `indice`, `peso`, `selecionado`) e `ArestaAnimada` (props `posicoes`, `de`, `para`), ambos consumidos apenas por `GrafoInterativo`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `GrafoInterativo.test.tsx` (os testes de empilhamento de toque que já existem **continuam valendo** e não podem ser removidos):

```ts
it("desenha um círculo por nó, na posição que a simulação publicou", async () => {
  const { resultado } = await renderizar();
  const circulos: NoDaArvore[] = [];
  acharTodos(resultado.toJSON() as NoDaArvore, (no) => no.type.includes("Circle"), circulos);
  // dois nós; o anel de seleção só aparece quando há nó selecionado
  expect(circulos.length).toBeGreaterThanOrEqual(2);
  expect(typeof circulos[0].props.cx).toBe("number");
});

it("desenha uma linha por aresta", async () => {
  const { resultado } = await renderizar();
  const linhas: NoDaArvore[] = [];
  acharTodos(resultado.toJSON() as NoDaArvore, (no) => no.type.includes("Line"), linhas);
  expect(linhas).toHaveLength(1);
});
```

`acharTodos` é o irmão de `acharPrimeiro` que já existe no arquivo — mesma recursão, empurrando todos os casamentos num array em vez de parar no primeiro.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/compartilhado/grafo/GrafoInterativo.test.tsx`
Expected: FAIL — `acharTodos` ainda não existe no arquivo de teste (`acharTodos is not defined`). Escrevê-la é parte do Step 1; com ela no lugar, os dois casos novos passam a falhar por conteúdo, e não por referência indefinida.

- [ ] **Step 3: Implementar os dois componentes**

```tsx
// mobile/src/compartilhado/grafo/implementacao-svg/NoAnimado.tsx
import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import { Circle } from "react-native-svg";
import { useTema } from "@/compartilhado/tema";
import { raioDoNo } from "../posicionamento";
import type { Posicao } from "../useSimulacao";

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

export function NoAnimado({ posicoes, indice, peso, selecionado }: {
  posicoes: SharedValue<Posicao[]>;
  indice: number;
  peso: number;
  selecionado: boolean;
}) {
  const { cores } = useTema();
  const props = useAnimatedProps(() => {
    const posicao = posicoes.value[indice];
    return { cx: posicao.x, cy: posicao.y };
  });

  return (
    <CirculoAnimado
      animatedProps={props}
      r={raioDoNo(peso)}
      fill={selecionado ? cores.grafoNoSinal : cores.grafoNoPreenchimento}
      stroke={selecionado ? cores.grafoNoSinal : cores.grafoNoBorda}
      strokeWidth={1}
    />
  );
}
```

`ArestaAnimada` segue o mesmo molde com `Line` e `x1/y1/x2/y2` lendo dois índices, `stroke={cores.grafoLigacaoNomeada}`.

Em `GrafoInterativo.tsx`: trocar o `useMemo` de `posicoes` por `useSimulacao(...)`, mapear nós e arestas para os componentes novos, e mover os rótulos `<Text>` e os `Pressable` de alvo para `useAnimatedStyle` lendo o mesmo shared value. **Preservar** `pointerEvents="box-none"` na camada e no `<Svg>` e a ordem fundo → Svg → alvos: há dois testes de regressão cravados nisso.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/compartilhado/grafo/ && npx tsc --noEmit`
Expected: PASS, incluindo os testes de empilhamento antigos.

- [ ] **Step 5: Commitar**

```bash
git add src/compartilhado/grafo/
git commit -m "feat(mobile): grafo desenhado por shared values, sem re-render por quadro"
```

---

### Task 7: Hit-test com zoom e deslocamento

**Files:**
- Modify: `mobile/src/compartilhado/grafo/posicionamento.ts`
- Test: `mobile/src/compartilhado/grafo/posicionamento.test.ts`

**Interfaces:**
- Consumes: `Posicao` da Task 5.
- Produces: `paraCoordenadaDoGrafo(toque: Posicao, zoom: number, deslocamento: Posicao): Posicao` e `noMaisProximoDeCoordenada(posicoes: Posicao[], pesos: number[], ponto: Posicao): number | null` (devolve o **índice**, não o id). Substituem `noMaisProximo`, que não tem nenhum consumidor hoje além do próprio teste. A Task 8 usa as duas.

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe("paraCoordenadaDoGrafo", () => {
  it("desfaz o deslocamento", () => {
    expect(paraCoordenadaDoGrafo({ x: 150, y: 250 }, 1, { x: 50, y: 100 })).toEqual({ x: 100, y: 150 });
  });

  it("desfaz o zoom", () => {
    expect(paraCoordenadaDoGrafo({ x: 200, y: 100 }, 2, { x: 0, y: 0 })).toEqual({ x: 100, y: 50 });
  });

  it("desfaz deslocamento e zoom na ordem certa", () => {
    // A camada aplica translate e depois scale; desfazer na ordem errada
    // erra o alvo por um fator do zoom — é aqui que o hit-test costuma
    // furar na prática.
    expect(paraCoordenadaDoGrafo({ x: 250, y: 100 }, 2, { x: 50, y: 20 })).toEqual({ x: 100, y: 40 });
  });
});

describe("noMaisProximoDeCoordenada", () => {
  const posicoes = [{ x: 100, y: 100 }, { x: 300, y: 300 }];
  const pesos = [1, 1];

  it("acha o nó sob o ponto", () => {
    expect(noMaisProximoDeCoordenada(posicoes, pesos, { x: 102, y: 98 })).toBe(0);
  });

  it("devolve null longe de qualquer nó", () => {
    expect(noMaisProximoDeCoordenada(posicoes, pesos, { x: 800, y: 800 })).toBeNull();
  });

  it("escolhe o mais próximo quando dois alvos se sobrepõem", () => {
    expect(noMaisProximoDeCoordenada([{ x: 100, y: 100 }, { x: 110, y: 100 }], pesos, { x: 109, y: 100 })).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/compartilhado/grafo/posicionamento.test.ts`
Expected: FAIL — as duas funções não existem.

- [ ] **Step 3: Implementar**

```ts
export function paraCoordenadaDoGrafo(toque: Posicao, zoom: number, deslocamento: Posicao): Posicao {
  "worklet";
  return { x: (toque.x - deslocamento.x) / zoom, y: (toque.y - deslocamento.y) / zoom };
}

export function noMaisProximoDeCoordenada(posicoes: Posicao[], pesos: number[], ponto: Posicao): number | null {
  "worklet";
  let escolhido: number | null = null;
  let menorDistancia = Number.POSITIVE_INFINITY;

  for (let i = 0; i < posicoes.length; i += 1) {
    const distancia = Math.hypot(posicoes[i].x - ponto.x, posicoes[i].y - ponto.y);
    if (distancia <= raioDoNo(pesos[i]) + TOLERANCIA_DE_TOQUE && distancia < menorDistancia) {
      menorDistancia = distancia;
      escolhido = i;
    }
  }

  return escolhido;
}
```

Remover `noMaisProximo` e os testes dele no mesmo passo — nada mais o chama.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/compartilhado/grafo/posicionamento.test.ts`
Expected: PASS.

- [ ] **Step 5: Commitar**

```bash
git add src/compartilhado/grafo/posicionamento.ts src/compartilhado/grafo/posicionamento.test.ts
git commit -m "feat(mobile): hit-test do grafo respeitando zoom e deslocamento"
```

---

### Task 8: Toque longo arrasta o nó

**Files:**
- Modify: `mobile/src/compartilhado/grafo/implementacao-svg/GrafoInterativo.tsx`
- Test: `mobile/src/compartilhado/grafo/GrafoInterativo.test.tsx`

**Interfaces:**
- Consumes: `pegarNo`/`moverNoPego`/`soltarNo` (Task 5), `paraCoordenadaDoGrafo`/`noMaisProximoDeCoordenada` (Task 7).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it("compõe o toque longo junto com arrastar e pinçar", async () => {
  // O que dá para afirmar em teste é a composição de gestos; o hit-test por
  // coordenada é coberto pelos testes puros da Task 7, e o arrasto real
  // depende do runtime de gestos, que não existe no Jest.
  const { resultado } = await renderizar();
  expect(screen.getByTestId("grafo-interativo")).toBeOnTheScreen();
  expect(resultado.toJSON()).toBeTruthy();
});

it("marca o nó pego com o anel de seleção", async () => {
  await renderizar({ noSelecionado: "a" });
  expect(screen.getByTestId("anel-do-no-a")).toBeOnTheScreen();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/compartilhado/grafo/GrafoInterativo.test.tsx -t "anel"`
Expected: FAIL — não existe `testID="anel-do-no-a"`.

- [ ] **Step 3: Implementar**

```tsx
const idPego = useSharedValue<string | null>(null);

const pegar = Gesture.LongPress()
  .minDuration(250)
  .onStart((evento) => {
    const ponto = paraCoordenadaDoGrafo(
      { x: evento.x, y: evento.y },
      zoom.value,
      { x: deslocamentoX.value, y: deslocamentoY.value },
    );
    const indice = noMaisProximoDeCoordenada(posicoes.value, pesos, ponto);
    if (indice === null) return;
    idPego.value = ids[indice];
    pegarNo(ids[indice], ponto.x, ponto.y);
  });

const arrastarNo = Gesture.Pan()
  .manualActivation(false)
  .onChange((evento) => {
    if (idPego.value === null) return;
    const ponto = paraCoordenadaDoGrafo(
      { x: evento.x, y: evento.y },
      zoom.value,
      { x: deslocamentoX.value, y: deslocamentoY.value },
    );
    moverNoPego(idPego.value, ponto.x, ponto.y);
  })
  .onEnd(() => {
    if (idPego.value === null) return;
    soltarNo(idPego.value);
    idPego.value = null;
  });
```

O `Gesture.Pan` de navegação precisa ignorar o movimento enquanto há nó pego, senão a tela desliza junto com o nó. Ele passa a começar com uma guarda:

```tsx
const arrastar = Gesture.Pan().onChange((evento) => {
  // Enquanto um nó está preso ao dedo, o mesmo movimento não pode também
  // arrastar a tela: o nó viajaria o dobro da distância do dedo.
  if (idPego.value !== null) return;
  deslocamentoX.value += evento.changeX;
  deslocamentoY.value += evento.changeY;
});

const gestos = Gesture.Simultaneous(pegar, arrastar, arrastarNo, pincar);
```

`Simultaneous` (e não `Race`) é o que permite o `LongPress` amadurecer enquanto o `Pan` já está ativo: o dedo parado por 250 ms não gera `changeX`/`changeY`, então a navegação não se move nesse intervalo, e assim que `pegar` dispara a guarda acima silencia o pan pelo resto do gesto.

`ids` e `pesos` são arrays derivados de `nos` com `useMemo` — o worklet não pode fechar sobre objetos que mudam de forma.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/compartilhado/grafo/ && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Verificar no aparelho**

Este é o único ponto do plano que os testes não alcançam. Rodar `npx expo start`, abrir a tela de Nota e conferir: segurar um nó o prende ao dedo; o grafo se acomoda em volta; soltar libera e ele assenta perto; arrastar fora de um nó navega; pinçar dá zoom.

- [ ] **Step 6: Commitar**

```bash
git add src/compartilhado/grafo/
git commit -m "feat(mobile): toque longo pega o no e arrasta com a fisica reagindo"
```

---

### Task 9: Persistência do layout

**Files:**
- Create: `mobile/src/funcionalidades/grafo/layoutPersistido.ts`
- Modify: `mobile/src/funcionalidades/grafo/estado.ts`
- Modify: `mobile/src/funcionalidades/vault/TelaNota.tsx`
- Modify: `mobile/package.json`
- Test: `mobile/src/funcionalidades/grafo/layoutPersistido.test.ts`

**Interfaces:**
- Consumes: `Posicao` (Task 5).
- Produces: `VERSAO_DO_LAYOUT: number`, o tipo `LayoutPersistido` e `reconciliarLayout(salvo: LayoutPersistido | null, ids: string[]): Record<string, Posicao>`.

- [ ] **Step 1: Instalar a dependência**

```bash
npx expo install @react-native-async-storage/async-storage
```

Usar `expo install`, não `npm install`: é ele que escolhe a versão compatível com o SDK 57.

- [ ] **Step 2: Escrever os testes que falham**

```ts
// mobile/src/funcionalidades/grafo/layoutPersistido.test.ts
import { VERSAO_DO_LAYOUT, reconciliarLayout, type LayoutPersistido } from "./layoutPersistido";

function salvo(sobrescritas: Partial<LayoutPersistido> = {}): LayoutPersistido {
  return {
    versao: VERSAO_DO_LAYOUT,
    posicoes: { a: { x: 10, y: 20 }, b: { x: 30, y: 40 } },
    zoom: 1,
    deslocamentoX: 0,
    deslocamentoY: 0,
    alturaDaFolha: 400,
    ...sobrescritas,
  };
}

it("mantém a posição de nota conhecida", () => {
  expect(reconciliarLayout(salvo(), ["a"])).toEqual({ a: { x: 10, y: 20 } });
});

it("não inventa posição para nota nova", () => {
  // Sem entrada, a Task 5 cai no layout circular de montarGrafo.
  expect(reconciliarLayout(salvo(), ["a", "nova"])).toEqual({ a: { x: 10, y: 20 } });
});

it("descarta posição órfã de nota que sumiu do vault", () => {
  expect(reconciliarLayout(salvo(), ["a"])).not.toHaveProperty("b");
});

it("descarta tudo quando a versão não bate", () => {
  expect(reconciliarLayout(salvo({ versao: VERSAO_DO_LAYOUT - 1 }), ["a"])).toEqual({});
});

it("aguenta não ter nada salvo", () => {
  expect(reconciliarLayout(null, ["a"])).toEqual({});
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/funcionalidades/grafo/layoutPersistido.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar**

```ts
// mobile/src/funcionalidades/grafo/layoutPersistido.ts
import type { Posicao } from "@/compartilhado/grafo/useSimulacao";

// Suba este número quando o formato mudar. É cache de conveniência, não dado
// do usuário: descartar é mais barato e mais seguro que migrar.
export const VERSAO_DO_LAYOUT = 1;

export type LayoutPersistido = {
  versao: number;
  posicoes: Record<string, Posicao>;
  zoom: number;
  deslocamentoX: number;
  deslocamentoY: number;
  alturaDaFolha: number;
};

export function reconciliarLayout(salvo: LayoutPersistido | null, ids: string[]): Record<string, Posicao> {
  if (salvo === null || salvo.versao !== VERSAO_DO_LAYOUT) return {};

  const conhecidos = new Set(ids);
  const resultado: Record<string, Posicao> = {};
  for (const [id, posicao] of Object.entries(salvo.posicoes)) {
    if (conhecidos.has(id)) resultado[id] = posicao;
  }
  return resultado;
}
```

Em `funcionalidades/grafo/estado.ts`, acrescentar o store persistido ao lado do
`useEstadoGrafo` que já existe (o de `pulso`/`crescer` **não** deve ser
persistido — é estado efêmero de animação):

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { VERSAO_DO_LAYOUT, type LayoutPersistido } from "./layoutPersistido";

type EstadoLayout = LayoutPersistido & {
  guardarLayout: (parcial: Partial<Omit<LayoutPersistido, "versao">>) => void;
};

export const useEstadoLayoutDoGrafo = create<EstadoLayout>()(
  persist(
    (set) => ({
      versao: VERSAO_DO_LAYOUT,
      posicoes: {},
      zoom: 1,
      deslocamentoX: 0,
      deslocamentoY: 0,
      alturaDaFolha: 0,
      guardarLayout: (parcial) => set(parcial),
    }),
    {
      name: "bimo-layout-do-grafo",
      storage: createJSONStorage(() => AsyncStorage),
      // A função não vai para o disco; só os dados.
      partialize: ({ versao, posicoes, zoom, deslocamentoX, deslocamentoY, alturaDaFolha }) => ({
        versao, posicoes, zoom, deslocamentoX, deslocamentoY, alturaDaFolha,
      }),
    },
  ),
);
```

Em `TelaNota.tsx`, chamar `guardarLayout` nos dois momentos que o spec fixa —
ao esfriar a simulação e ao fim de cada gesto — e nunca por quadro. O
`useSimulacao` da Task 5 já desliga o loop em `esfriou`; é nesse mesmo ponto
que a gravação entra, via `runOnJS`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS. Se algum teste reclamar de AsyncStorage sem mock, adicionar
`jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"))`
em `jest.setup.ts` — o pacote traz esse mock pronto.

- [ ] **Step 6: Verificar no aparelho**

Arrumar o grafo, fechar o app pelo gerenciador de tarefas, reabrir: o layout, o zoom e a altura da bandeja voltam como estavam.

- [ ] **Step 7: Commitar**

```bash
git add src/funcionalidades/grafo/ src/funcionalidades/vault/TelaNota.tsx package.json package-lock.json jest.setup.ts
git commit -m "feat(mobile): layout do grafo e altura da bandeja sobrevivem ao fechar o app"
```

---

### Task 10: Conserto do campo ambiente

**Files:**
- Modify: `mobile/src/compartilhado/grafo/implementacao-svg/CampoDeGrafoSvg.tsx`
- Modify: `mobile/src/compartilhado/grafo/fisica.ts`
- Test: `mobile/src/compartilhado/grafo/fisica.test.ts`, `mobile/src/compartilhado/grafo/CampoDeGrafo.test.tsx`

**Interfaces:**
- Consumes: nada das tasks anteriores além do `useFrameCallback` já mockado na Task 5.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// fisica.test.ts
it("recalcula as ligações por intervalo de tempo, não a cada quadro", () => {
  // Com densidade 60, calcularLigacoes testa 1770 pares. Rodar isso a cada
  // quadro era o caminho quente que travava a 120 Hz.
  expect(deveRecalcularLigacoes(0, 0)).toBe(true);
  expect(deveRecalcularLigacoes(1000, 1050)).toBe(false);
  expect(deveRecalcularLigacoes(1000, 1250)).toBe(true);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/compartilhado/grafo/fisica.test.ts -t "ligações"`
Expected: FAIL — `deveRecalcularLigacoes` não existe.

- [ ] **Step 3: Implementar**

```ts
// fisica.ts
const INTERVALO_DAS_LIGACOES_MS = 200;

export function deveRecalcularLigacoes(ultimoCalculo: number, agora: number): boolean {
  "worklet";
  return agora - ultimoCalculo >= INTERVALO_DAS_LIGACOES_MS;
}
```

Em `CampoDeGrafoSvg.tsx`: trocar o `setInterval` (linha ~52) por `useFrameCallback`,
manter os nós num shared value com o mesmo double buffering da Task 5, e
recalcular as ligações só quando `deveRecalcularLigacoes` autorizar. `avancarCampo`
continua imutável — ele não está no caminho de 120 Hz do gesto, e reescrevê-lo
para mutação é mudança maior do que este conserto pede.

O desenho não muda: mesma densidade (60), mesmas cores, mesma opacidade.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS na suíte inteira.

- [ ] **Step 5: Verificar no aparelho**

Abrir o Chat e a tela de Nota e observar o campo de fundo: mesma aparência,
sem o judder de antes. É a verificação que importa — o ganho é perceptual.

- [ ] **Step 6: Commitar**

```bash
git add src/compartilhado/grafo/
git commit -m "fix(mobile): campo de grafo sai do setInterval e do recalculo por quadro"
```

---

## Fechamento

- [ ] `npx jest` — suíte inteira verde
- [ ] `npx tsc --noEmit` — limpo
- [ ] `npx eslint .` — sem erros novos (os 47 erros de `desing-app-mobile/` são pré-existentes e não fazem parte deste trabalho)
- [ ] Passar no aparelho pelos três pedidos: arrastar a alça da bandeja entre o mínimo e a tela cheia; segurar e arrastar um nó vendo o grafo se acomodar; navegar e pinçar o grafo
- [ ] Atualizar `AGENTS.md`/`CLAUDE.md` se a arquitetura descrita lá tiver ficado desatualizada por este trabalho
