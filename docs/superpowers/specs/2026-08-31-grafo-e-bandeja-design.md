# Grafo manipulável e bandeja de altura livre — design

Data: 2026-08-31
Escopo: aplicativo mobile (`mobile/`), tela de Nota (`/nota`) e o campo de grafo compartilhado.

## Problema

Três pedidos do usuário sobre a tela de Nota, mais um achado de performance que
apareceu durante o levantamento:

1. A bandeja de notas muda de altura só por **toque** na alça
   (`FolhaDeNotas.tsx`, `Pressable` → `aoAvancarPasso`), ciclando entre três
   frações fixas (0.34 / 0.58 / 0.8). O usuário quer **arrastar** a alça com o
   dedo.
2. A faixa de alturas é curta demais nas duas pontas: não dá para recolher a
   bandeja quase toda, nem para abri-la em tela cheia.
3. O grafo aceita apenas navegar (`Gesture.Pan`) e dar zoom (`Gesture.Pinch`),
   já implementados em `GrafoInterativo.tsx`. Não é possível **arrastar um nó**,
   e o layout é estático: `montarGrafo` (`grafoDoVault.ts`) distribui os nós num
   círculo determinístico e o próprio comentário do arquivo declara "sem motor
   de física".
4. O app apresenta travamentos visíveis, especialmente num aparelho de 120 Hz.

O item 4 não é um pedido de feature, mas entra neste design porque o suspeito
principal é o mesmo módulo que os itens 1–3 tocam.

## Diagnóstico da performance

`CampoDeGrafoSvg.tsx` roda um `setInterval` a 30 fps que chama `setNos(...)`.
Por frame, portanto:

- re-render do componente inteiro;
- `calcularLigacoes` é O(n²) — com a densidade padrão de 60
  (`funcionalidades/conta/estado.ts`), são 1770 pares testados por frame;
- cerca de 60 `<Circle>` e até 180 `<Line>` nativos recebem props novas.

Esse campo fica montado no Chat **e** na tela de Nota, sempre rodando. Em 120 Hz
o `setInterval` agrava: não é alinhado ao vsync e acumula drift, então o judder
aparece muito mais do que apareceria em 60 Hz.

Esta é uma hipótese lida do código, ainda não medida com profiler. O design a
trata como a correção mais provável e de menor custo, não como diagnóstico
fechado. Uma investigação medida do app inteiro fica fora deste escopo.

## Decisões

Tomadas com o usuário durante o levantamento:

| Decisão                  | Escolha                                              |
| ------------------------- | ---------------------------------------------------- |
| Altura mínima da bandeja | Só alça + rodapé (`+ Nova Nota`) visíveis      |
| Altura máxima            | Tela cheia                                           |
| Comportamento ao soltar   | Altura livre,**sem imantação** em paradas    |
| Toque na alça            | Alterna mínimo ↔ médio                            |
| Iniciar arrasto de nó    | Toque longo (~250 ms) sobre o nó                    |
| Ao soltar o nó           | Liberado, as molas voltam a agir (igual Obsidian)    |
| Persistência             | Em disco, sobrevive a fechar o app                   |
| Motor                     | Módulo puro de funções, não biblioteca externa   |
| Render                    | Shared values do Reanimated, sem re-render por frame |

## Arquitetura

### 1. Bandeja de altura livre

`PassoDaFolha` (`0 | 1 | 2`) deixa de existir. O estado passa a guardar uma
**altura em pixels**, clampada entre `alturaMinima` e `alturaDisponivel`.

- `alturaMinima` é **medida**, não constante: um `onLayout` no bloco que contém
  a alça e o rodapé informa a altura real. Assim o mínimo acompanha a fonte e a
  densidade do sistema, em vez de fixar um número que quebra com fonte grande.
- O miolo (busca, sobrancelha, lista) recebe `flex: 1, minHeight: 0` e comprime
  até zero. O rodapé não encolhe (`flexShrink` é 0 por padrão no React Native),
  então alça e botão sobrevivem ao mínimo sem serem empurrados para fora.
- O arrasto é um `Gesture.Pan()` na alça cujo `onChange` escreve direto no
  shared value da altura, num worklet — sem re-render durante o gesto.
- O toque é um `Gesture.Tap()` que alterna mínimo ↔ médio com `withTiming`,
  usando a duração e a curva já expostas por `movimento` no tema.
- `selecionarNo` hoje força `Math.max(1, passo)` para garantir que a lista
  apareça ao selecionar um nó. O equivalente passa a ser: se a altura está
  abaixo da média, sobe para a média.

Lógica pura extraída para `funcionalidades/vault/alturaDaFolha.ts`:

```ts
export function proximaAltura(atual: number, delta: number, minima: number, maxima: number): number;
export function alternarAltura(atual: number, minima: number, maxima: number): number;
export function alturaMedia(minima: number, maxima: number): number;
```

`alturaMedia` é o ponto médio entre mínimo e máximo — o alvo do toque na alça e
o piso aplicado quando um nó é selecionado.

### 2. Gestos do grafo

`Gesture.Pan` (navegar) e `Gesture.Pinch` (zoom) continuam como estão. Entra um
`Gesture.LongPress().minDuration(250)` composto com os demais em
`Gesture.Simultaneous`.

- **Hit-test:** converte a coordenada de tela para coordenada do grafo,
  desfazendo zoom e deslocamento antes de comparar. `noMaisProximo`
  (`posicionamento.ts`) é adaptado para receber as posições vindas da simulação
  em vez de recalcular o layout circular.
- **Feedback ao pegar:** anel de seleção mais escala do nó. Sem háptico — isso
  evita uma dependência nova; se for desejado depois, `Vibration` do React
  Native resolve sem dep.
- **Enquanto arrasta:** o nó recebe `fixo = true` e sua posição segue o dedo; a
  simulação é reaquecida (alpha volta ao alvo) e o restante do grafo se acomoda.
- **Ao soltar:** `fixo = false`. As molas voltam a agir, o nó desliza e assenta
  perto de onde foi largado, e o alpha decai até a simulação congelar.

O toque curto continua selecionando o nó, e o toque no fundo continua limpando
a seleção — comportamento atual de `GrafoInterativo.tsx`, preservado.

### 3. Motor de simulação

Novo módulo `compartilhado/grafo/simulacao.ts`, sem dependência externa:

```ts
export type NoSimulado = {
  id: string; x: number; y: number; vx: number; vy: number; peso: number; fixo: boolean;
};

export type EstadoSimulacao = {
  nos: NoSimulado[];
  ligacoes: [number, number][];   // índices em `nos`, resolvidos uma vez
  alpha: number;
  largura: number; altura: number;
};

export function criarSimulacao(nos: NoDoGrafo[], arestas: Aresta[], largura: number, altura: number): EstadoSimulacao;
export function avancarSimulacao(estado: EstadoSimulacao, dt: number): void;  // muta in-place
export function fixarNo(estado: EstadoSimulacao, id: string, x: number, y: number): void;
export function liberarNo(estado: EstadoSimulacao, id: string): void;
export function reaquecer(estado: EstadoSimulacao, alvo: number): void;
export function esfriou(estado: EstadoSimulacao): boolean;
```

Forças por passo, na ordem: repulsão entre pares (proporcional ao peso), mola em
cada ligação (comprimento de repouso fixo), atração fraca ao centro, atrito
sobre a velocidade. Nós com `fixo = true` têm velocidade zerada e posição
mantida. Ao final, `alpha` decai; `esfriou` compara com `alphaMinimo`.

Parâmetros iniciais, no espírito dos padrões do d3-force e ajustáveis depois de
ver o resultado no aparelho:

| Parâmetro                        | Valor inicial           |
| --------------------------------- | ----------------------- |
| Força de repulsão               | -30 por unidade de peso |
| Comprimento de repouso da mola    | 60 px                   |
| Rigidez da mola                   | 0.05                    |
| Atração ao centro               | 0.02                    |
| Atrito (decaimento da velocidade) | 0.6                     |
| Decaimento do alpha               | 0.0228 por passo        |
| Alpha mínimo                     | 0.001                   |
| Alpha alvo ao reaquecer           | 0.3                     |

Duas escolhas fogem do estilo do restante do repositório, de propósito:

- **Executa como worklet na UI thread**, via `useFrameCallback` do Reanimated,
  em vez de `setState` por frame. As funções levam a diretiva `"worklet"`, que é
  inerte fora do runtime do Reanimated — sob o Jest continuam funções JS comuns,
  então a testabilidade permanece. É isso que sustenta 120 Hz: o loop não
  depende do JS thread estar livre.
- **Muta o estado in-place**, ao contrário de `fisica.ts`, que devolve arrays
  novos a cada passo. A 120 Hz, alocar um array de nós por frame produz lixo que
  o GC coleta 120 vezes por segundo, e pausas de GC são exatamente o sintoma
  relatado. Os testes verificam a mutação; a pureza que importa aqui — nenhum
  efeito fora do estado recebido, nenhuma leitura de relógio ou de aleatório não
  injetado — é mantida.

### 4. Render sem re-render

`useSimulacao` (`compartilhado/grafo/useSimulacao.ts`) cria a simulação, roda o
`useFrameCallback` e expõe as posições como shared values. Dois componentes
novos consomem esses valores:

- `NoAnimado.tsx` — um `Circle` animado por nó, via `useAnimatedProps`;
- `ArestaAnimada.tsx` — uma `Line` animada por aresta.

Os rótulos, que já são `<Text>` do React Native sobrepostos ao SVG, passam a
usar `useAnimatedStyle` para acompanhar seus nós.

Com isso o React só re-renderiza quando a lista de notas ou de arestas muda. O
`useFrameCallback` é desligado quando `esfriou` devolve `true` e religado ao
reaquecer, para não gastar frames com um grafo parado.

### 5. Persistência do layout

Dependência nova: `@react-native-async-storage/async-storage`, instalada com
`npx expo install` para casar com a versão do SDK 57. O middleware `persist` do
zustand já está disponível em `node_modules/zustand`.

Formato guardado:

```ts
type LayoutPersistido = {
  versao: number;
  posicoes: Record<string, { x: number; y: number }>;
  zoom: number;
  deslocamentoX: number;
  deslocamentoY: number;
  alturaDaFolha: number;
};
```

- **Quando grava:** com debounce, ao esfriar a simulação e ao terminar cada
  gesto. Nunca por frame.
- **Reconciliação** (`funcionalidades/grafo/layoutPersistido.ts`):
  `reconciliarLayout(salvo, nos)` devolve as posições iniciais — nota conhecida
  usa a posição salva, nota nova entra pela posição do layout circular de
  `montarGrafo`, e posição órfã (nota que sumiu do vault) é descartada.
- **Versionamento:** `versao` diferente da atual descarta o registro inteiro e
  recomeça do layout circular. É um cache de conveniência, não dado do usuário:
  perder é aceitável, migrar não vale o custo.
- A altura da bandeja viaja junto, pelo mesmo mecanismo e pelo mesmo motivo.

### 6. Conserto do campo ambiente

`CampoDeGrafoSvg.tsx`, que serve o Chat e a tela de Nota:

- `setInterval` a 30 fps → `useFrameCallback`, alinhado ao vsync;
- `calcularLigacoes` sai do caminho quente: as ligações mudam devagar, então
  passam a ser recalculadas por intervalo de tempo, não a cada frame;
- as posições passam a shared values, eliminando o re-render por frame.

O comportamento visual é o mesmo. A densidade padrão (60) não muda — mexer nela
seria alterar o desenho sem pedido.

## Casos de borda

- **`onLayout` não dispara em teste.** `FolhaDeNotas.tsx` já contorna isso com
  `ALTURA_DE_RESERVA`; a altura mínima medida precisa do mesmo tipo de reserva,
  pelo mesmo motivo, com o comentário explicando que só o ambiente de teste a usa.
- **Rotação de tela.** Muda `alturaDisponivel` e as dimensões do grafo. A altura
  da bandeja é reclampada sem animação (a distinção "layout mudou" × "usuário
  mexeu" que `FolhaDeNotas.tsx` já faz é preservada); a simulação é reaquecida
  com a nova caixa.
- **Vault vazio.** Sem nós, a simulação não roda e o grafo desenha nada; a
  bandeja continua utilizável.
- **Nó fixo durante recarga das notas.** Se a lista mudar enquanto um nó está
  preso ao dedo, a simulação é recriada e o arrasto termina — soltar não deve
  procurar um nó que não existe mais.
- **Leitura do disco falha ou vem corrompida.** Cai no layout circular padrão,
  seguindo o padrão de erro do repositório: falha tratada perto da origem, sem
  derrubar a tela.

## Testes

Módulos puros, testados sem renderizar:

- `simulacao.test.ts` — molas aproximam nós ligados; repulsão afasta nós
  sobrepostos; `alpha` decai e `esfriou` vira `true`; nó fixo não se move e não
  acumula velocidade; liberar volta a movê-lo; `reaquecer` reabre o loop.
- `alturaDaFolha.test.ts` — clamp nas duas pontas; alternância mínimo ↔ médio a
  partir de qualquer altura.
- `posicionamento.test.ts` (ampliado) — hit-test correto com zoom e deslocamento
  aplicados, que é onde a conversão de coordenadas erra na prática.
- `layoutPersistido.test.ts` — mantém conhecida, cria nova, descarta órfã,
  descarta tudo em versão diferente.

Testes de componente já existentes, atualizados: `FolhaDeNotas.test.tsx`
(arrasto e toque no lugar do ciclo de passos), `GrafoInterativo.test.tsx`
(toque longo pega o nó, soltar libera), `CampoDeGrafo.test.tsx`.

## Arquivos

Novos:

- `mobile/src/compartilhado/grafo/simulacao.ts`
- `mobile/src/compartilhado/grafo/useSimulacao.ts`
- `mobile/src/compartilhado/grafo/implementacao-svg/NoAnimado.tsx`
- `mobile/src/compartilhado/grafo/implementacao-svg/ArestaAnimada.tsx`
- `mobile/src/funcionalidades/vault/alturaDaFolha.ts`
- `mobile/src/funcionalidades/grafo/layoutPersistido.ts`

Modificados:

- `mobile/src/compartilhado/grafo/implementacao-svg/GrafoInterativo.tsx`
- `mobile/src/compartilhado/grafo/implementacao-svg/CampoDeGrafoSvg.tsx`
- `mobile/src/compartilhado/grafo/posicionamento.ts`
- `mobile/src/funcionalidades/vault/componentes/FolhaDeNotas.tsx`
- `mobile/src/funcionalidades/vault/estado.ts`
- `mobile/src/funcionalidades/vault/TelaNota.tsx`
- `mobile/package.json` (AsyncStorage)

## Fora de escopo

- Investigação medida com profiler do app inteiro. O conserto do campo ambiente
  entra aqui porque é o mesmo módulo da feature; o resto do "app lento" precisa
  de medição própria antes de virar mudança de código.
- Barnes-Hut / quadtree para a repulsão. Com 14 notas no fixture, O(n²) é
  trivial. A assinatura de `avancarSimulacao` não muda quando isso for
  necessário, então adiar não custa retrabalho.
- Háptico ao pegar o nó.
- Mudança na densidade padrão do campo ambiente.
- Rotular o grafo por pastas, agrupar ou filtrar nós — nada disso foi pedido.
