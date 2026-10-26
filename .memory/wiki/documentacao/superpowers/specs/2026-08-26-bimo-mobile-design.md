# Bimo Mobile — Design

Data: 2026-08-26
Status: aprovado, pronto para virar plano de implementação

## 1. Contexto e escopo

O Bimo web (raiz deste repo) é um chat que lê um vault Obsidian hospedado no
GitHub e responde via Gemini com function calling. Este documento cobre o **app
mobile**, que vive inteiramente em `mobile/` e é um projeto npm próprio,
independente do Next.js da raiz.

Existe um pacote de handoff de design completo em
`mobile/desing-app-mobile/Aplicativo de notas com IA e grafos/design_handoff_bimo_mobile/`:
protótipo HTML autocontido, tokens CSS canônicos, o campo de grafo em JSX de
referência e dois MP4 de intro (fundo claro e fundo escuro). Para depois de aprovado
concretizar o app ao sistema.

**Escopo desta fase:** telas, navegação, tema, campo de grafo e dados de
exemplo. Nada de backend.

**Fora de escopo:** integração com a API real, autenticação, sincronização,
persistência local, push, publicação nas lojas.

Os arquivos em `design/` são referência visual, **não código a copiar** — o
próprio handoff diz isso. A tarefa é recriar as telas em React Native seguindo
os padrões definidos aqui.

## 2. Decisões

| Decisão | Alternativas descartadas | Porquê |
|---|---|---|
| Expo Router (file-based) | React Navigation puro | Caminho padrão do Expo hoje; deep link e typed routes de graça; `presentation: 'formSheet'/'fullScreenModal'` cobre as sheets do design sem código extra |
| `StyleSheet` + tema tipado próprio | NativeWind, Unistyles | Zero build extra; o campo de grafo precisa de valores crus (canvas/SVG) que ficariam fora de qualquer solução de classes de qualquer jeito |
| Zustand, um store por domínio | Context + useReducer | O handoff lista ~18 estados; com o canvas redesenhando, Context puro gera re-render em cascata |
| Fixtures atrás de contratos de serviço | Fixtures direto nos componentes | Trocar mock por HTTP vira uma implementação nova, sem tocar em tela |
| `react-native-svg` + Reanimated no grafo | Skia (dev build), expo-gl/WebView | Roda no Expo Go hoje; isolado atrás de um contrato, trocar por Skia depois é uma pasta |
| Feature-first em `src/funcionalidades/` | Layer-first | Casa com os 4 domínios do handoff (chat, vault, editor, conta) |
| Sem bottom tab | Tab bar inferior | Decisão explícita do handoff: só há 2 destinos e eles vivem no `TabSwitcher` do header |

### Restrição que moldou o grafo

`@shopify/react-native-skia` **não roda no Expo Go** — exige dev build. Como o
requisito é desenvolver no Expo Go, o campo de grafo usa `react-native-svg`
com animação em Reanimated na UI thread. A densidade padrão do modo ambiente
cai de 90 para ~60 nós para manter o frame rate; os três presets de densidade
(70/90/110) viram 50/60/80 no ambiente e ficam ajustáveis num único lugar.

## 3. Stack

| Camada | Escolha |
|---|---|
| Base | Expo (SDK fixado no `create-expo-app`, o mais recente que o Expo Go suporta), TypeScript strict |
| Rotas | `expo-router`, typed routes ligado |
| Estado | `zustand` |
| Estilo | `StyleSheet` + tema tipado |
| Grafo | `react-native-svg`, `react-native-reanimated`, `react-native-gesture-handler` |
| Vidro | `expo-blur` |
| Intro | `expo-video` |
| Fontes | `@expo-google-fonts/geist`, `@expo-google-fonts/jetbrains-mono`, Material Symbols como TTF local |
| Testes | `jest-expo` + `@testing-library/react-native` |
| Lint | `eslint-config-expo` + Prettier |

Nomes de variáveis, funções, tipos, comentários e textos de UI em **pt-BR**,
igual ao resto do repo.

## 4. Estrutura de pastas

```text
mobile/
  app/                        # só roteamento; telas finas, sem lógica
    _layout.tsx               # fontes, tema, gesture-handler, splash, provedor de serviços
    intro.tsx                 # vídeo de abertura
    (app)/
      _layout.tsx             # Stack + Cabecalho (marca · TabSwitcher · avatar)
      bimo.tsx                # chat
      nota.tsx                # grafo + folha de notas
      editor/[id].tsx         # presentation: fullScreenModal
      perfil.tsx              # presentation: formSheet
      configuracoes.tsx       # presentation: formSheet
  src/
    funcionalidades/
      chat/      { componentes/ estado/ servicos/ tipos.ts }
      vault/     { componentes/ estado/ tipos.ts }
      editor/    { componentes/ estado/ tipos.ts }
      conta/     { componentes/ estado/ tipos.ts }
    compartilhado/
      ui/        # Botao, Pill, Sheet, CampoDeBusca, Interruptor, Chip, Cartao, Avatar, Icone
      tema/      # tokens/*.ts, ProvedorDeTema, useTema
      grafo/     # contrato + implementacao-svg/ + fisica.ts
      hooks/
      utils/
    dados/fixtures/           # notas, arestas, mensagens, perfil
    servicos/                 # contratos + implementações fake
  assets/
    videos/     intro-claro.mp4, intro-escuro.mp4
    fontes/     Geist, JetBrainsMono, MaterialSymbolsOutlined, MaterialSymbolsRounded
  desing-app-mobile/          # handoff; permanece onde está, fora do tsconfig
```

Regras de fronteira:

- `app/` monta o componente da feature e nada mais.
- Uma feature nunca importa de outra feature. O que for comum sobe para
  `compartilhado/`.
- `compartilhado/` não importa de `funcionalidades/`.

## 5. Navegação

- Os dois destinos (`Bimo` e `Nota`) são rotas irmãs no mesmo Stack; o
  `TabSwitcher` do header faz `router.replace()`. O header vive no
  `(app)/_layout.tsx` e por isso é persistente e não re-monta na troca.
- **Editor**: rota modal full-screen sobre `/nota`, recebe `id`. Também é
  aberta pelos cartões de resultado do chat.
- **Perfil** e **Configurações**: rotas `formSheet`, fecham com `arrow_back`.
- **Menu de conta** (avatar) e **menu de ações da IA** (botão Bimo do editor):
  bottom sheets locais via componente `Sheet`, não rotas — o handoff descreve
  os dois com o mesmo painel e o mesmo backdrop `rgba(27,27,29,.18)`.
- `intro.tsx` é a rota inicial; ao terminar o vídeo, ou ao toque para pular,
  faz `router.replace('/bimo')`.

## 6. Tema e tokens

Porte 1:1 dos CSS de `design/tokens/` para TS em
`src/compartilhado/tema/tokens/`, com nomes em pt-BR.
`useTema()` devolve `{ cores, tipografia, espacamento, raios, sombras, movimento }`
conforme `useColorScheme()`. **Nenhum componente escreve hex literal** — mesma
regra do web.

### 6.1 Tema claro

Valores exatos de `design/tokens/colors.css`. Resumo dos que mais aparecem:
`primaria #5e4bc0`, `sobrePrimaria #ffffff`, `secundaria #4bb6c0`,
`fundo/superficie #fcf8fb`, `superficieContainerBaixa #f6f3f5`,
`superficieContainerAlta #eae7ea`, `sobreSuperficie #1b1b1d`,
`sobreSuperficieVariante #3e4a40`, `contorno #6e7a6f`,
`fioDeCabelo (contornoVariante) #bdcabd`, `erro #ba1a1a`.

Vidros por opacidade sobre `superficie`: barra 90%, bolha 60%, dock 60%,
folha 85%, cartão 80% sobre `superficieContainerBaixa`. Bolha do usuário:
`primaria` a 90%, borda `primaria` a 20%.

Grafo (canvas): base `#889299`, suave `#a0aab2`, tênue `#dcd9dc`,
sinal `#5e4bc0`, ligação `rgba(136,146,153,0.15)`, mistura `multiply`.

### 6.2 Tema escuro (definitivo)

O handoff não trouxe paleta escura, mas os tokens `*-fixed` do `colors.css`
expõem T10/T20/T30/T80/T90 de cada família — a rampa tonal está lá. O tema
escuro é essa mesma rampa lida ao contrário, segundo M3:
`primária T40→T80`, `sobre T100→T20`, `container T70/T90→T30`,
`sobre-container T20→T90`; neutros espelhados (N99→N6, N10→N90);
neutro-variante `NV30↔NV80` e `NV50→NV60`.

Rampa Electric Iris usada na derivação:
T10 `#1a0063` · T20 `#2f1191` · T30 `#4631a7` · T40 `#5e4bc0` ·
T70 `#9988ff` · T80 `#c9bfff` · T90 `#e5deff`.

```ts
// src/compartilhado/tema/tokens/cores.ts
export const coresEscuro = {
  // Primária — Electric Iris
  primaria: '#c9bfff',                    // T80
  sobrePrimaria: '#2f1191',               // T20
  primariaContainer: '#4631a7',           // T30
  sobrePrimariaContainer: '#e5deff',      // T90
  primariaInversa: '#5e4bc0',             // T40
  primariaHover: '#e5deff',               // hover clareia nos dois temas
  primariaFixa: '#e5deff',                // fixed não muda entre temas (M3)
  primariaFixaDim: '#c9bfff',
  sobrePrimariaFixa: '#1a0063',
  sobrePrimariaFixaVariante: '#4631a7',

  // Secundária — Teal Current
  secundaria: '#bffaff',                  // T80
  sobreSecundaria: '#118691',             // T20
  secundariaContainer: '#319da7',         // T30
  sobreSecundariaContainer: '#defcff',    // T90
  secundariaFixa: '#defcff',
  secundariaFixaDim: '#bffaff',
  sobreSecundariaFixa: '#005b63',
  sobreSecundariaFixaVariante: '#319da7',

  // Terciária — lavanda neutra
  terciaria: '#c7c5d3',                   // T80
  sobreTerciaria: '#30303a',              // T20 (interpolado entre T10 e T30)
  terciariaContainer: '#464651',          // T30
  sobreTerciariaContainer: '#e3e1ef',     // T90
  terciariaFixa: '#e3e1ef',
  terciariaFixaDim: '#c7c5d3',
  sobreTerciariaFixa: '#1b1b25',
  sobreTerciariaFixaVariante: '#464651',

  // Erro — paleta M3 canônica
  erro: '#ffb4ab',
  sobreErro: '#690005',
  erroContainer: '#93000a',
  sobreErroContainer: '#ffdad6',

  // Neutros e superfícies (mesmo leve tom magenta do tema claro)
  fundo: '#131315',                       // N6
  sobreFundo: '#e4e2e4',                  // N90
  superficie: '#131315',
  superficieDim: '#131315',
  superficieClara: '#393739',             // N24
  superficieContainerMinima: '#0e0d0f',   // N4
  superficieContainerBaixa: '#1b1b1d',    // N10
  superficieContainer: '#1f1f21',         // N12
  superficieContainerAlta: '#2a292b',     // N17
  superficieContainerMaxima: '#353436',   // N22
  superficieVariante: '#3e4a40',          // NV30
  sobreSuperficie: '#e4e2e4',             // N90
  sobreSuperficieVariante: '#bdcabd',     // NV80
  superficieInversa: '#e4e2e4',
  sobreSuperficieInversa: '#303032',      // N20
  contorno: '#889589',                    // NV60
  contornoVariante: '#3e4a40',            // NV30
  tintaSuperficie: '#c9bfff',

  // Aliases semânticos
  textoCorpo: '#e4e2e4',
  textoSuave: '#bdcabd',
  textoTenue: '#889589',
  textoPlaceholder: '#3e4a40',
  textoLink: '#c9bfff',
  textoSobreAcento: '#2f1191',
  superficiePagina: '#131315',
  superficieCartao: '#1b1b1d',
  superficieLinhaAtiva: '#1b1b1d',
  superficieChip: '#2a292b',
  superficieCodigo: '#e4e2e4',
  textoCodigo: '#1b1b25',
  fioDeCabelo: '#3e4a40',
  fioDeCabeloForte: '#889589',

  // Vidros — mesmas porcentagens do tema claro, sobre a superfície escura
  vidroBarra: 'rgba(19,19,21,0.90)',
  vidroBolha: 'rgba(19,19,21,0.60)',
  vidroDock: 'rgba(19,19,21,0.60)',
  vidroFolha: 'rgba(19,19,21,0.85)',
  vidroCartao: 'rgba(27,27,29,0.80)',
  bolhaUsuario: 'rgba(201,191,255,0.90)',
  bolhaUsuarioBorda: 'rgba(201,191,255,0.20)',
  protecaoDock: ['#131315', 'rgba(19,19,21,0.60)', 'rgba(19,19,21,0)'],
  tintaDoBlur: 'dark',                    // prop tint do expo-blur

  // Foco
  anelFoco: '#c9bfff',
  anelFocoSuave: 'rgba(201,191,255,0.20)',

  // Campo de grafo — valores de canvas/SVG
  grafoNoBase: '#9aa4ab',
  grafoNoSuave: '#7e888f',
  grafoNoTenue: '#3a3d40',
  grafoNoSinal: '#c9bfff',
  grafoLigacao: 'rgba(154,164,171,0.18)',
  grafoMistura: 'screen',                 // no claro é multiply
  grafoNoPreenchimento: '#1f1f21',
  grafoNoBorda: '#889589',
  grafoNoRotulo: '#bdcabd',
  grafoNoRotuloSelecionado: '#e4e2e4',
  grafoLigacaoNomeada: 'rgba(201,191,255,0.28)',
  grafoAnelSelecao: 'rgba(201,191,255,0.35)',
} as const;

export type Cores = typeof coresEscuro;   // coresClaro satisfaz o mesmo contrato
```

Três consequências visuais, todas intencionais:

1. **A bolha do usuário inverte.** No claro é Iris escuro com texto branco; no
   escuro vira lavanda clara com texto `#2f1191`. Vale igual para o botão
   primário e a aba ativa do `TabSwitcher`. É o comportamento M3 e é o que
   preserva contraste.
2. **`grafoMistura` vira `screen`.** No escuro os nós somam luz em vez de
   subtrair.
3. **`textoPlaceholder` fica em 1,85:1.** É espelho fiel do tema claro, que já
   está em 1,67:1 — intenção preservada. Se algum dia virar problema de
   acessibilidade, o valor de troca é `#6e7a6f` (NV50, ~3,3:1).

Contrastes no escuro: `sobreSuperficie` 14:1 · `sobreSuperficieVariante` 10:1 ·
`primaria` 9,9:1 · `sobrePrimaria` sobre `primaria` 9:1 · `contorno` 5,6:1.

### 6.3 Tipografia, espaço, raios, movimento

- Geist em tudo, JetBrains Mono em código e chips de tag. Pesos 400/500/600
  apenas — não existe bold no sistema.
- Escala do handoff: `display-md` 24/32 600 −0.02em; `headline-sm` 18/26 600;
  `title-md` 16/24 600; `title-sm` 14/20 600; `body-base` 14/22 400;
  `body-medium` 14/22 500; `label-sm` 12/16 500 0.01em; `caption` 12/16 400;
  `code-inline` 12/18 mono. Texto de chat com line-height 1.625.
- Espaço em múltiplos de 4: 4/8/12/16/20/24. Gutter 16. Header 56. Alvo de
  toque mínimo 44. Composer no máximo 160 de altura.
- Raios: 4 (chips, linhas), 8 (cartões, botão enviar), 12 (bolhas, botões
  primários), 16 (dock, sheets), full (pills, avatares). Assinatura da marca:
  bolha de 12 com **um** canto em 6.
- Movimento: 150/200/300 ms com `cubic-bezier(0.2,0,0,1)`. Nada escala nem
  encolhe no press. Duas exceções com personalidade: o bounce escalonado dos
  três pontos de digitação (0 / 0.2 / 0.4 s) e a deriva do grafo com suas
  rajadas de partículas.

### 6.4 Sombras em RN

React Native não tem `box-shadow` multi-camada. Centralizar em `sombras.ts`:

```ts
export const sombrasEscuro = {
  pequena: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 2,  shadowOffset: { width: 0, height: 1 },  elevation: 1 },
  grande:  { shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
};
```

No claro, `pequena` usa opacidade 0.05 e `grande` 0.10, aproximando
`--shadow-sm` e `--shadow-xl`. No escuro a elevação real vem do degrau de
`superficieContainer*`; a sombra só reforça.

## 7. Dados e serviços

```ts
// src/servicos/contratos.ts
export interface ServicoVault {
  listarNotas(): Promise<Nota[]>;
  obterNota(id: string): Promise<Nota>;
  listarArestas(): Promise<Aresta[]>;
  salvarNota(nota: Nota): Promise<void>;
}

export interface ServicoIA {
  conversar(texto: string): Promise<RespostaAgente>;      // inclui cartoes: string[]
  acaoNaNota(tipo: TipoDeAcaoIA, nota: Nota): Promise<Sugestao>;
}
```

`TipoDeAcaoIA` é `'links' | 'resumo' | 'tags' | 'continuar' | 'perguntar'` —
as cinco ações do menu do editor.

Implementações fake em `src/servicos/fake/`, lendo `src/dados/fixtures/`, com
atraso artificial (~1,6 s no chat, como o protótipo). Injetadas por um
`ProvedorDeServicos` (Context) montado no `app/_layout.tsx`. Trocar por HTTP
depois é uma implementação nova; nenhuma tela muda.

Formato mínimo de `Nota`, tirado do handoff: `id`, `titulo`, `pasta`, `tags`,
`corpo`, `resumo`, `editadaEm`, `conexoes`. `Aresta` é um par de ids.

## 8. Estado

| Store | Guarda |
|---|---|
| `useEstadoChat` | `mensagens`, `rascunho`, `digitando` |
| `useEstadoVault` | `busca`, `noSelecionado`, `passoDaFolha` (0/1/2) |
| `useEstadoEditor` | `titulo`, `texto`, `tags`, `menuIA`, `sugestao` |
| `useEstadoConta` | `perfil`, `interruptores`, `densidade` |
| `useEstadoGrafo` | `pulso`, `crescer` (contadores) |

`pulso` e `crescer` ficam num store separado para o canvas não arrastar o chat
em re-render.

Transições, direto do handoff:

- Enviar mensagem → adiciona bolha, `digitando = true`, `pulso++`; após ~1,6 s
  chega a resposta com cartões, `digitando = false`, `pulso++`.
- Selecionar nó → `noSelecionado = id`, `passoDaFolha = max(1, passoDaFolha)`.
- Rodar ação de IA → `sugestao = tipo`, `menuIA = false`, `pulso++`.
- Aceitar sugestão → anexa texto ou mescla tags sem duplicar, `sugestao = null`,
  `crescer++`.
- Digitar no corpo → a cada ~18 caracteres, `crescer++`.
- `Perguntar` sobre um nó → vai para `/bimo`, limpa a seleção e preenche o
  rascunho com `O que eu já escrevi sobre 'Título'?` (título do nó entre aspas
  simples, como manda a seção de voz).

## 9. Campo de grafo

```text
compartilhado/grafo/
  CampoDeGrafo.tsx      # componente público; modo="ambiente" | "interativo"
  contrato.ts           # nos, arestas, noSelecionado, aoSelecionarNo, pulso, crescer
  fisica.ts             # deriva, ligações, partículas, nascimento de nó — puro
  implementacao-svg/    # render <Svg>, animação Reanimated na UI thread
```

`fisica.ts` não importa nada de React Native, então é testável de verdade.
Regras que ele implementa, todas do handoff:

- Deriva a ±0,12 px/frame dentro de um raio de `min(l,a) × 0,62`; ao passar de
  1,1× esse raio a velocidade inverte.
- Tamanhos: 1,1 px na maioria, 2 px em ~8%, 3,2 px em ~2%; pulsam ±6%.
- ~6% dos nós são "signal" em Iris.
- Ligações entre nós a menos de 22% do raio, no máximo 6 por nó.
- Partículas: 8 partículas de 2,4 px viajando entre nós aleatórios a
  0,012–0,024 do trajeto por frame, opacidade em pico no meio do caminho.
- Nó novo nasce a 30% do raio, cresce de 0,4× a 1× em ~50 frames e recebe uma
  partícula partindo de um vizinho.

Modo interativo: pan por arraste, zoom por pinça entre 0,6× e 2,4×, tap com
deslocamento menor que 6 px conta como toque no nó (raio de acerto = raio + 10
px), tap fora limpa a seleção. **Rótulo só em nós de peso ≥ 1,2 e no nó
selecionado** — decisão deliberada do handoff: em 390 px de largura, rotular
tudo vira ruído.

Trocar por Skia mais tarde = nova pasta `implementacao-skia/` respeitando
`contrato.ts`.

## 10. Intro, fontes e ícones

- Os dois MP4 são copiados para `assets/videos/`; a escolha entre claro e
  escuro sai de `useColorScheme()`. `expo-video`, com toque para pular. O
  splash nativo cobre até o primeiro frame.
- **Material Symbols variável não funciona em RN**: a plataforma não expõe
  eixos de fonte variável, então não dá para alternar `FILL: 1` dentro de uma
  família só. Solução: carregar duas TTF estáticas (Outlined e Rounded-Filled)
  e deixar `<Icone nome="psychology" preenchido />` escolher a família. O mapa
  nome→codepoint fica em `ui/Icone/codepoints.ts`, só com os 23 glifos que o
  design usa.
- Geist e JetBrains Mono via `@expo-google-fonts/*`, pesos 400/500/600.
- Sem logo, sem ilustração, sem foto, **sem emoji**. O ícone `psychology` faz o
  papel de marca. O único caractere decorativo é o ponto médio `·`.

## 11. Componentes compartilhados

`compartilhado/ui/`: `Botao` (primário / outline / ghost), `Pill`,
`Sheet` (bottom sheet com backdrop e slide-up de 300 ms), `CampoDeBusca`,
`Interruptor` (44×26, knob 20), `Chip` (mono 11 px), `Cartao` (vidro + blur 4),
`Avatar` (iniciais sobre `secundariaContainer`), `Icone`, `Vidro` (wrapper de
`expo-blur` que já aplica a tinta certa do tema).

`Cabecalho` e `TabSwitcher` moram em `app/(app)/_layout.tsx` por serem
estruturais de navegação.

## 12. Voz e conteúdo

Bimo é um colega competente que já leu suas notas: abre pelo que encontrou, sem
cortesia. Frases declarativas, sem exclamação e sem hedging. A IA diz **eu**; o
vault é **seu**. Especificidade é o tom — cita contagens, datas, pastas e
títulos, com títulos entre aspas simples na prosa. Vocabulário: vault, nota, nó,
tag, pasta, sync. Title Case em destinos e botões; sentence case em placeholders
e hints; eyebrows em maiúsculas com tracking largo. Tags mantêm o `#` e ficam em
minúsculas. Mensagens do agente têm de uma a três frases, e a evidência vem em
cartões.

## 13. Testes

`jest-expo` + Testing Library. Nesta fase, testar onde paga:

- `fisica.ts`: inversão da deriva a 1,1× raio, máximo de 6 ligações por nó,
  regra de rótulo (peso ≥ 1,2), nascimento de nó.
- Seletores e transições dos stores (a tabela da seção 8 vira casos de teste).
- Serviços fake: contrato cumprido, atraso aplicado.
- UI: smoke test por tela, sem asserção de pixel.

## 14. Riscos e pendências

| Risco | Mitigação |
|---|---|
| Frame rate do grafo em SVG com 110 nós | Densidade do ambiente reduzida (50/60/80), tudo animado na UI thread; se não bastar, o contrato permite migrar para Skia com dev build |
| `expo-blur` sobre conteúdo em movimento é caro no Android | Componente `Vidro` centraliza a decisão; pode virar cor sólida com opacidade no Android sem tocar nas telas |
| Densidade 70/90/110 do handoff não bate com a do app | Preset guardado em um único lugar; o hint da tela de Configurações mostra o valor real |
| SDK do Expo Go muda e quebra libs nativas | Versões fixadas no `package.json` gerado pelo `create-expo-app` |
