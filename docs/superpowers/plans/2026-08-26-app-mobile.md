# App Mobile Bimo — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir as telas do app mobile Bimo em React Native/Expo — chat, grafo do vault, editor de nota, perfil e configurações — com dados de exemplo, sem backend.

**Architecture:** Expo Router para rotas (dois destinos irmãos no header, sheets como rotas modais), feature-first em `src/funcionalidades/`, tema tipado próprio com tokens portados do handoff, campo de grafo em `react-native-svg` isolado atrás de um contrato, e dados vindos de serviços fake que implementam os mesmos contratos que a API real vai implementar depois.

**Tech Stack:** Expo (Expo Go), TypeScript strict, expo-router, zustand, react-native-svg, react-native-reanimated, react-native-gesture-handler, expo-blur, expo-video, jest-expo + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-08-26-bimo-mobile-design.md`

## Global Constraints

- Tudo em **pt-BR**: nomes de variáveis, funções, tipos, arquivos, comentários e textos de UI.
- **Nenhum componente escreve cor literal.** Toda cor vem de `useTema()`. Vale para hex, `rgb()` e `rgba()`.
- **Mobile-first.** Alvo de toque mínimo **44 px**.
- Pesos de fonte permitidos: **400, 500 e 600**. Não existe bold no sistema.
- **Sem emoji em lugar nenhum.** O único caractere decorativo é o ponto médio `·`.
- Nada de biblioteca que exija dev build — o app tem que rodar no **Expo Go**. Isso exclui `@shopify/react-native-skia`.
- Viewport de referência do design: **402 × 874 px**, status bar 54 px, home indicator 34 px. Usar `react-native-safe-area-context`, nunca esses números crus.
- Todo trabalho acontece dentro de `mobile/`. A pasta `mobile/desing-app-mobile/` é o handoff: **somente leitura**, fora do `tsconfig`.
- Raios: 4 (chips), 8 (cartões), 12 (bolhas, botões), 16 (dock, sheets), 9999 (pills, avatares).
- Movimento: 150 / 200 / 300 ms com `cubic-bezier(0.2, 0, 0, 1)`. Nada escala nem encolhe no press.
- **Voz do produto** (seção 12 do spec): frases declarativas, sem exclamação e sem hedging. A IA diz *eu*; o vault é *seu*. Title Case em destinos e botões (`Nova Nota`, `Abrir Nota`), sentence case em placeholders e hints, eyebrows em maiúsculas. Tags em minúsculas com `#`. Títulos de nota entre aspas simples na prosa.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `mobile/app/_layout.tsx` | Carrega fontes, monta `ProvedorDeTema`, `ProvedorDeServicos`, `GestureHandlerRootView`, segura o splash |
| `mobile/app/intro.tsx` | Vídeo de abertura, escolhe claro/escuro, navega para `/bimo` |
| `mobile/app/(app)/_layout.tsx` | Stack + `Cabecalho` persistente (marca, `TabSwitcher`, avatar) |
| `mobile/app/(app)/bimo.tsx` | Monta a tela de chat |
| `mobile/app/(app)/nota.tsx` | Monta a tela de grafo + folha |
| `mobile/app/(app)/editor/[id].tsx` | Monta o editor como modal full-screen |
| `mobile/app/(app)/perfil.tsx` | Monta o perfil como `formSheet` |
| `mobile/app/(app)/configuracoes.tsx` | Monta as configurações como `formSheet` |
| `src/compartilhado/tema/tokens/*.ts` | Valores crus: cores, tipografia, espaçamento, raios, sombras, movimento |
| `src/compartilhado/tema/ProvedorDeTema.tsx` | Escolhe claro/escuro por `useColorScheme()`, expõe `useTema()` |
| `src/compartilhado/ui/*` | Componentes sem domínio: `Botao`, `Chip`, `Cartao`, `Avatar`, `Pill`, `CampoDeBusca`, `Interruptor`, `Vidro`, `Icone`, `Sheet` |
| `src/compartilhado/grafo/contrato.ts` | Tipos e props do campo de grafo — a fronteira que permite trocar SVG por Skia |
| `src/compartilhado/grafo/fisica.ts` | Deriva, ligações, partículas, nascimento de nó. Puro, sem React Native |
| `src/compartilhado/grafo/implementacao-svg/` | Render em `<Svg>` + animação Reanimated |
| `src/dados/tipos.ts` | `Nota`, `Aresta`, `Mensagem`, `Perfil`, `Sugestao`, `TipoDeAcaoIA` |
| `src/dados/fixtures/*.ts` | Notas, arestas, mensagens e perfil de exemplo |
| `src/servicos/contratos.ts` | `ServicoVault`, `ServicoIA` |
| `src/servicos/fake/*.ts` | Implementações que leem fixtures com atraso artificial |
| `src/servicos/ProvedorDeServicos.tsx` | Injeta as implementações via Context |
| `src/funcionalidades/chat/` | Bolhas, cartão de resultado, indicador de digitação, composer, store |
| `src/funcionalidades/vault/` | Folha de notas, cartão de nota, chips de contexto, store |
| `src/funcionalidades/editor/` | Corpo do editor, menu de ações da IA, cartão de sugestão, store |
| `src/funcionalidades/conta/` | Menu de conta, perfil, configurações, store |

---

## Task 1: Esqueleto do projeto Expo

**Files:**
- Create: `mobile/package.json`, `mobile/app.json`, `mobile/tsconfig.json`, `mobile/.gitignore`, `mobile/jest.setup.ts`, `mobile/app/_layout.tsx`, `mobile/app/index.tsx`
- Test: `mobile/app/index.test.tsx`

**Interfaces:**
- Consumes: nada
- Produces: projeto Expo com `expo-router`, alias `@/*` → `src/*`, e `npm test` funcionando

- [ ] **Step 1: Criar o projeto num diretório temporário e mover para `mobile/`**

`mobile/` já existe e contém o handoff, então `create-expo-app` não pode rodar direto nela.

```bash
cd mobile
npx create-expo-app@latest .temp-expo --template blank-typescript
mv .temp-expo/package.json .temp-expo/app.json .temp-expo/tsconfig.json .temp-expo/.gitignore .
mv .temp-expo/assets/* assets/ 2>/dev/null || mkdir -p assets
rm -rf .temp-expo App.tsx
```

- [ ] **Step 2: Instalar as dependências de rota e teste**

```bash
cd mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-splash-screen
npm install --save-dev jest-expo jest @testing-library/react-native @types/jest
```

- [ ] **Step 3: Apontar o entrypoint para o expo-router e configurar o Jest**

Em `mobile/package.json`, trocar o campo `main` e acrescentar `scripts` e `jest`:

```json
{
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "lint": "expo lint",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEach": [],
    "setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|react-native-svg|react-native-reanimated|react-native-gesture-handler))"
    ]
  }
}
```

Remover a chave `setupFilesAfterEach` se o Jest reclamar dela — ela só está aqui para deixar claro que não usamos esse hook.

- [ ] **Step 4: Criar `mobile/jest.setup.ts`**

```ts
import "@testing-library/react-native/extend-expect";
```

- [ ] **Step 5: Configurar o `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
  "exclude": ["node_modules", "desing-app-mobile", ".temp-expo"]
}
```

- [ ] **Step 6: Ligar typed routes no `app.json`**

Dentro do objeto `expo`, acrescentar:

```json
"scheme": "bimo",
"plugins": ["expo-router"],
"experiments": { "typedRoutes": true }
```

- [ ] **Step 7: Escrever o teste que falha**

`mobile/app/index.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import Index from "./index";

describe("rota inicial", () => {
  it("renderiza a marca do app", () => {
    render(<Index />);
    expect(screen.getByText("Bimo")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 8: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 9: Criar o layout raiz e a rota inicial**

`mobile/app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function LayoutRaiz() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`mobile/app/index.tsx`:

```tsx
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View>
      <Text>Bimo</Text>
    </View>
  );
}
```

- [ ] **Step 10: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test`
Expected: PASS, 1 teste

- [ ] **Step 11: Confirmar que o app sobe no Expo Go**

Run: `cd mobile && npx expo start`
Expected: QR code impresso; abrindo no Expo Go aparece a palavra "Bimo". Encerrar com `Ctrl+C`.

- [ ] **Step 12: Commit**

```bash
git add mobile docs/superpowers/specs/2026-08-26-bimo-mobile-design.md
git commit -m "feat(mobile): esqueleto do projeto Expo com expo-router e jest"
```

---

## Task 2: Tokens de tema e `useTema()`

**Files:**
- Create: `mobile/src/compartilhado/tema/tokens/cores.ts`, `tipografia.ts`, `espacamento.ts`, `raios.ts`, `sombras.ts`, `movimento.ts`, `mobile/src/compartilhado/tema/ProvedorDeTema.tsx`, `mobile/src/compartilhado/tema/index.ts`
- Test: `mobile/src/compartilhado/tema/tema.test.tsx`

**Interfaces:**
- Consumes: nada
- Produces: `useTema(): Tema` onde `Tema = { cores: Cores; tipografia: Tipografia; espacamento: Espacamento; raios: Raios; sombras: Sombras; movimento: Movimento }`; `<ProvedorDeTema>{children}</ProvedorDeTema>`

- [ ] **Step 1: Escrever o teste que falha**

`mobile/src/compartilhado/tema/tema.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react-native";
import { useColorScheme } from "react-native";
import { ProvedorDeTema, useTema } from "./index";
import { coresClaro, coresEscuro } from "./tokens/cores";

jest.mock("react-native/Libraries/Utilities/useColorScheme");
const useColorSchemeMock = useColorScheme as jest.Mock;

function envolver({ children }: { children: React.ReactNode }) {
  return <ProvedorDeTema>{children}</ProvedorDeTema>;
}

describe("useTema", () => {
  it("usa a paleta clara quando o sistema está em claro", () => {
    useColorSchemeMock.mockReturnValue("light");
    const { result } = renderHook(() => useTema(), { wrapper: envolver });
    expect(result.current.cores.primaria).toBe("#5e4bc0");
  });

  it("usa a paleta escura quando o sistema está em escuro", () => {
    useColorSchemeMock.mockReturnValue("dark");
    const { result } = renderHook(() => useTema(), { wrapper: envolver });
    expect(result.current.cores.primaria).toBe("#c9bfff");
  });

  it("mantém as duas paletas com exatamente as mesmas chaves", () => {
    expect(Object.keys(coresClaro).sort()).toEqual(Object.keys(coresEscuro).sort());
  });

  it("expõe as escalas do handoff", () => {
    useColorSchemeMock.mockReturnValue("light");
    const { result } = renderHook(() => useTema(), { wrapper: envolver });
    expect(result.current.espacamento.gutter).toBe(16);
    expect(result.current.raios.bolha).toBe(12);
    expect(result.current.tipografia.titleSm.fontWeight).toBe("600");
    expect(result.current.movimento.duracaoLenta).toBe(300);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- tema`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: Escrever `tokens/cores.ts`**

O bloco `coresEscuro` está inteiro na seção 6.2 do spec — copiar de lá, verbatim. `coresClaro` sai dos valores de `design/tokens/colors.css`, com as mesmas chaves:

```ts
export const coresClaro = {
  primaria: "#5e4bc0",
  sobrePrimaria: "#ffffff",
  primariaContainer: "#9988ff",
  sobrePrimariaContainer: "#2f1191",
  primariaInversa: "#c9bfff",
  primariaHover: "#9988ff",
  primariaFixa: "#e5deff",
  primariaFixaDim: "#c9bfff",
  sobrePrimariaFixa: "#1a0063",
  sobrePrimariaFixaVariante: "#4631a7",

  secundaria: "#4bb6c0",
  sobreSecundaria: "#ffffff",
  secundariaContainer: "#88f5ff",
  sobreSecundariaContainer: "#118691",
  secundariaFixa: "#defcff",
  secundariaFixaDim: "#bffaff",
  sobreSecundariaFixa: "#005b63",
  sobreSecundariaFixaVariante: "#319da7",

  terciaria: "#5e5d69",
  sobreTerciaria: "#ffffff",
  terciariaContainer: "#bab8c6",
  sobreTerciariaContainer: "#494955",
  terciariaFixa: "#e3e1ef",
  terciariaFixaDim: "#c7c5d3",
  sobreTerciariaFixa: "#1b1b25",
  sobreTerciariaFixaVariante: "#464651",

  erro: "#ba1a1a",
  sobreErro: "#ffffff",
  erroContainer: "#ffdad6",
  sobreErroContainer: "#93000a",

  fundo: "#fcf8fb",
  sobreFundo: "#1b1b1d",
  superficie: "#fcf8fb",
  superficieDim: "#dcd9dc",
  superficieClara: "#fcf8fb",
  superficieContainerMinima: "#ffffff",
  superficieContainerBaixa: "#f6f3f5",
  superficieContainer: "#f0edef",
  superficieContainerAlta: "#eae7ea",
  superficieContainerMaxima: "#e4e2e4",
  superficieVariante: "#e4e2e4",
  sobreSuperficie: "#1b1b1d",
  sobreSuperficieVariante: "#3e4a40",
  superficieInversa: "#303032",
  sobreSuperficieInversa: "#f3f0f2",
  contorno: "#6e7a6f",
  contornoVariante: "#bdcabd",
  tintaSuperficie: "#5e4bc0",

  textoCorpo: "#1b1b1d",
  textoSuave: "#3e4a40",
  textoTenue: "#6e7a6f",
  textoPlaceholder: "#bdcabd",
  textoLink: "#5e4bc0",
  textoSobreAcento: "#ffffff",
  superficiePagina: "#fcf8fb",
  superficieCartao: "#f6f3f5",
  superficieLinhaAtiva: "#f6f3f5",
  superficieChip: "#eae7ea",
  superficieCodigo: "#303032",
  textoCodigo: "#1b1b25",
  fioDeCabelo: "#bdcabd",
  fioDeCabeloForte: "#6e7a6f",

  vidroBarra: "rgba(252,248,251,0.90)",
  vidroBolha: "rgba(252,248,251,0.60)",
  vidroDock: "rgba(252,248,251,0.60)",
  vidroFolha: "rgba(252,248,251,0.85)",
  vidroCartao: "rgba(246,243,245,0.80)",
  bolhaUsuario: "rgba(94,75,192,0.90)",
  bolhaUsuarioBorda: "rgba(94,75,192,0.20)",
  protecaoDock: ["#fcf8fb", "rgba(252,248,251,0.60)", "rgba(252,248,251,0)"],
  tintaDoBlur: "light",

  backdrop: "rgba(27,27,29,0.18)",

  anelFoco: "#5e4bc0",
  anelFocoSuave: "rgba(94,75,192,0.20)",

  grafoNoBase: "#889299",
  grafoNoSuave: "#a0aab2",
  grafoNoTenue: "#dcd9dc",
  grafoNoSinal: "#5e4bc0",
  grafoLigacao: "rgba(136,146,153,0.15)",
  grafoMistura: "multiply",
  grafoNoPreenchimento: "#fcf8fb",
  grafoNoBorda: "#6e7a6f",
  grafoNoRotulo: "#3e4a40",
  grafoNoRotuloSelecionado: "#1b1b1d",
  grafoLigacaoNomeada: "rgba(94,75,192,0.22)",
  grafoAnelSelecao: "rgba(94,75,192,0.35)",
} as const;

export type Cores = typeof coresClaro;
```

`coresEscuro` recebe também `backdrop: "rgba(27,27,29,0.18)"` — o backdrop das sheets é o mesmo nos dois temas, por decisão do handoff. Tipar como `export const coresEscuro: Cores = { ... }` para o TypeScript garantir que nenhuma chave falte.

- [ ] **Step 4: Escrever os demais arquivos de token**

`tokens/tipografia.ts`:

```ts
export const familias = {
  sans: "Geist_400Regular",
  sansMedia: "Geist_500Medium",
  sansForte: "Geist_600SemiBold",
  mono: "JetBrainsMono_400Regular",
} as const;

export const tipografia = {
  displayMd: { fontFamily: familias.sansForte, fontSize: 24, lineHeight: 32, fontWeight: "600", letterSpacing: -0.48 },
  headlineSm: { fontFamily: familias.sansForte, fontSize: 18, lineHeight: 26, fontWeight: "600", letterSpacing: -0.27 },
  titleMd: { fontFamily: familias.sansForte, fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: -0.16 },
  titleSm: { fontFamily: familias.sansForte, fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: -0.07 },
  corpo: { fontFamily: familias.sans, fontSize: 14, lineHeight: 22, fontWeight: "400", letterSpacing: 0 },
  corpoMedio: { fontFamily: familias.sansMedia, fontSize: 14, lineHeight: 22, fontWeight: "500", letterSpacing: 0 },
  corpoRelaxado: { fontFamily: familias.sans, fontSize: 14, lineHeight: 22.75, fontWeight: "400", letterSpacing: 0 },
  rotuloSm: { fontFamily: familias.sansMedia, fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.12 },
  legenda: { fontFamily: familias.sans, fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0 },
  sobrancelha: { fontFamily: familias.sansMedia, fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.96 },
  codigo: { fontFamily: familias.mono, fontSize: 12, lineHeight: 18, fontWeight: "400", letterSpacing: 0 },
  chip: { fontFamily: familias.mono, fontSize: 11, lineHeight: 14, fontWeight: "400", letterSpacing: 0 },
} as const;

export type Tipografia = typeof tipografia;
```

`letterSpacing` em RN é ponto absoluto, não `em` — por isso `-0.02em` em 24 px vira `-0.48`. `corpoRelaxado` é o `line-height: 1.625` do chat (14 × 1.625 = 22.75). `sobrancelha` é o `letter-spacing: .08em` em 12 px (0.96); quem usar aplica `textTransform: "uppercase"`.

`tokens/espacamento.ts`:

```ts
export const espacamento = {
  xs: 4, sm: 8, md: 12, gutter: 16, lg: 20, xl: 24,
  alturaCabecalho: 56,
  alvoDeToque: 44,
  alturaMaximaComposer: 160,
  larguraMaximaColuna: 672,
} as const;

export type Espacamento = typeof espacamento;
```

`tokens/raios.ts`:

```ts
export const raios = {
  chip: 4, cartao: 8, bolha: 12, cauda: 6, folha: 16, pill: 9999,
} as const;

export type Raios = typeof raios;
```

`tokens/sombras.ts`:

```ts
import type { ViewStyle } from "react-native";

type Sombra = Pick<ViewStyle, "shadowColor" | "shadowOpacity" | "shadowRadius" | "shadowOffset" | "elevation">;

export const sombrasClaro = {
  pequena: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  grande: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
} satisfies Record<string, Sombra>;

export const sombrasEscuro = {
  pequena: { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  grande: { shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
} satisfies Record<string, Sombra>;

export type Sombras = typeof sombrasClaro;
```

`tokens/movimento.ts`:

```ts
import { Easing } from "react-native-reanimated";

export const movimento = {
  duracaoRapida: 150,
  duracaoBase: 200,
  duracaoLenta: 300,
  curvaPadrao: Easing.bezier(0.2, 0, 0, 1),
} as const;

export type Movimento = typeof movimento;
```

`react-native-reanimated` só entra no projeto na Task 9. Até lá, definir `curvaPadrao` como a tupla `[0.2, 0, 0, 1] as const` e trocar pela `Easing.bezier` na Task 9 — a chave e o nome não mudam.

- [ ] **Step 5: Escrever `ProvedorDeTema.tsx` e `index.ts`**

```tsx
// ProvedorDeTema.tsx
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { coresClaro, coresEscuro, type Cores } from "./tokens/cores";
import { sombrasClaro, sombrasEscuro, type Sombras } from "./tokens/sombras";
import { tipografia, type Tipografia } from "./tokens/tipografia";
import { espacamento, type Espacamento } from "./tokens/espacamento";
import { raios, type Raios } from "./tokens/raios";
import { movimento, type Movimento } from "./tokens/movimento";

export type Tema = {
  cores: Cores;
  sombras: Sombras;
  tipografia: Tipografia;
  espacamento: Espacamento;
  raios: Raios;
  movimento: Movimento;
  escuro: boolean;
};

const ContextoDeTema = createContext<Tema | null>(null);

export function ProvedorDeTema({ children }: { children: ReactNode }) {
  const esquema = useColorScheme();
  const escuro = esquema === "dark";

  const tema = useMemo<Tema>(
    () => ({
      cores: escuro ? coresEscuro : coresClaro,
      sombras: escuro ? sombrasEscuro : sombrasClaro,
      tipografia,
      espacamento,
      raios,
      movimento,
      escuro,
    }),
    [escuro],
  );

  return <ContextoDeTema.Provider value={tema}>{children}</ContextoDeTema.Provider>;
}

export function useTema(): Tema {
  const tema = useContext(ContextoDeTema);
  if (!tema) throw new Error("useTema precisa estar dentro de ProvedorDeTema");
  return tema;
}
```

```ts
// index.ts
export { ProvedorDeTema, useTema, type Tema } from "./ProvedorDeTema";
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test -- tema`
Expected: PASS, 4 testes

- [ ] **Step 7: Montar o provedor no layout raiz**

Em `mobile/app/_layout.tsx`, envolver o `Stack`:

```tsx
import { Stack } from "expo-router";
import { ProvedorDeTema } from "@/compartilhado/tema";

export default function LayoutRaiz() {
  return (
    <ProvedorDeTema>
      <Stack screenOptions={{ headerShown: false }} />
    </ProvedorDeTema>
  );
}
```

- [ ] **Step 8: Rodar a suíte inteira**

Run: `cd mobile && npm test`
Expected: PASS, 5 testes

- [ ] **Step 9: Commit**

```bash
git add mobile/src/compartilhado/tema mobile/app/_layout.tsx
git commit -m "feat(mobile): tokens de tema claro e escuro com useTema"
```

---

## Task 3: Fontes e o componente `Icone`

**Files:**
- Create: `mobile/src/compartilhado/ui/Icone/codepoints.ts`, `mobile/src/compartilhado/ui/Icone/Icone.tsx`, `mobile/src/compartilhado/ui/Icone/index.ts`, `mobile/src/compartilhado/tema/useFontes.ts`
- Modify: `mobile/app/_layout.tsx`
- Test: `mobile/src/compartilhado/ui/Icone/Icone.test.tsx`

**Interfaces:**
- Consumes: `useTema()` da Task 2
- Produces: `<Icone nome={NomeDeIcone} tamanho={number} cor={string} preenchido?={boolean} />`; `useFontes(): boolean` (true quando carregadas)

- [ ] **Step 1: Baixar as duas TTF de Material Symbols**

Material Symbols é uma fonte variável e o React Native não expõe eixos de fonte variável — por isso o `FILL: 1` do handoff precisa de **duas famílias estáticas**.

Baixar as instâncias estáticas para `mobile/assets/fontes/`:
- `MaterialSymbolsOutlined.ttf` (FILL 0, weight 400)
- `MaterialSymbolsRounded-Fill.ttf` (FILL 1, weight 400)

Fonte: <https://github.com/google/material-design-icons/tree/master/variablefont>. Instanciar com `fonttools`:

```bash
pip install fonttools
fonttools varLib.instancer MaterialSymbolsOutlined.ttf FILL=0 wght=400 GRAD=0 opsz=24 -o assets/fontes/MaterialSymbolsOutlined.ttf
fonttools varLib.instancer MaterialSymbolsOutlined.ttf FILL=1 wght=400 GRAD=0 opsz=24 -o assets/fontes/MaterialSymbolsRounded-Fill.ttf
```

- [ ] **Step 2: Instalar as fontes de texto**

```bash
cd mobile
npx expo install expo-font @expo-google-fonts/geist @expo-google-fonts/jetbrains-mono
```

- [ ] **Step 3: Escrever o teste que falha**

`mobile/src/compartilhado/ui/Icone/Icone.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { Icone } from "./index";
import { codepoints } from "./codepoints";

function renderizar(elemento: React.ReactElement) {
  return render(<ProvedorDeTema>{elemento}</ProvedorDeTema>);
}

describe("Icone", () => {
  it("renderiza o glifo correspondente ao nome", () => {
    renderizar(<Icone nome="psychology" tamanho={22} testID="icone" />);
    expect(screen.getByTestId("icone")).toHaveTextContent(codepoints.psychology);
  });

  it("usa a família preenchida quando preenchido", () => {
    renderizar(<Icone nome="folder" tamanho={16} preenchido testID="icone" />);
    expect(screen.getByTestId("icone")).toHaveStyle({ fontFamily: "MaterialSymbolsRounded-Fill" });
  });

  it("usa a família contornada por padrão", () => {
    renderizar(<Icone nome="folder" tamanho={16} testID="icone" />);
    expect(screen.getByTestId("icone")).toHaveStyle({ fontFamily: "MaterialSymbolsOutlined" });
  });

  it("cobre os 23 glifos que o design usa", () => {
    expect(Object.keys(codepoints)).toHaveLength(23);
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- Icone`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 5: Escrever `codepoints.ts`**

Os 23 glifos que o handoff lista. Conferir cada codepoint em <https://fonts.google.com/icons> (aba "Android", campo "codepoint") antes de colar:

```ts
export const codepoints = {
  psychology: "\uea4a",
  description: "\ue873",
  hub: "\ue9f4",
  search: "\ue8b6",
  forum: "\ue0bf",
  settings: "\ue8b8",
  person: "\ue7fd",
  logout: "\ue9ba",
  cloud: "\ue2bd",
  sync: "\ue627",
  info: "\ue88e",
  add: "\ue145",
  edit: "\ue3c9",
  close: "\ue5cd",
  arrow_back: "\ue5c4",
  arrow_upward: "\ue5d8",
  attach_file: "\ue226",
  center_focus_strong: "\ue3b4",
  sell: "\uf05b",
  open_in_full: "\uf1ce",
  folder: "\ue2c7",
  folder_open: "\ue2c8",
  more_horiz: "\ue5d3",
} as const;

export type NomeDeIcone = keyof typeof codepoints;
```

- [ ] **Step 6: Escrever `Icone.tsx`**

```tsx
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { codepoints, type NomeDeIcone } from "./codepoints";

type Props = {
  nome: NomeDeIcone;
  tamanho: number;
  cor?: string;
  preenchido?: boolean;
  estilo?: StyleProp<TextStyle>;
  testID?: string;
};

export function Icone({ nome, tamanho, cor, preenchido = false, estilo, testID }: Props) {
  const { cores } = useTema();

  return (
    <Text
      testID={testID}
      allowFontScaling={false}
      style={[
        {
          fontFamily: preenchido ? "MaterialSymbolsRounded-Fill" : "MaterialSymbolsOutlined",
          fontSize: tamanho,
          lineHeight: tamanho,
          color: cor ?? cores.contorno,
        },
        estilo,
      ]}
    >
      {codepoints[nome]}
    </Text>
  );
}
```

`allowFontScaling={false}` é obrigatório: sem ele o ajuste de fonte do sistema desalinha o glifo do seu box.

`index.ts`:

```ts
export { Icone } from "./Icone";
export { codepoints, type NomeDeIcone } from "./codepoints";
```

- [ ] **Step 7: Escrever `useFontes.ts`**

```ts
import { useFonts } from "expo-font";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from "@expo-google-fonts/geist";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";

export function useFontes(): boolean {
  const [carregadas] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    JetBrainsMono_400Regular,
    MaterialSymbolsOutlined: require("../../../assets/fontes/MaterialSymbolsOutlined.ttf"),
    "MaterialSymbolsRounded-Fill": require("../../../assets/fontes/MaterialSymbolsRounded-Fill.ttf"),
  });

  return carregadas;
}
```

- [ ] **Step 8: Segurar o splash até as fontes carregarem**

`mobile/app/_layout.tsx`:

```tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { useFontes } from "@/compartilhado/tema/useFontes";

SplashScreen.preventAutoHideAsync();

export default function LayoutRaiz() {
  const fontesCarregadas = useFontes();

  useEffect(() => {
    if (fontesCarregadas) SplashScreen.hideAsync();
  }, [fontesCarregadas]);

  if (!fontesCarregadas) return null;

  return (
    <ProvedorDeTema>
      <Stack screenOptions={{ headerShown: false }} />
    </ProvedorDeTema>
  );
}
```

- [ ] **Step 9: Rodar os testes e confirmar que passam**

Run: `cd mobile && npm test`
Expected: PASS, 9 testes

- [ ] **Step 10: Conferir os glifos no Expo Go**

Trocar temporariamente `app/index.tsx` por uma grade com os 23 ícones, rodar `npx expo start` e confirmar visualmente que nenhum aparece como quadrado vazio ou como letra solta. Se algum falhar, o codepoint está errado — corrigir em `codepoints.ts`. Reverter `app/index.tsx` depois.

- [ ] **Step 11: Commit**

```bash
git add mobile/src/compartilhado/ui/Icone mobile/src/compartilhado/tema/useFontes.ts mobile/app/_layout.tsx mobile/assets/fontes
git commit -m "feat(mobile): carrega Geist, JetBrains Mono e Material Symbols com o componente Icone"
```

---

## Task 4: Tipos, fixtures e serviços fake

**Files:**
- Create: `mobile/src/dados/tipos.ts`, `mobile/src/dados/fixtures/notas.ts`, `fixtures/arestas.ts`, `fixtures/mensagens.ts`, `fixtures/perfil.ts`, `mobile/src/servicos/contratos.ts`, `mobile/src/servicos/fake/servicoVaultFake.ts`, `fake/servicoIaFake.ts`, `mobile/src/servicos/ProvedorDeServicos.tsx`, `mobile/src/servicos/index.ts`
- Test: `mobile/src/servicos/fake/servicosFake.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type Nota = { id: string; titulo: string; pasta: string; tags: string[]; corpo: string; resumo: string; editadaEm: string; conexoes: number }`
  - `type Aresta = { de: string; para: string }`
  - `type Mensagem = { id: string; autor: "usuario" | "agente"; texto: string; horario: string; cartoes?: string[] }`
  - `type Perfil = { nome: string; email: string; comoMeTratar: string }`
  - `type TipoDeAcaoIA = "links" | "resumo" | "tags" | "continuar" | "perguntar"`
  - `type Sugestao = { tipo: TipoDeAcaoIA; rotulo: string; texto: string; tags?: string[] }`
  - `interface ServicoVault`, `interface ServicoIA`
  - `useServicos(): { vault: ServicoVault; ia: ServicoIA }`

- [ ] **Step 1: Escrever o teste que falha**

`mobile/src/servicos/fake/servicosFake.test.ts`:

```ts
import { servicoVaultFake } from "./servicoVaultFake";
import { servicoIaFake } from "./servicoIaFake";

describe("servicoVaultFake", () => {
  it("lista as notas do fixture", async () => {
    const notas = await servicoVaultFake.listarNotas();
    expect(notas.length).toBeGreaterThanOrEqual(12);
    expect(notas[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        titulo: expect.any(String),
        pasta: expect.any(String),
        conexoes: expect.any(Number),
      }),
    );
  });

  it("obtém uma nota pelo id", async () => {
    const notas = await servicoVaultFake.listarNotas();
    const nota = await servicoVaultFake.obterNota(notas[0].id);
    expect(nota.id).toBe(notas[0].id);
  });

  it("recusa um id inexistente", async () => {
    await expect(servicoVaultFake.obterNota("nao-existe")).rejects.toThrow("Nota não encontrada");
  });

  it("só produz arestas entre ids que existem", async () => {
    const notas = await servicoVaultFake.listarNotas();
    const ids = new Set(notas.map((nota) => nota.id));
    const arestas = await servicoVaultFake.listarArestas();
    expect(arestas.length).toBeGreaterThan(0);
    for (const aresta of arestas) {
      expect(ids.has(aresta.de)).toBe(true);
      expect(ids.has(aresta.para)).toBe(true);
    }
  });

  it("salva uma nota e devolve o conteúdo novo na leitura seguinte", async () => {
    const notas = await servicoVaultFake.listarNotas();
    await servicoVaultFake.salvarNota({ ...notas[0], titulo: "Título trocado" });
    const nota = await servicoVaultFake.obterNota(notas[0].id);
    expect(nota.titulo).toBe("Título trocado");
  });
});

describe("servicoIaFake", () => {
  it("responde com texto e cartões que apontam para notas reais", async () => {
    const notas = await servicoVaultFake.listarNotas();
    const ids = new Set(notas.map((nota) => nota.id));
    const resposta = await servicoIaFake.conversar("o que eu escrevi sobre notas atômicas?");
    expect(resposta.texto.length).toBeGreaterThan(0);
    for (const id of resposta.cartoes) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("devolve uma sugestão para cada uma das cinco ações", async () => {
    const [nota] = await servicoVaultFake.listarNotas();
    const tipos = ["links", "resumo", "tags", "continuar", "perguntar"] as const;
    for (const tipo of tipos) {
      const sugestao = await servicoIaFake.acaoNaNota(tipo, nota);
      expect(sugestao.tipo).toBe(tipo);
      expect(sugestao.rotulo.length).toBeGreaterThan(0);
      expect(sugestao.texto.length).toBeGreaterThan(0);
    }
  });

  it("devolve tags na ação de tags", async () => {
    const [nota] = await servicoVaultFake.listarNotas();
    const sugestao = await servicoIaFake.acaoNaNota("tags", nota);
    expect(sugestao.tags?.every((tag) => tag.startsWith("#") && tag === tag.toLowerCase())).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- servicosFake`
Expected: FAIL — `Cannot find module './servicoVaultFake'`

- [ ] **Step 3: Escrever `src/dados/tipos.ts`**

```ts
export type Nota = {
  id: string;
  titulo: string;
  pasta: string;
  tags: string[];
  corpo: string;
  resumo: string;
  editadaEm: string;
  conexoes: number;
};

export type Aresta = { de: string; para: string };

export type Mensagem = {
  id: string;
  autor: "usuario" | "agente";
  texto: string;
  horario: string;
  cartoes?: string[];
};

export type Perfil = { nome: string; email: string; comoMeTratar: string };

export type TipoDeAcaoIA = "links" | "resumo" | "tags" | "continuar" | "perguntar";

export type Sugestao = {
  tipo: TipoDeAcaoIA;
  rotulo: string;
  texto: string;
  tags?: string[];
};

export type RespostaAgente = { texto: string; cartoes: string[] };

export type NoDoGrafo = { id: string; titulo: string; x: number; y: number; peso: number };
```

`x` e `y` de `NoDoGrafo` são normalizados (0–1), como manda o handoff.

- [ ] **Step 4: Escrever as fixtures**

`fixtures/notas.ts` com **14 notas** em pt-BR, distribuídas em pelo menos 4 pastas (`Zettelkasten`, `Projetos`, `Diário`, `Referências`). Cada nota precisa de `resumo` com 1–2 frases, `corpo` com 3–6 parágrafos e `tags` em minúsculas com `#`. Modelo da primeira, seguir o mesmo formato nas outras 13:

```ts
import type { Nota } from "../tipos";

export const notas: Nota[] = [
  {
    id: "notas-atomicas",
    titulo: "Notas atômicas",
    pasta: "Zettelkasten",
    tags: ["#método", "#escrita"],
    corpo:
      "Uma nota atômica carrega uma ideia só. O teste é conseguir dar a ela um título que seja uma afirmação completa.\n\nQuando o título precisa de um 'e' para caber, são duas notas.\n\nA vantagem não é a organização: é que uma ideia isolada pode ser ligada a qualquer outra sem arrastar contexto junto.",
    resumo: "Uma nota carrega uma ideia só; o título tem que funcionar como afirmação completa.",
    editadaEm: "2026-01-14",
    conexoes: 7,
  },
  // ... mais 13
];
```

`fixtures/arestas.ts`: pelo menos 24 arestas, todas entre ids que existem em `notas.ts`, com o grafo conectado o bastante para a vizinhança de qualquer nó ter de 2 a 7 vizinhos.

`fixtures/mensagens.ts`: a conversa inicial do protótipo, exportada como `mensagensIniciais: Mensagem[]` (o nome importa: a Task 11 importa exatamente esse). Uma mensagem do agente com 2 cartões e `horario: "09:41"`.

`fixtures/perfil.ts`:

```ts
import type { Perfil } from "../tipos";

export const perfil: Perfil = {
  nome: "Marina Alves",
  email: "marina@exemplo.com",
  comoMeTratar: "Direto, sem rodeio. Cita a pasta e a data quando trouxer uma nota.",
};
```

As iniciais "MA" do avatar no handoff vêm daí.

- [ ] **Step 5: Escrever `src/servicos/contratos.ts`**

```ts
import type { Aresta, Nota, RespostaAgente, Sugestao, TipoDeAcaoIA } from "@/dados/tipos";

export interface ServicoVault {
  listarNotas(): Promise<Nota[]>;
  obterNota(id: string): Promise<Nota>;
  listarArestas(): Promise<Aresta[]>;
  salvarNota(nota: Nota): Promise<void>;
}

export interface ServicoIA {
  conversar(texto: string): Promise<RespostaAgente>;
  acaoNaNota(tipo: TipoDeAcaoIA, nota: Nota): Promise<Sugestao>;
}
```

- [ ] **Step 6: Escrever as implementações fake**

```ts
// fake/atraso.ts
export function atraso(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

```ts
// fake/servicoVaultFake.ts
import type { Aresta, Nota } from "@/dados/tipos";
import type { ServicoVault } from "../contratos";
import { notas as notasIniciais } from "@/dados/fixtures/notas";
import { arestas } from "@/dados/fixtures/arestas";
import { atraso } from "./atraso";

let notasEmMemoria: Nota[] = notasIniciais.map((nota) => ({ ...nota }));

export const servicoVaultFake: ServicoVault = {
  async listarNotas() {
    await atraso(120);
    return notasEmMemoria.map((nota) => ({ ...nota }));
  },

  async obterNota(id) {
    await atraso(80);
    const nota = notasEmMemoria.find((candidata) => candidata.id === id);
    if (!nota) throw new Error("Nota não encontrada");
    return { ...nota };
  },

  async listarArestas() {
    await atraso(120);
    return arestas.map((aresta) => ({ ...aresta }));
  },

  async salvarNota(nota) {
    await atraso(200);
    const indice = notasEmMemoria.findIndex((candidata) => candidata.id === nota.id);
    if (indice === -1) notasEmMemoria = [...notasEmMemoria, { ...nota }];
    else notasEmMemoria = notasEmMemoria.map((candidata, i) => (i === indice ? { ...nota } : candidata));
  },
};
```

```ts
// fake/servicoIaFake.ts
import type { Nota, Sugestao, TipoDeAcaoIA } from "@/dados/tipos";
import type { ServicoIA } from "../contratos";
import { notas } from "@/dados/fixtures/notas";
import { atraso } from "./atraso";

const ATRASO_DA_RESPOSTA = 1600;

export const servicoIaFake: ServicoIA = {
  async conversar(texto) {
    await atraso(ATRASO_DA_RESPOSTA);
    const termo = texto.toLowerCase();
    const encontradas = notas
      .filter((nota) => nota.titulo.toLowerCase().includes(termo) || nota.resumo.toLowerCase().includes(termo))
      .slice(0, 2);
    const escolhidas = encontradas.length > 0 ? encontradas : notas.slice(0, 2);

    return {
      texto: `Encontrei ${escolhidas.length} ${escolhidas.length === 1 ? "nota" : "notas"} sobre isso no seu vault. A mais desenvolvida é '${escolhidas[0].titulo}', da pasta ${escolhidas[0].pasta}.`,
      cartoes: escolhidas.map((nota) => nota.id),
    };
  },

  async acaoNaNota(tipo: TipoDeAcaoIA, nota: Nota): Promise<Sugestao> {
    await atraso(900);

    switch (tipo) {
      case "links":
        return {
          tipo,
          rotulo: "Sugerir links",
          texto: `Esta nota conversa com '${notas[1].titulo}' e '${notas[2].titulo}'. Posso inserir os dois wikilinks no fim do corpo.\n\n[[${notas[1].titulo}]]\n[[${notas[2].titulo}]]`,
        };
      case "resumo":
        return {
          tipo,
          rotulo: "Resumir a nota",
          texto: `${nota.resumo} A nota tem ${nota.conexoes} conexões e foi editada em ${nota.editadaEm}.`,
        };
      case "tags":
        return {
          tipo,
          rotulo: "Extrair tags",
          texto: "Três tags cobrem o que está escrito aqui:",
          tags: ["#método", "#vault", "#escrita"],
        };
      case "continuar":
        return {
          tipo,
          rotulo: "Continuar escrevendo",
          texto: "O ponto que falta é o custo: manter notas atômicas exige revisitar títulos toda vez que uma ideia se divide.",
        };
      case "perguntar":
        return {
          tipo,
          rotulo: "Perguntar sobre a nota",
          texto: `Sobre '${nota.titulo}': o que eu ainda não desenvolvi é a relação com as notas da pasta ${nota.pasta}.`,
        };
    }
  },
};
```

- [ ] **Step 7: Escrever `ProvedorDeServicos.tsx` e `index.ts`**

```tsx
import { createContext, useContext, type ReactNode } from "react";
import type { ServicoIA, ServicoVault } from "./contratos";
import { servicoVaultFake } from "./fake/servicoVaultFake";
import { servicoIaFake } from "./fake/servicoIaFake";

export type Servicos = { vault: ServicoVault; ia: ServicoIA };

const padrao: Servicos = { vault: servicoVaultFake, ia: servicoIaFake };
const ContextoDeServicos = createContext<Servicos>(padrao);

export function ProvedorDeServicos({ children, servicos = padrao }: { children: ReactNode; servicos?: Servicos }) {
  return <ContextoDeServicos.Provider value={servicos}>{children}</ContextoDeServicos.Provider>;
}

export function useServicos(): Servicos {
  return useContext(ContextoDeServicos);
}
```

A prop `servicos` existe para os testes injetarem dublês sem mexer em tela.

```ts
// index.ts
export { ProvedorDeServicos, useServicos, type Servicos } from "./ProvedorDeServicos";
export type { ServicoIA, ServicoVault } from "./contratos";
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test -- servicosFake`
Expected: PASS, 8 testes. O teste do `conversar` leva ~1,6 s — é o atraso artificial, está correto.

- [ ] **Step 9: Montar o provedor no layout raiz**

Em `mobile/app/_layout.tsx`, envolver o `Stack` com `<ProvedorDeServicos>` por dentro de `<ProvedorDeTema>`.

- [ ] **Step 10: Rodar a suíte inteira**

Run: `cd mobile && npm test`
Expected: PASS, 17 testes

- [ ] **Step 11: Commit**

```bash
git add mobile/src/dados mobile/src/servicos mobile/app/_layout.tsx
git commit -m "feat(mobile): tipos de dominio, fixtures e servicos fake atras de contratos"
```

---

## Task 5: Componentes de UI sem domínio

**Files:**
- Create: `mobile/src/compartilhado/ui/Vidro.tsx`, `Botao.tsx`, `Chip.tsx`, `Cartao.tsx`, `Avatar.tsx`, `Pill.tsx`, `CampoDeBusca.tsx`, `Interruptor.tsx`, `Sobrancelha.tsx`, `index.ts`
- Test: `mobile/src/compartilhado/ui/ui.test.tsx`

**Interfaces:**
- Consumes: `useTema()` (Task 2), `Icone` (Task 3)
- Produces:
  - `<Vidro nivel="barra" | "bolha" | "dock" | "folha" | "cartao" style?>`
  - `<Botao variante="primario" | "outline" | "ghost" rotulo icone? aoTocar />`
  - `<Chip rotulo destacado? />`
  - `<Cartao aoTocar? selecionado? style?>`
  - `<Avatar iniciais tamanho aoTocar? />`
  - `<Pill rotulo ativo aoTocar />`
  - `<CampoDeBusca valor aoMudar placeholder />`
  - `<Interruptor ligado aoMudar rotuloAcessivel />`
  - `<Sobrancelha texto acao? />`

- [ ] **Step 1: Instalar o expo-blur**

```bash
cd mobile
npx expo install expo-blur
```

- [ ] **Step 2: Escrever o teste que falha**

`mobile/src/compartilhado/ui/ui.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { coresClaro } from "@/compartilhado/tema/tokens/cores";
import { Avatar, Botao, Chip, Interruptor, Pill, CampoDeBusca } from "./index";

function renderizar(elemento: React.ReactElement) {
  return render(<ProvedorDeTema>{elemento}</ProvedorDeTema>);
}

describe("Botao", () => {
  it("dispara aoTocar", () => {
    const aoTocar = jest.fn();
    renderizar(<Botao variante="primario" rotulo="Nova Nota" aoTocar={aoTocar} />);
    fireEvent.press(screen.getByRole("button", { name: "Nova Nota" }));
    expect(aoTocar).toHaveBeenCalledTimes(1);
  });

  it("respeita o alvo de toque mínimo de 44", () => {
    renderizar(<Botao variante="primario" rotulo="Abrir Nota" aoTocar={jest.fn()} testID="botao" />);
    expect(screen.getByTestId("botao")).toHaveStyle({ minHeight: 44 });
  });

  it("não dispara quando desabilitado", () => {
    const aoTocar = jest.fn();
    renderizar(<Botao variante="outline" rotulo="Perguntar" aoTocar={aoTocar} desabilitado />);
    fireEvent.press(screen.getByRole("button", { name: "Perguntar" }));
    expect(aoTocar).not.toHaveBeenCalled();
  });
});

describe("Avatar", () => {
  it("mostra as iniciais", () => {
    renderizar(<Avatar iniciais="MA" tamanho={32} />);
    expect(screen.getByText("MA")).toBeOnTheScreen();
  });
});

describe("Chip", () => {
  it("usa a família mono", () => {
    renderizar(<Chip rotulo="#método" testID="chip" />);
    expect(screen.getByTestId("chip")).toHaveStyle({ fontFamily: "JetBrainsMono_400Regular" });
  });
});

describe("Pill", () => {
  it("pinta o fundo de primária quando ativo", () => {
    renderizar(<Pill rotulo="90" ativo aoTocar={jest.fn()} testID="pill" />);
    expect(screen.getByTestId("pill")).toHaveStyle({ backgroundColor: coresClaro.primaria });
  });
});

describe("CampoDeBusca", () => {
  it("chama aoMudar com o texto digitado", () => {
    const aoMudar = jest.fn();
    renderizar(<CampoDeBusca valor="" aoMudar={aoMudar} placeholder="Buscar no vault..." />);
    fireEvent.changeText(screen.getByPlaceholderText("Buscar no vault..."), "atômica");
    expect(aoMudar).toHaveBeenCalledWith("atômica");
  });
});

describe("Interruptor", () => {
  it("inverte o valor ao ser tocado", () => {
    const aoMudar = jest.fn();
    renderizar(<Interruptor ligado={false} aoMudar={aoMudar} rotuloAcessivel="Campo do grafo" />);
    fireEvent.press(screen.getByRole("switch", { name: "Campo do grafo" }));
    expect(aoMudar).toHaveBeenCalledWith(true);
  });

  it("expõe o estado para leitores de tela", () => {
    renderizar(<Interruptor ligado aoMudar={jest.fn()} rotuloAcessivel="Partículas de raciocínio" />);
    expect(screen.getByRole("switch", { name: "Partículas de raciocínio" })).toHaveAccessibilityState({ checked: true });
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- ui`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 4: Escrever `Vidro.tsx`**

Um único lugar decide o que "vidro" significa em cada plataforma. É aqui que a mitigação de custo do blur no Android mora.

```tsx
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTema } from "@/compartilhado/tema";
import type { ReactNode } from "react";

type Nivel = "barra" | "bolha" | "dock" | "folha" | "cartao";

const INTENSIDADE: Record<Nivel, number> = { cartao: 4, bolha: 12, barra: 12, dock: 16, folha: 16 };

export function Vidro({ nivel, style, children }: { nivel: Nivel; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const { cores } = useTema();
  const fundo = {
    barra: cores.vidroBarra,
    bolha: cores.vidroBolha,
    dock: cores.vidroDock,
    folha: cores.vidroFolha,
    cartao: cores.vidroCartao,
  }[nivel];

  if (Platform.OS === "android") {
    return <View style={[{ backgroundColor: fundo }, style]}>{children}</View>;
  }

  return (
    <BlurView intensity={INTENSIDADE[nivel]} tint={cores.tintaDoBlur} style={[{ backgroundColor: fundo }, style]}>
      {children}
    </BlurView>
  );
}
```

No Android o blur em tempo real sobre o grafo animado custa caro; a cor com opacidade dá o mesmo resultado visual a um décimo do custo. Se em teste ficar bom no Android, basta remover o `if`.

- [ ] **Step 5: Escrever `Botao.tsx`**

```tsx
import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone, type NomeDeIcone } from "./Icone";

type Variante = "primario" | "outline" | "ghost";

type Props = {
  variante: Variante;
  rotulo: string;
  aoTocar: () => void;
  icone?: NomeDeIcone;
  desabilitado?: boolean;
  larguraTotal?: boolean;
  testID?: string;
};

export function Botao({ variante, rotulo, aoTocar, icone, desabilitado = false, larguraTotal = false, testID }: Props) {
  const { cores, tipografia, espacamento, raios, sombras } = useTema();

  const fundo = variante === "primario" ? cores.primaria : "transparent";
  const texto = variante === "primario" ? cores.sobrePrimaria : cores.primaria;
  const borda = variante === "outline" ? cores.fioDeCabelo : "transparent";

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={aoTocar}
      style={({ pressed }) => [
        {
          minHeight: espacamento.alvoDeToque,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: espacamento.sm,
          paddingHorizontal: espacamento.gutter,
          borderRadius: raios.bolha,
          backgroundColor: fundo,
          borderWidth: 1,
          borderColor: borda,
          opacity: desabilitado ? 0.5 : pressed ? 0.85 : 1,
          flex: larguraTotal ? 1 : undefined,
        },
        variante === "primario" ? sombras.pequena : null,
      ]}
    >
      {icone ? <Icone nome={icone} tamanho={18} cor={texto} /> : null}
      <Text style={[tipografia.titleSm, { color: texto }]}>{rotulo}</Text>
    </Pressable>
  );
}
```

O press muda só opacidade — o handoff proíbe escala e encolhimento no press.

- [ ] **Step 6: Escrever os componentes restantes**

`Chip.tsx` — chip mono de 11 px, usado em tags:

```tsx
import { Text } from "react-native";
import { useTema } from "@/compartilhado/tema";

export function Chip({ rotulo, destacado = false, testID }: { rotulo: string; destacado?: boolean; testID?: string }) {
  const { cores, tipografia, raios } = useTema();
  return (
    <Text
      testID={testID}
      style={[
        tipografia.chip,
        {
          color: destacado ? cores.primaria : cores.textoSuave,
          backgroundColor: destacado ? cores.primariaFixa : cores.superficieChip,
          borderRadius: raios.chip,
          paddingHorizontal: 6,
          paddingVertical: 2,
          overflow: "hidden",
        },
      ]}
    >
      {rotulo}
    </Text>
  );
}
```

`Cartao.tsx` — vidro com blur 4, borda que vira primária quando selecionado:

```tsx
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "./Vidro";

export function Cartao({
  children, aoTocar, selecionado = false, style, testID,
}: { children: ReactNode; aoTocar?: () => void; selecionado?: boolean; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { cores, espacamento, raios } = useTema();

  const conteudo = (
    <Vidro
      nivel="cartao"
      style={[
        { padding: espacamento.md, borderRadius: raios.cartao, borderWidth: 1, borderColor: selecionado ? cores.primaria : cores.fioDeCabelo, overflow: "hidden" },
        style,
      ]}
    >
      {children}
    </Vidro>
  );

  if (!aoTocar) return conteudo;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={aoTocar}>
      {conteudo}
    </Pressable>
  );
}
```

`Avatar.tsx` — iniciais sobre `secundariaContainer`:

```tsx
import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";

export function Avatar({ iniciais, tamanho, aoTocar }: { iniciais: string; tamanho: number; aoTocar?: () => void }) {
  const { cores, tipografia, raios } = useTema();

  const circulo = (
    <View
      style={{
        width: tamanho, height: tamanho, borderRadius: raios.pill,
        backgroundColor: cores.secundariaContainer,
        borderWidth: 1, borderColor: cores.fioDeCabelo,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={[tipografia.rotuloSm, { color: cores.sobreSecundariaContainer }]}>{iniciais}</Text>
    </View>
  );

  if (!aoTocar) return circulo;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu de conta" onPress={aoTocar} hitSlop={8}>
      {circulo}
    </Pressable>
  );
}
```

`Pill.tsx` — usado no `TabSwitcher` e na densidade de nós:

```tsx
import { Pressable, Text } from "react-native";
import { useTema } from "@/compartilhado/tema";

export function Pill({ rotulo, ativo, aoTocar, testID }: { rotulo: string; ativo: boolean; aoTocar: () => void; testID?: string }) {
  const { cores, tipografia, raios } = useTema();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: ativo }}
      onPress={aoTocar}
      style={{
        minHeight: 32, paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: raios.pill,
        backgroundColor: ativo ? cores.primaria : "transparent",
        borderWidth: ativo ? 0 : 1,
        borderColor: cores.fioDeCabelo,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={[ativo ? tipografia.titleSm : tipografia.corpoMedio, { fontSize: 13, lineHeight: 18, color: ativo ? cores.sobrePrimaria : cores.textoSuave }]}>
        {rotulo}
      </Text>
    </Pressable>
  );
}
```

`CampoDeBusca.tsx` — pill com ícone `search` à esquerda:

```tsx
import { useState } from "react";
import { TextInput, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone } from "./Icone";

export function CampoDeBusca({ valor, aoMudar, placeholder }: { valor: string; aoMudar: (texto: string) => void; placeholder: string }) {
  const { cores, tipografia, raios } = useTema();
  const [focado, setFocado] = useState(false);

  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingLeft: 8, paddingRight: 8, minHeight: 36,
        borderRadius: raios.pill,
        backgroundColor: cores.superficieContainerBaixa,
        borderWidth: 1,
        borderColor: focado ? cores.primaria : cores.fioDeCabelo,
      }}
    >
      <Icone nome="search" tamanho={18} cor={cores.contorno} />
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        placeholder={placeholder}
        placeholderTextColor={cores.textoPlaceholder}
        style={[tipografia.corpo, { flex: 1, color: cores.sobreSuperficie, paddingVertical: 6 }]}
      />
    </View>
  );
}
```

`Interruptor.tsx` — 44 × 26, knob de 20, posição por `justifyContent`:

```tsx
import { Pressable, View } from "react-native";
import { useTema } from "@/compartilhado/tema";

export function Interruptor({ ligado, aoMudar, rotuloAcessivel }: { ligado: boolean; aoMudar: (ligado: boolean) => void; rotuloAcessivel: string }) {
  const { cores, raios, sombras } = useTema();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={rotuloAcessivel}
      accessibilityState={{ checked: ligado }}
      onPress={() => aoMudar(!ligado)}
      hitSlop={8}
      style={{
        width: 44, height: 26, padding: 2,
        borderRadius: raios.pill,
        borderWidth: 1, borderColor: cores.fioDeCabelo,
        backgroundColor: ligado ? cores.primaria : cores.superficieContainerAlta,
        justifyContent: "center",
        alignItems: ligado ? "flex-end" : "flex-start",
      }}
    >
      <View style={[{ width: 20, height: 20, borderRadius: raios.pill, backgroundColor: ligado ? cores.sobrePrimaria : cores.contorno }, sombras.pequena]} />
    </Pressable>
  );
}
```

`Sobrancelha.tsx` — o eyebrow uppercase com tracking largo, com uma ação opcional à direita:

```tsx
import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone, type NomeDeIcone } from "./Icone";

type Acao = { rotulo: string; icone: NomeDeIcone; aoTocar: () => void };

export function Sobrancelha({ texto, acao }: { texto: string; acao?: Acao }) {
  const { cores, tipografia, espacamento } = useTema();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: espacamento.md, paddingVertical: espacamento.sm }}>
      <Text style={[tipografia.sobrancelha, { color: cores.contorno, textTransform: "uppercase" }]}>{texto}</Text>
      {acao ? (
        <Pressable accessibilityRole="button" accessibilityLabel={acao.rotulo} onPress={acao.aoTocar} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icone nome={acao.icone} tamanho={14} cor={cores.primaria} />
          <Text style={[tipografia.legenda, { color: cores.primaria }]}>{acao.rotulo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
```

`index.ts` reexporta todos, incluindo `Icone` e `NomeDeIcone` da Task 3.

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test -- ui`
Expected: PASS, 9 testes

- [ ] **Step 8: Rodar a suíte inteira e o lint**

Run: `cd mobile && npm test && npm run lint`
Expected: PASS, 26 testes; lint sem erro

- [ ] **Step 9: Commit**

```bash
git add mobile/src/compartilhado/ui
git commit -m "feat(mobile): componentes de UI base com tokens do tema"
```

---

## Task 6: `Sheet` — o bottom sheet compartilhado

**Files:**
- Create: `mobile/src/compartilhado/ui/Sheet.tsx`
- Modify: `mobile/src/compartilhado/ui/index.ts`
- Test: `mobile/src/compartilhado/ui/Sheet.test.tsx`

**Interfaces:**
- Consumes: `useTema()`, `Vidro`
- Produces: `<Sheet aberta aoFechar sobrancelha? >{children}</Sheet>`

O menu de conta e o menu de ações da IA são o mesmo painel no handoff — mesmo backdrop, mesma margem, mesmo slide-up de 300 ms. Um componente serve os dois.

- [ ] **Step 1: Escrever o teste que falha**

`mobile/src/compartilhado/ui/Sheet.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { Sheet } from "./Sheet";

function renderizar(elemento: React.ReactElement) {
  return render(<ProvedorDeTema>{elemento}</ProvedorDeTema>);
}

describe("Sheet", () => {
  it("não renderiza o conteúdo quando fechada", () => {
    renderizar(
      <Sheet aberta={false} aoFechar={jest.fn()}>
        <Text>Perfil</Text>
      </Sheet>,
    );
    expect(screen.queryByText("Perfil")).toBeNull();
  });

  it("renderiza o conteúdo quando aberta", () => {
    renderizar(
      <Sheet aberta aoFechar={jest.fn()}>
        <Text>Perfil</Text>
      </Sheet>,
    );
    expect(screen.getByText("Perfil")).toBeOnTheScreen();
  });

  it("fecha ao tocar no backdrop", () => {
    const aoFechar = jest.fn();
    renderizar(
      <Sheet aberta aoFechar={aoFechar}>
        <Text>Perfil</Text>
      </Sheet>,
    );
    fireEvent.press(screen.getByTestId("backdrop-da-sheet"));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("mostra a sobrancelha quando recebida", () => {
    renderizar(
      <Sheet aberta aoFechar={jest.fn()} sobrancelha="BIMO NESTA NOTA">
        <Text>Sugerir links</Text>
      </Sheet>,
    );
    expect(screen.getByText("BIMO NESTA NOTA")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- Sheet`
Expected: FAIL — `Cannot find module './Sheet'`

- [ ] **Step 3: Escrever `Sheet.tsx`**

```tsx
import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "./Vidro";
import { Sobrancelha } from "./Sobrancelha";

type Props = { aberta: boolean; aoFechar: () => void; sobrancelha?: string; children: ReactNode };

export function Sheet({ aberta, aoFechar, sobrancelha, children }: Props) {
  const { cores, espacamento, raios, sombras } = useTema();

  if (!aberta) return null;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={aoFechar}>
      <Pressable
        testID="backdrop-da-sheet"
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={aoFechar}
        style={{ flex: 1, backgroundColor: cores.backdrop, justifyContent: "flex-end" }}
      >
        <Pressable onPress={() => {}}>
          <Vidro
            nivel="folha"
            style={[
              {
                marginHorizontal: espacamento.md,
                marginBottom: 46,
                padding: espacamento.sm,
                borderRadius: raios.folha,
                borderWidth: 1,
                borderColor: cores.fioDeCabelo,
                overflow: "hidden",
              },
              sombras.grande,
            ]}
          >
            {sobrancelha ? <Sobrancelha texto={sobrancelha} /> : null}
            {children}
          </Vidro>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

O `Pressable` interno com `onPress` vazio existe para o toque no painel não borbulhar até o backdrop e fechar a sheet.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test -- Sheet`
Expected: PASS, 4 testes

- [ ] **Step 5: Commit**

```bash
git add mobile/src/compartilhado/ui/Sheet.tsx mobile/src/compartilhado/ui/Sheet.test.tsx mobile/src/compartilhado/ui/index.ts
git commit -m "feat(mobile): bottom sheet compartilhado pelo menu de conta e o menu de IA"
```

---

## Task 7: Rota de intro com os dois MP4

**Files:**
- Create: `mobile/app/intro.tsx`, `mobile/src/funcionalidades/intro/Intro.tsx`
- Modify: `mobile/app/index.tsx` (vira redirect), `mobile/app.json`
- Copy: `mobile/assets/videos/intro-claro.mp4`, `intro-escuro.mp4`
- Test: `mobile/src/funcionalidades/intro/Intro.test.tsx`

**Interfaces:**
- Consumes: `useTema()`
- Produces: rota `/intro`; ao terminar ou ao toque, `router.replace("/bimo")`

- [ ] **Step 1: Copiar os vídeos e instalar o expo-video**

```bash
cd mobile
mkdir -p assets/videos
cp "desing-app-mobile/Aplicativo de notas com IA e grafos/design_handoff_bimo_mobile/Intro fundo claro.mp4" assets/videos/intro-claro.mp4
cp "desing-app-mobile/Aplicativo de notas com IA e grafos/design_handoff_bimo_mobile/Intro fundo escuro.mp4" assets/videos/intro-escuro.mp4
npx expo install expo-video
```

- [ ] **Step 2: Escrever o teste que falha**

`mobile/src/funcionalidades/intro/Intro.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { Intro } from "./Intro";

const replace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace }) }));

jest.mock("expo-video", () => ({
  useVideoPlayer: (_fonte: unknown, configurar: (player: unknown) => void) => {
    const player = { loop: false, muted: true, play: jest.fn() };
    configurar(player);
    return player;
  },
  VideoView: require("react-native").View,
}));

function renderizar() {
  return render(
    <ProvedorDeTema>
      <Intro />
    </ProvedorDeTema>,
  );
}

describe("Intro", () => {
  beforeEach(() => replace.mockClear());

  it("oferece pular a intro", () => {
    renderizar();
    expect(screen.getByRole("button", { name: "Pular" })).toBeOnTheScreen();
  });

  it("vai para o chat ao pular", () => {
    renderizar();
    fireEvent.press(screen.getByRole("button", { name: "Pular" }));
    expect(replace).toHaveBeenCalledWith("/bimo");
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- Intro`
Expected: FAIL — `Cannot find module './Intro'`

- [ ] **Step 4: Escrever `Intro.tsx`**

```tsx
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTema } from "@/compartilhado/tema";

const VIDEO_CLARO = require("../../../assets/videos/intro-claro.mp4");
const VIDEO_ESCURO = require("../../../assets/videos/intro-escuro.mp4");
const DURACAO_MAXIMA_MS = 6000;

export function Intro() {
  const { cores, tipografia, espacamento, escuro } = useTema();
  const router = useRouter();

  const player = useVideoPlayer(escuro ? VIDEO_ESCURO : VIDEO_CLARO, (instancia) => {
    instancia.loop = false;
    instancia.muted = true;
    instancia.play();
  });

  useEffect(() => {
    const id = setTimeout(() => router.replace("/bimo"), DURACAO_MAXIMA_MS);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: cores.fundo }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pular"
        onPress={() => router.replace("/bimo")}
        style={{ position: "absolute", right: espacamento.gutter, bottom: 46, minHeight: espacamento.alvoDeToque, justifyContent: "center", paddingHorizontal: espacamento.md }}
      >
        <Text style={[tipografia.rotuloSm, { color: cores.textoTenue }]}>Pular</Text>
      </Pressable>
    </View>
  );
}
```

O timeout de 6 s é a rede de segurança: se o vídeo falhar em carregar, o app não fica preso na intro. Ajustar para a duração real dos MP4 + 500 ms depois de medi-la.

- [ ] **Step 5: Criar a rota e o redirect inicial**

`mobile/app/intro.tsx`:

```tsx
import { Intro } from "@/funcionalidades/intro/Intro";

export default function RotaIntro() {
  return <Intro />;
}
```

`mobile/app/index.tsx`:

```tsx
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/intro" />;
}
```

Apagar `mobile/app/index.test.tsx` — a asserção de "renderiza a marca" não faz mais sentido num redirect, e a cobertura dessa rota passa a ser o teste da Intro.

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test -- Intro`
Expected: PASS, 2 testes

- [ ] **Step 7: Conferir a intro no Expo Go, nos dois temas**

Run: `cd mobile && npx expo start`
Expected: o vídeo toca de ponta a ponta e o app vai para uma tela em branco (a rota `/bimo` ainda não existe — o erro "Unmatched Route" nesta etapa é esperado). Trocar o tema do sistema para escuro e confirmar que o outro MP4 é usado.

- [ ] **Step 8: Commit**

```bash
git add mobile/app mobile/src/funcionalidades/intro mobile/assets/videos
git commit -m "feat(mobile): rota de intro com o video do tema ativo"
```

---

## Task 8: Layout `(app)` com header persistente

**Files:**
- Create: `mobile/app/(app)/_layout.tsx`, `mobile/app/(app)/bimo.tsx`, `mobile/app/(app)/nota.tsx`, `mobile/src/compartilhado/ui/Cabecalho.tsx`, `mobile/src/compartilhado/ui/TabSwitcher.tsx`
- Test: `mobile/src/compartilhado/ui/Cabecalho.test.tsx`

**Interfaces:**
- Consumes: `useTema()`, `Vidro`, `Pill`, `Avatar`, `Icone`
- Produces: `<Cabecalho destinoAtivo="bimo" | "nota" aoTrocarDestino aoAbrirConta />`; rotas `/bimo` e `/nota`

- [ ] **Step 1: Escrever o teste que falha**

`mobile/src/compartilhado/ui/Cabecalho.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { coresClaro } from "@/compartilhado/tema/tokens/cores";
import { Cabecalho } from "./Cabecalho";

function renderizar(destinoAtivo: "bimo" | "nota", aoTrocarDestino = jest.fn(), aoAbrirConta = jest.fn()) {
  render(
    <ProvedorDeTema>
      <Cabecalho destinoAtivo={destinoAtivo} aoTrocarDestino={aoTrocarDestino} aoAbrirConta={aoAbrirConta} iniciais="MA" />
    </ProvedorDeTema>,
  );
  return { aoTrocarDestino, aoAbrirConta };
}

describe("Cabecalho", () => {
  it("mostra os dois destinos", () => {
    renderizar("bimo");
    expect(screen.getByRole("button", { name: "Bimo" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Nota" })).toBeOnTheScreen();
  });

  it("marca o destino ativo", () => {
    renderizar("nota");
    expect(screen.getByRole("button", { name: "Nota" })).toHaveAccessibilityState({ selected: true });
    expect(screen.getByRole("button", { name: "Bimo" })).toHaveAccessibilityState({ selected: false });
  });

  it("avisa a troca de destino", () => {
    const { aoTrocarDestino } = renderizar("bimo");
    fireEvent.press(screen.getByRole("button", { name: "Nota" }));
    expect(aoTrocarDestino).toHaveBeenCalledWith("nota");
  });

  it("não avisa quando o destino tocado já é o ativo", () => {
    const { aoTrocarDestino } = renderizar("bimo");
    fireEvent.press(screen.getByRole("button", { name: "Bimo" }));
    expect(aoTrocarDestino).not.toHaveBeenCalled();
  });

  it("abre o menu de conta pelo avatar", () => {
    const { aoAbrirConta } = renderizar("bimo");
    fireEvent.press(screen.getByRole("button", { name: "Abrir menu de conta" }));
    expect(aoAbrirConta).toHaveBeenCalledTimes(1);
  });

  it("tem 56 de altura", () => {
    renderizar("bimo");
    expect(screen.getByTestId("cabecalho")).toHaveStyle({ height: 56 });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- Cabecalho`
Expected: FAIL — `Cannot find module './Cabecalho'`

- [ ] **Step 3: Escrever `TabSwitcher.tsx`**

```tsx
import { View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Pill } from "./Pill";

export type Destino = "bimo" | "nota";

const ROTULOS: Record<Destino, string> = { bimo: "Bimo", nota: "Nota" };

export function TabSwitcher({ ativo, aoTrocar }: { ativo: Destino; aoTrocar: (destino: Destino) => void }) {
  const { cores, espacamento, raios } = useTema();

  return (
    <View
      style={{
        flexDirection: "row",
        gap: espacamento.xs,
        padding: 4,
        borderRadius: raios.pill,
        backgroundColor: cores.superficieContainerBaixa,
        borderWidth: 1,
        borderColor: cores.fioDeCabelo,
      }}
    >
      {(Object.keys(ROTULOS) as Destino[]).map((destino) => (
        <Pill
          key={destino}
          rotulo={ROTULOS[destino]}
          ativo={destino === ativo}
          aoTocar={() => {
            if (destino !== ativo) aoTrocar(destino);
          }}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Escrever `Cabecalho.tsx`**

```tsx
import { View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "./Vidro";
import { Icone } from "./Icone";
import { Avatar } from "./Avatar";
import { TabSwitcher, type Destino } from "./TabSwitcher";

type Props = {
  destinoAtivo: Destino;
  aoTrocarDestino: (destino: Destino) => void;
  aoAbrirConta: () => void;
  iniciais: string;
};

export function Cabecalho({ destinoAtivo, aoTrocarDestino, aoAbrirConta, iniciais }: Props) {
  const { cores, espacamento } = useTema();

  return (
    <Vidro
      nivel="barra"
      style={{
        height: espacamento.alturaCabecalho,
        flexDirection: "row",
        alignItems: "center",
        gap: espacamento.sm,
        paddingHorizontal: espacamento.md,
        borderBottomWidth: 1,
        borderBottomColor: cores.fioDeCabelo,
      }}
    >
      <View testID="cabecalho" style={{ height: espacamento.alturaCabecalho, flexDirection: "row", alignItems: "center", gap: espacamento.sm, flex: 1 }}>
        <Icone nome="psychology" tamanho={22} cor={cores.primaria} preenchido />
        <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
          <TabSwitcher ativo={destinoAtivo} aoTrocar={aoTrocarDestino} />
        </View>
        <Avatar iniciais={iniciais} tamanho={32} aoTocar={aoAbrirConta} />
      </View>
    </Vidro>
  );
}
```

- [ ] **Step 5: Escrever o layout `(app)` e as duas rotas**

`mobile/app/(app)/_layout.tsx`:

```tsx
import { useState } from "react";
import { View } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTema } from "@/compartilhado/tema";
import { Cabecalho } from "@/compartilhado/ui/Cabecalho";
import type { Destino } from "@/compartilhado/ui/TabSwitcher";
import { perfil } from "@/dados/fixtures/perfil";

function iniciaisDe(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export default function LayoutDoApp() {
  const { cores } = useTema();
  const router = useRouter();
  const caminho = usePathname();
  const [contaAberta, setContaAberta] = useState(false);

  const destinoAtivo: Destino = caminho.startsWith("/nota") ? "nota" : "bimo";

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Cabecalho
        destinoAtivo={destinoAtivo}
        aoTrocarDestino={(destino) => router.replace(destino === "bimo" ? "/bimo" : "/nota")}
        aoAbrirConta={() => setContaAberta(true)}
        iniciais={iniciaisDe(perfil.nome)}
      />
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </SafeAreaView>
  );
}
```

O estado `contaAberta` fica declarado aqui e só será ligado ao `MenuDeConta` na Task 15 — é onde ele pertence, já que o avatar que o abre vive neste layout.

`mobile/app/(app)/bimo.tsx` e `nota.tsx`, provisórios até as tasks 11 e 13:

```tsx
import { Text, View } from "react-native";

export default function RotaBimo() {
  return (
    <View style={{ flex: 1 }}>
      <Text>Bimo</Text>
    </View>
  );
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test -- Cabecalho`
Expected: PASS, 6 testes

- [ ] **Step 7: Conferir a troca de destino no Expo Go**

Run: `cd mobile && npx expo start`
Expected: depois da intro, o header aparece com marca, pill de dois destinos e avatar "MA". Tocar em "Nota" troca o destino sem o header piscar (ele vive no layout, então não re-monta).

- [ ] **Step 8: Commit**

```bash
git add mobile/app mobile/src/compartilhado/ui
git commit -m "feat(mobile): header persistente com TabSwitcher e rotas dos dois destinos"
```

---

## Task 9: `fisica.ts` — o motor do campo de grafo

**Files:**
- Create: `mobile/src/compartilhado/grafo/contrato.ts`, `mobile/src/compartilhado/grafo/fisica.ts`
- Test: `mobile/src/compartilhado/grafo/fisica.test.ts`

**Interfaces:**
- Consumes: `NoDoGrafo`, `Aresta` de `@/dados/tipos`
- Produces:
  - `type NoAmbiente = { x: number; y: number; vx: number; vy: number; raio: number; tom: "base" | "suave" | "tenue" | "sinal"; fase: number; escala: number; framesDeVida: number | null }`
  - `type Particula = { deX: number; deY: number; paraX: number; paraY: number; progresso: number; velocidade: number }`
  - `criarCampo(opcoes: OpcoesDeCampo): NoAmbiente[]`
  - `avancarCampo(nos: NoAmbiente[], opcoes: OpcoesDeCampo): NoAmbiente[]`
  - `calcularLigacoes(nos: NoAmbiente[], raioDoCampo: number): [number, number][]`
  - `criarParticulas(nos: NoAmbiente[], quantidade: number, aleatorio: () => number): Particula[]`
  - `avancarParticulas(particulas: Particula[]): Particula[]`
  - `opacidadeDaParticula(progresso: number): number`
  - `nascerNo(nos: NoAmbiente[], opcoes: OpcoesDeCampo): NoAmbiente[]`
  - `deveRotular(peso: number, selecionado: boolean): boolean`
  - `raioDoCampo(largura: number, altura: number): number`

Este arquivo não importa nada de React nem de React Native. É a parte do grafo que dá para testar de verdade, e é por isso que ele existe separado do render.

- [ ] **Step 1: Escrever o teste que falha**

`mobile/src/compartilhado/grafo/fisica.test.ts`:

```ts
import {
  avancarCampo, avancarParticulas, calcularLigacoes, criarCampo, criarParticulas,
  deveRotular, nascerNo, opacidadeDaParticula, raioDoCampo,
} from "./fisica";

const OPCOES = { largura: 402, altura: 700, quantidade: 60, aleatorio: () => 0.5 };

describe("raioDoCampo", () => {
  it("usa 62% da menor dimensão", () => {
    expect(raioDoCampo(402, 700)).toBeCloseTo(402 * 0.62);
  });
});

describe("criarCampo", () => {
  it("cria a quantidade pedida", () => {
    expect(criarCampo(OPCOES)).toHaveLength(60);
  });

  it("usa os três tamanhos do handoff, com a maioria em 1,1", () => {
    const nos = criarCampo({ ...OPCOES, quantidade: 2000, aleatorio: Math.random });
    expect(new Set(nos.map((no) => no.raio))).toEqual(new Set([1.1, 2, 3.2]));

    const conta = (raio: number) => nos.filter((no) => no.raio === raio).length / nos.length;
    expect(conta(3.2)).toBeGreaterThan(0.005);
    expect(conta(3.2)).toBeLessThan(0.045);
    expect(conta(2)).toBeGreaterThan(0.05);
    expect(conta(2)).toBeLessThan(0.12);
    expect(conta(1.1)).toBeGreaterThan(0.85);
  });

  it("marca cerca de 6% dos nós como sinal", () => {
    const nos = criarCampo({ ...OPCOES, quantidade: 1000, aleatorio: Math.random });
    const sinais = nos.filter((no) => no.tom === "sinal").length;
    expect(sinais).toBeGreaterThan(30);
    expect(sinais).toBeLessThan(90);
  });

  it("nasce todo mundo dentro do raio do campo", () => {
    const raio = raioDoCampo(OPCOES.largura, OPCOES.altura);
    const centroX = OPCOES.largura / 2;
    const centroY = OPCOES.altura / 2;
    for (const no of criarCampo({ ...OPCOES, quantidade: 200, aleatorio: Math.random })) {
      expect(Math.hypot(no.x - centroX, no.y - centroY)).toBeLessThanOrEqual(raio);
    }
  });
});

describe("avancarCampo", () => {
  it("move cada nó pela sua velocidade", () => {
    const [antes] = criarCampo({ ...OPCOES, quantidade: 1 });
    const [depois] = avancarCampo([antes], OPCOES);
    expect(depois.x).toBeCloseTo(antes.x + antes.vx);
    expect(depois.y).toBeCloseTo(antes.y + antes.vy);
  });

  it("inverte a velocidade quando o nó passa de 1,1x o raio", () => {
    const raio = raioDoCampo(OPCOES.largura, OPCOES.altura);
    const fugitivo = {
      x: OPCOES.largura / 2 + raio * 1.2, y: OPCOES.altura / 2,
      vx: 0.12, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null,
    };
    const [depois] = avancarCampo([fugitivo], OPCOES);
    expect(depois.vx).toBeCloseTo(-0.12);
  });

  it("não inverte quem está dentro do limite", () => {
    const dentro = {
      x: OPCOES.largura / 2, y: OPCOES.altura / 2,
      vx: 0.12, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null,
    };
    const [depois] = avancarCampo([dentro], OPCOES);
    expect(depois.vx).toBeCloseTo(0.12);
  });

  it("faz a fase avançar para o pulso de ±6%", () => {
    const [antes] = criarCampo({ ...OPCOES, quantidade: 1 });
    const [depois] = avancarCampo([antes], OPCOES);
    expect(depois.fase).toBeGreaterThan(antes.fase);
  });
});

describe("calcularLigacoes", () => {
  it("liga só pares a menos de 22% do raio", () => {
    const raio = 100;
    const perto = { x: 0, y: 0, vx: 0, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null };
    const vizinho = { ...perto, x: 10 };
    const longe = { ...perto, x: 90 };
    const ligacoes = calcularLigacoes([perto, vizinho, longe], raio);
    expect(ligacoes).toContainEqual([0, 1]);
    expect(ligacoes).not.toContainEqual([0, 2]);
  });

  it("respeita o teto de 6 ligações por nó", () => {
    const base = { y: 0, vx: 0, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null };
    const nos = Array.from({ length: 12 }, (_, i) => ({ ...base, x: i }));
    const ligacoes = calcularLigacoes(nos, 100);
    for (let indice = 0; indice < nos.length; indice += 1) {
      const grau = ligacoes.filter(([a, b]) => a === indice || b === indice).length;
      expect(grau).toBeLessThanOrEqual(6);
    }
  });

  it("não liga um nó a ele mesmo nem repete o par", () => {
    const base = { y: 0, vx: 0, vy: 0, raio: 1.1, tom: "base" as const, fase: 0, escala: 1, framesDeVida: null };
    const ligacoes = calcularLigacoes([{ ...base, x: 0 }, { ...base, x: 1 }], 100);
    expect(ligacoes).toEqual([[0, 1]]);
  });
});

describe("partículas", () => {
  it("cria a quantidade pedida entre nós existentes", () => {
    const nos = criarCampo({ ...OPCOES, quantidade: 20, aleatorio: Math.random });
    expect(criarParticulas(nos, 8, Math.random)).toHaveLength(8);
  });

  it("avança o progresso pela velocidade e descarta as que chegaram", () => {
    const particula = { deX: 0, deY: 0, paraX: 10, paraY: 0, progresso: 0.99, velocidade: 0.02 };
    expect(avancarParticulas([particula])).toHaveLength(0);
  });

  it("mantém as que ainda estão no caminho", () => {
    const particula = { deX: 0, deY: 0, paraX: 10, paraY: 0, progresso: 0.2, velocidade: 0.02 };
    const [depois] = avancarParticulas([particula]);
    expect(depois.progresso).toBeCloseTo(0.22);
  });

  it("chega ao pico de opacidade no meio do caminho", () => {
    expect(opacidadeDaParticula(0.5)).toBeCloseTo(1);
    expect(opacidadeDaParticula(0)).toBeCloseTo(0);
    expect(opacidadeDaParticula(1)).toBeCloseTo(0);
  });
});

describe("nascerNo", () => {
  it("acrescenta um nó sinal a 30% do raio, começando em 0,4 de escala", () => {
    const raio = raioDoCampo(OPCOES.largura, OPCOES.altura);
    const nos = nascerNo([], { ...OPCOES, aleatorio: () => 0 });
    expect(nos).toHaveLength(1);
    expect(nos[0].tom).toBe("sinal");
    expect(nos[0].escala).toBeCloseTo(0.4);
    expect(Math.hypot(nos[0].x - OPCOES.largura / 2, nos[0].y - OPCOES.altura / 2)).toBeCloseTo(raio * 0.3);
  });

  it("cresce até 1 em cerca de 50 frames", () => {
    let nos = nascerNo([], { ...OPCOES, aleatorio: () => 0 });
    for (let frame = 0; frame < 50; frame += 1) nos = avancarCampo(nos, OPCOES);
    expect(nos[0].escala).toBeCloseTo(1, 1);
  });
});

describe("deveRotular", () => {
  it("rotula nós de peso 1,2 ou mais", () => {
    expect(deveRotular(1.2, false)).toBe(true);
    expect(deveRotular(1.19, false)).toBe(false);
  });

  it("sempre rotula o nó selecionado", () => {
    expect(deveRotular(0.4, true)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- fisica`
Expected: FAIL — `Cannot find module './fisica'`

- [ ] **Step 3: Escrever `contrato.ts`**

Esta é a fronteira que permite trocar SVG por Skia depois sem tocar em nenhuma tela.

```ts
import type { Aresta, NoDoGrafo } from "@/dados/tipos";

export type ModoDoGrafo = "ambiente" | "interativo";

export type PropsDoCampoDeGrafo = {
  modo: ModoDoGrafo;
  densidade: number;
  ligado: boolean;
  particulasLigadas: boolean;
  pulso: number;
  crescer: number;
  nos?: NoDoGrafo[];
  arestas?: Aresta[];
  noSelecionado?: string | null;
  aoSelecionarNo?: (id: string | null) => void;
};
```

`nos`, `arestas`, `noSelecionado` e `aoSelecionarNo` só são usados no modo interativo. `pulso` e `crescer` são contadores: quando incrementam, o campo dispara uma rajada de partículas ou faz nascer um nó.

- [ ] **Step 4: Escrever `fisica.ts`**

```ts
export type Tom = "base" | "suave" | "tenue" | "sinal";

export type NoAmbiente = {
  x: number; y: number; vx: number; vy: number;
  raio: number; tom: Tom; fase: number;
  escala: number;
  framesDeVida: number | null;
};

export type Particula = { deX: number; deY: number; paraX: number; paraY: number; progresso: number; velocidade: number };

export type OpcoesDeCampo = { largura: number; altura: number; quantidade: number; aleatorio: () => number };

const FRACAO_DO_RAIO = 0.62;
const LIMITE_DE_FUGA = 1.1;
const VELOCIDADE_MAXIMA = 0.12;
const FRACAO_DE_LIGACAO = 0.22;
const MAXIMO_DE_LIGACOES = 6;
const FRAMES_ATE_CRESCER = 50;
const ESCALA_INICIAL = 0.4;
const PASSO_DA_FASE = 0.05;

export function raioDoCampo(largura: number, altura: number): number {
  return Math.min(largura, altura) * FRACAO_DO_RAIO;
}

function sortearRaio(sorteio: number): number {
  if (sorteio < 0.02) return 3.2;
  if (sorteio < 0.1) return 2;
  return 1.1;
}

function sortearTom(sorteio: number): Tom {
  if (sorteio < 0.06) return "sinal";
  if (sorteio < 0.4) return "suave";
  if (sorteio < 0.6) return "tenue";
  return "base";
}

export function criarCampo({ largura, altura, quantidade, aleatorio }: OpcoesDeCampo): NoAmbiente[] {
  const raio = raioDoCampo(largura, altura);
  const centroX = largura / 2;
  const centroY = altura / 2;

  return Array.from({ length: quantidade }, () => {
    const angulo = aleatorio() * Math.PI * 2;
    const distancia = Math.sqrt(aleatorio()) * raio;
    return {
      x: centroX + Math.cos(angulo) * distancia,
      y: centroY + Math.sin(angulo) * distancia,
      vx: (aleatorio() - 0.5) * 2 * VELOCIDADE_MAXIMA,
      vy: (aleatorio() - 0.5) * 2 * VELOCIDADE_MAXIMA,
      raio: sortearRaio(aleatorio()),
      tom: sortearTom(aleatorio()),
      fase: aleatorio() * Math.PI * 2,
      escala: 1,
      framesDeVida: null,
    };
  });
}

export function avancarCampo(nos: NoAmbiente[], { largura, altura }: OpcoesDeCampo): NoAmbiente[] {
  const raio = raioDoCampo(largura, altura);
  const limite = raio * LIMITE_DE_FUGA;
  const centroX = largura / 2;
  const centroY = altura / 2;

  return nos.map((no) => {
    const fugiu = Math.hypot(no.x - centroX, no.y - centroY) > limite;
    const vx = fugiu ? -no.vx : no.vx;
    const vy = fugiu ? -no.vy : no.vy;
    const framesDeVida = no.framesDeVida === null ? null : no.framesDeVida + 1;
    const escala =
      framesDeVida === null
        ? 1
        : Math.min(1, ESCALA_INICIAL + (1 - ESCALA_INICIAL) * (framesDeVida / FRAMES_ATE_CRESCER));

    return { ...no, x: no.x + vx, y: no.y + vy, vx, vy, fase: no.fase + PASSO_DA_FASE, escala, framesDeVida };
  });
}

export function calcularLigacoes(nos: NoAmbiente[], raio: number): [number, number][] {
  const distanciaMaxima = raio * FRACAO_DE_LIGACAO;
  const grau = new Array<number>(nos.length).fill(0);
  const ligacoes: [number, number][] = [];

  for (let a = 0; a < nos.length; a += 1) {
    for (let b = a + 1; b < nos.length; b += 1) {
      if (grau[a] >= MAXIMO_DE_LIGACOES || grau[b] >= MAXIMO_DE_LIGACOES) continue;
      if (Math.hypot(nos[a].x - nos[b].x, nos[a].y - nos[b].y) > distanciaMaxima) continue;
      ligacoes.push([a, b]);
      grau[a] += 1;
      grau[b] += 1;
    }
  }

  return ligacoes;
}

export function criarParticulas(nos: NoAmbiente[], quantidade: number, aleatorio: () => number): Particula[] {
  if (nos.length < 2) return [];

  return Array.from({ length: quantidade }, () => {
    const origem = nos[Math.floor(aleatorio() * nos.length)];
    const destino = nos[Math.floor(aleatorio() * nos.length)];
    return {
      deX: origem.x, deY: origem.y,
      paraX: destino.x, paraY: destino.y,
      progresso: 0,
      velocidade: 0.012 + aleatorio() * 0.012,
    };
  });
}

export function avancarParticulas(particulas: Particula[]): Particula[] {
  return particulas
    .map((particula) => ({ ...particula, progresso: particula.progresso + particula.velocidade }))
    .filter((particula) => particula.progresso < 1);
}

export function opacidadeDaParticula(progresso: number): number {
  return Math.sin(progresso * Math.PI);
}

export function nascerNo(nos: NoAmbiente[], { largura, altura, aleatorio }: OpcoesDeCampo): NoAmbiente[] {
  const raio = raioDoCampo(largura, altura);
  const angulo = aleatorio() * Math.PI * 2;

  return [
    ...nos,
    {
      x: largura / 2 + Math.cos(angulo) * raio * 0.3,
      y: altura / 2 + Math.sin(angulo) * raio * 0.3,
      vx: (aleatorio() - 0.5) * 2 * VELOCIDADE_MAXIMA,
      vy: (aleatorio() - 0.5) * 2 * VELOCIDADE_MAXIMA,
      raio: 2,
      tom: "sinal",
      fase: 0,
      escala: ESCALA_INICIAL,
      framesDeVida: 0,
    },
  ];
}

export function deveRotular(peso: number, selecionado: boolean): boolean {
  return selecionado || peso >= 1.2;
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test -- fisica`
Expected: PASS, 20 testes

- [ ] **Step 6: Commit**

```bash
git add mobile/src/compartilhado/grafo
git commit -m "feat(mobile): motor puro do campo de grafo com deriva, ligacoes e particulas"
```

---

## Task 10: `CampoDeGrafo` em modo ambiente

**Files:**
- Create: `mobile/src/compartilhado/grafo/implementacao-svg/CampoDeGrafoSvg.tsx`, `implementacao-svg/tomDoNo.ts`, `mobile/src/compartilhado/grafo/CampoDeGrafo.tsx`, `mobile/src/compartilhado/grafo/index.ts`, `mobile/src/funcionalidades/grafo/estado.ts`
- Modify: `mobile/src/compartilhado/tema/tokens/movimento.ts`, `mobile/jest.setup.ts`, `mobile/babel.config.js`
- Test: `mobile/src/compartilhado/grafo/CampoDeGrafo.test.tsx`, `mobile/src/funcionalidades/grafo/estado.test.ts`

**Interfaces:**
- Consumes: `fisica.ts`, `contrato.ts`, `useTema()`
- Produces: `<CampoDeGrafo {...PropsDoCampoDeGrafo} />`; `useEstadoGrafo` com `{ pulso, crescer, pulsar(), crescerNo() }`

- [ ] **Step 1: Instalar Reanimated, SVG, gesture-handler e zustand**

```bash
cd mobile
npx expo install react-native-svg react-native-reanimated react-native-gesture-handler
npm install zustand
```

- [ ] **Step 2: Ligar o plugin de babel do Reanimated**

Conferir a versão instalada e usar o plugin certo — na v4 ele mudou de pacote:

```bash
node -p "require('./node_modules/react-native-reanimated/package.json').version"
```

Se a major for **3**, `babel.config.js` termina com `plugins: ["react-native-reanimated/plugin"]`. Se for **4 ou maior**, o plugin é `"react-native-worklets/plugin"` e `react-native-worklets` já veio junto como dependência. O plugin tem que ser **o último da lista** nos dois casos.

- [ ] **Step 3: Preparar o Jest para o Reanimated e o gesture-handler**

Acrescentar em `mobile/jest.setup.ts`:

```ts
import "@testing-library/react-native/extend-expect";
import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
```

Se `react-native-reanimated/mock` não existir na versão instalada (ele saiu na v4), trocar essa linha pelo setup que a versão documenta — rodar `ls node_modules/react-native-reanimated/` para achar o arquivo de mock e ajustar o caminho.

- [ ] **Step 4: Fechar o `movimento.ts` com a curva real**

```ts
import { Easing } from "react-native-reanimated";

export const movimento = {
  duracaoRapida: 150,
  duracaoBase: 200,
  duracaoLenta: 300,
  curvaPadrao: Easing.bezier(0.2, 0, 0, 1),
} as const;

export type Movimento = typeof movimento;
```

- [ ] **Step 5: Escrever os testes que falham**

`mobile/src/funcionalidades/grafo/estado.test.ts`:

```ts
import { useEstadoGrafo } from "./estado";

describe("useEstadoGrafo", () => {
  beforeEach(() => useEstadoGrafo.setState({ pulso: 0, crescer: 0 }));

  it("incrementa o pulso", () => {
    useEstadoGrafo.getState().pulsar();
    useEstadoGrafo.getState().pulsar();
    expect(useEstadoGrafo.getState().pulso).toBe(2);
  });

  it("incrementa o contador de nós novos", () => {
    useEstadoGrafo.getState().crescerNo();
    expect(useEstadoGrafo.getState().crescer).toBe(1);
  });

  it("mantém os dois contadores independentes", () => {
    useEstadoGrafo.getState().pulsar();
    expect(useEstadoGrafo.getState().crescer).toBe(0);
  });
});
```

`mobile/src/compartilhado/grafo/CampoDeGrafo.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { CampoDeGrafo } from "./index";

function renderizar(props: Partial<React.ComponentProps<typeof CampoDeGrafo>> = {}) {
  return render(
    <ProvedorDeTema>
      <CampoDeGrafo modo="ambiente" densidade={60} ligado particulasLigadas pulso={0} crescer={0} {...props} />
    </ProvedorDeTema>,
  );
}

describe("CampoDeGrafo em modo ambiente", () => {
  it("desenha o campo quando ligado", () => {
    renderizar();
    expect(screen.getByTestId("campo-de-grafo")).toBeOnTheScreen();
  });

  it("não desenha nada quando desligado", () => {
    renderizar({ ligado: false });
    expect(screen.queryByTestId("campo-de-grafo")).toBeNull();
  });

  it("não intercepta toques em modo ambiente", () => {
    renderizar();
    expect(screen.getByTestId("campo-de-grafo")).toHaveStyle({ pointerEvents: "none" });
  });
});
```

- [ ] **Step 6: Rodar os testes e confirmar que falham**

Run: `cd mobile && npm test -- grafo`
Expected: FAIL — `Cannot find module './estado'` e `Cannot find module './index'`

- [ ] **Step 7: Escrever o store do grafo**

`mobile/src/funcionalidades/grafo/estado.ts`:

```ts
import { create } from "zustand";

type EstadoGrafo = {
  pulso: number;
  crescer: number;
  pulsar: () => void;
  crescerNo: () => void;
};

export const useEstadoGrafo = create<EstadoGrafo>((set) => ({
  pulso: 0,
  crescer: 0,
  pulsar: () => set((estado) => ({ pulso: estado.pulso + 1 })),
  crescerNo: () => set((estado) => ({ crescer: estado.crescer + 1 })),
}));
```

Fica num store separado de propósito: o chat não pode re-renderizar toda vez que o grafo pulsa.

- [ ] **Step 8: Escrever `tomDoNo.ts`**

```ts
import type { Cores } from "@/compartilhado/tema/tokens/cores";
import type { Tom } from "../fisica";

export function corDoTom(tom: Tom, cores: Cores): string {
  return {
    base: cores.grafoNoBase,
    suave: cores.grafoNoSuave,
    tenue: cores.grafoNoTenue,
    sinal: cores.grafoNoSinal,
  }[tom];
}
```

- [ ] **Step 9: Escrever `CampoDeGrafoSvg.tsx` (modo ambiente)**

```tsx
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useTema } from "@/compartilhado/tema";
import {
  avancarCampo, avancarParticulas, calcularLigacoes, criarCampo, criarParticulas,
  nascerNo, opacidadeDaParticula, raioDoCampo, type NoAmbiente, type OpcoesDeCampo, type Particula,
} from "../fisica";
import { corDoTom } from "./tomDoNo";
import type { PropsDoCampoDeGrafo } from "../contrato";

const QUADROS_POR_SEGUNDO = 30;
const PARTICULAS_POR_RAJADA = 8;

export function CampoDeGrafoSvg({ densidade, ligado, particulasLigadas, pulso, crescer }: PropsDoCampoDeGrafo) {
  const { cores } = useTema();
  const { width: largura, height: altura } = useWindowDimensions();

  const opcoes: OpcoesDeCampo = { largura, altura, quantidade: densidade, aleatorio: Math.random };
  const opcoesRef = useRef(opcoes);
  opcoesRef.current = opcoes;

  const [nos, setNos] = useState<NoAmbiente[]>(() => criarCampo(opcoes));
  const [particulas, setParticulas] = useState<Particula[]>([]);

  useEffect(() => {
    setNos(criarCampo(opcoesRef.current));
  }, [densidade, largura, altura]);

  useEffect(() => {
    if (!ligado) return;
    const intervalo = setInterval(() => {
      setNos((atuais) => avancarCampo(atuais, opcoesRef.current));
      setParticulas(avancarParticulas);
    }, 1000 / QUADROS_POR_SEGUNDO);
    return () => clearInterval(intervalo);
  }, [ligado]);

  useEffect(() => {
    if (pulso === 0 || !particulasLigadas) return;
    setNos((atuais) => {
      setParticulas((anteriores) => [...anteriores, ...criarParticulas(atuais, PARTICULAS_POR_RAJADA, Math.random)]);
      return atuais;
    });
  }, [pulso, particulasLigadas]);

  useEffect(() => {
    if (crescer === 0) return;
    setNos((atuais) => nascerNo(atuais, opcoesRef.current));
  }, [crescer]);

  if (!ligado) return null;

  const raio = raioDoCampo(largura, altura);
  const ligacoes = calcularLigacoes(nos, raio);

  return (
    <View testID="campo-de-grafo" pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}>
      <Svg width={largura} height={altura}>
        {ligacoes.map(([a, b]) => (
          <Line key={`${a}-${b}`} x1={nos[a].x} y1={nos[a].y} x2={nos[b].x} y2={nos[b].y} stroke={cores.grafoLigacao} strokeWidth={1} />
        ))}
        {nos.map((no, indice) => (
          <Circle
            key={indice}
            cx={no.x}
            cy={no.y}
            r={no.raio * no.escala * (1 + Math.sin(no.fase) * 0.06)}
            fill={corDoTom(no.tom, cores)}
          />
        ))}
        {particulas.map((particula, indice) => (
          <Circle
            key={`particula-${indice}`}
            cx={particula.deX + (particula.paraX - particula.deX) * particula.progresso}
            cy={particula.deY + (particula.paraY - particula.deY) * particula.progresso}
            r={2.4}
            fill={cores.grafoNoSinal}
            opacity={opacidadeDaParticula(particula.progresso)}
          />
        ))}
      </Svg>
    </View>
  );
}
```

O `pointerEvents="none"` é o que faz o campo ficar atrás do chat sem roubar toque. 30 fps é deliberado: o campo ambiente é decorativo, e 60 fps com 60 nós em SVG não sobra orçamento para o resto da tela. Se ficar pesado no aparelho de teste, baixar para 24.

- [ ] **Step 10: Escrever o componente público**

`CampoDeGrafo.tsx`:

```tsx
import { CampoDeGrafoSvg } from "./implementacao-svg/CampoDeGrafoSvg";
import type { PropsDoCampoDeGrafo } from "./contrato";

export function CampoDeGrafo(props: PropsDoCampoDeGrafo) {
  return <CampoDeGrafoSvg {...props} />;
}
```

`index.ts`:

```ts
export { CampoDeGrafo } from "./CampoDeGrafo";
export type { PropsDoCampoDeGrafo, ModoDoGrafo } from "./contrato";
```

Trocar por Skia depois é trocar a linha de dentro deste arquivo — nenhuma tela sabe qual implementação está rodando.

- [ ] **Step 11: Rodar os testes e confirmar que passam**

Run: `cd mobile && npm test -- grafo`
Expected: PASS, 6 testes

- [ ] **Step 12: Ligar o GestureHandlerRootView no layout raiz**

Em `mobile/app/_layout.tsx`, envolver tudo com `<GestureHandlerRootView style={{ flex: 1 }}>` — sem ele, os gestos da Task 12 não funcionam no Android.

- [ ] **Step 13: Conferir o campo no Expo Go**

Colocar `<CampoDeGrafo modo="ambiente" densidade={60} ligado particulasLigadas pulso={0} crescer={0} />` dentro de `app/(app)/bimo.tsx` e rodar `npx expo start`. Confirmar: nós à deriva atrás do texto, sem engasgo, e que tocar na tela não é bloqueado pelo campo.

- [ ] **Step 14: Commit**

```bash
git add mobile/src/compartilhado/grafo mobile/src/funcionalidades/grafo mobile/app mobile/jest.setup.ts mobile/babel.config.js mobile/src/compartilhado/tema/tokens/movimento.ts
git commit -m "feat(mobile): campo de grafo ambiente em SVG com particulas e nos novos"
```

---

## Task 11: Tela Bimo (chat)

**Files:**
- Create: `mobile/src/funcionalidades/chat/estado.ts`, `componentes/Bolha.tsx`, `componentes/CartaoDeResultado.tsx`, `componentes/IndicadorDeDigitacao.tsx`, `componentes/Composer.tsx`, `Chat.tsx`
- Modify: `mobile/app/(app)/bimo.tsx`
- Test: `mobile/src/funcionalidades/chat/estado.test.ts`, `mobile/src/funcionalidades/chat/Chat.test.tsx`

**Interfaces:**
- Consumes: `useServicos()`, `useEstadoGrafo`, `CampoDeGrafo`, componentes de UI
- Produces: `useEstadoChat` com `{ mensagens, rascunho, digitando, definirRascunho, enviar(servicoIa, aoPulsar), preencherRascunho(texto) }`

- [ ] **Step 1: Escrever o teste de estado que falha**

`mobile/src/funcionalidades/chat/estado.test.ts`:

```ts
import { useEstadoChat } from "./estado";
import type { ServicoIA } from "@/servicos";
import { notas } from "@/dados/fixtures/notas";

const iaDublê: ServicoIA = {
  conversar: async () => ({ texto: "Encontrei 2 notas.", cartoes: [notas[0].id, notas[1].id] }),
  acaoNaNota: async () => ({ tipo: "resumo", rotulo: "Resumir a nota", texto: "resumo" }),
};

describe("useEstadoChat", () => {
  beforeEach(() => useEstadoChat.setState({ mensagens: [], rascunho: "", digitando: false }));

  it("guarda o rascunho", () => {
    useEstadoChat.getState().definirRascunho("o que escrevi sobre notas?");
    expect(useEstadoChat.getState().rascunho).toBe("o que escrevi sobre notas?");
  });

  it("ignora enviar com rascunho vazio", async () => {
    useEstadoChat.getState().definirRascunho("   ");
    await useEstadoChat.getState().enviar(iaDublê, jest.fn());
    expect(useEstadoChat.getState().mensagens).toHaveLength(0);
  });

  it("acrescenta a bolha do usuário e limpa o rascunho na hora", async () => {
    useEstadoChat.getState().definirRascunho("oi");
    const promessa = useEstadoChat.getState().enviar(iaDublê, jest.fn());
    expect(useEstadoChat.getState().mensagens[0].autor).toBe("usuario");
    expect(useEstadoChat.getState().rascunho).toBe("");
    expect(useEstadoChat.getState().digitando).toBe(true);
    await promessa;
  });

  it("acrescenta a resposta do agente com cartões e desliga o digitando", async () => {
    useEstadoChat.getState().definirRascunho("oi");
    await useEstadoChat.getState().enviar(iaDublê, jest.fn());
    const [, resposta] = useEstadoChat.getState().mensagens;
    expect(resposta.autor).toBe("agente");
    expect(resposta.cartoes).toEqual([notas[0].id, notas[1].id]);
    expect(useEstadoChat.getState().digitando).toBe(false);
  });

  it("pulsa o grafo duas vezes: ao enviar e ao responder", async () => {
    const aoPulsar = jest.fn();
    useEstadoChat.getState().definirRascunho("oi");
    await useEstadoChat.getState().enviar(iaDublê, aoPulsar);
    expect(aoPulsar).toHaveBeenCalledTimes(2);
  });

  it("preenche o rascunho com a pergunta sobre um nó", () => {
    useEstadoChat.getState().preencherRascunho("Notas atômicas");
    expect(useEstadoChat.getState().rascunho).toBe("O que eu já escrevi sobre 'Notas atômicas'?");
  });

  it("mostra o erro como mensagem do agente quando o serviço falha", async () => {
    const iaQuebrada: ServicoIA = {
      conversar: async () => { throw new Error("sem rede"); },
      acaoNaNota: iaDublê.acaoNaNota,
    };
    useEstadoChat.getState().definirRascunho("oi");
    await useEstadoChat.getState().enviar(iaQuebrada, jest.fn());
    const [, resposta] = useEstadoChat.getState().mensagens;
    expect(resposta.autor).toBe("agente");
    expect(resposta.texto).toContain("Não consegui");
    expect(useEstadoChat.getState().digitando).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- chat/estado`
Expected: FAIL — `Cannot find module './estado'`

- [ ] **Step 3: Escrever `estado.ts`**

```ts
import { create } from "zustand";
import type { Mensagem } from "@/dados/tipos";
import type { ServicoIA } from "@/servicos";
import { mensagensIniciais } from "@/dados/fixtures/mensagens";

function agora(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function novoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type EstadoChat = {
  mensagens: Mensagem[];
  rascunho: string;
  digitando: boolean;
  definirRascunho: (texto: string) => void;
  preencherRascunho: (titulo: string) => void;
  enviar: (ia: ServicoIA, aoPulsar: () => void) => Promise<void>;
};

export const useEstadoChat = create<EstadoChat>((set, get) => ({
  mensagens: mensagensIniciais,
  rascunho: "",
  digitando: false,

  definirRascunho: (texto) => set({ rascunho: texto }),

  preencherRascunho: (titulo) => set({ rascunho: `O que eu já escrevi sobre '${titulo}'?` }),

  enviar: async (ia, aoPulsar) => {
    const texto = get().rascunho.trim();
    if (texto.length === 0) return;

    set((estado) => ({
      mensagens: [...estado.mensagens, { id: novoId(), autor: "usuario", texto, horario: agora() }],
      rascunho: "",
      digitando: true,
    }));
    aoPulsar();

    try {
      const resposta = await ia.conversar(texto);
      set((estado) => ({
        mensagens: [...estado.mensagens, { id: novoId(), autor: "agente", texto: resposta.texto, horario: agora(), cartoes: resposta.cartoes }],
        digitando: false,
      }));
    } catch {
      set((estado) => ({
        mensagens: [...estado.mensagens, { id: novoId(), autor: "agente", texto: "Não consegui consultar o vault agora. Tenta de novo em instantes.", horario: agora() }],
        digitando: false,
      }));
    }

    aoPulsar();
  },
}));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test -- chat/estado`
Expected: PASS, 7 testes

- [ ] **Step 5: Escrever o teste de tela que falha**

`mobile/src/funcionalidades/chat/Chat.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { ProvedorDeServicos, type Servicos } from "@/servicos";
import { servicoVaultFake } from "@/servicos/fake/servicoVaultFake";
import { notas } from "@/dados/fixtures/notas";
import { useEstadoChat } from "./estado";
import { Chat } from "./Chat";

const push = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push }) }));

const servicos: Servicos = {
  vault: servicoVaultFake,
  ia: {
    conversar: async () => ({ texto: "Encontrei 1 nota.", cartoes: [notas[0].id] }),
    acaoNaNota: async () => ({ tipo: "resumo", rotulo: "Resumir a nota", texto: "resumo" }),
  },
};

function renderizar() {
  return render(
    <ProvedorDeTema>
      <ProvedorDeServicos servicos={servicos}>
        <Chat />
      </ProvedorDeServicos>
    </ProvedorDeTema>,
  );
}

describe("Chat", () => {
  beforeEach(() => {
    push.mockClear();
    useEstadoChat.setState({ mensagens: [], rascunho: "", digitando: false });
  });

  it("mostra o placeholder do composer", () => {
    renderizar();
    expect(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault...")).toBeOnTheScreen();
  });

  it("envia a mensagem e mostra a bolha do usuário", async () => {
    renderizar();
    fireEvent.changeText(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault..."), "notas atômicas");
    fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("notas atômicas")).toBeOnTheScreen();
  });

  it("mostra o indicador de digitação enquanto espera", async () => {
    renderizar();
    fireEvent.changeText(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault..."), "oi");
    fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByTestId("indicador-de-digitacao")).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId("indicador-de-digitacao")).toBeNull());
  });

  it("mostra a resposta com um cartão de resultado", async () => {
    renderizar();
    fireEvent.changeText(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault..."), "oi");
    fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(notas[0].titulo)).toBeOnTheScreen();
  });

  it("abre o editor ao tocar num cartão", async () => {
    renderizar();
    fireEvent.changeText(screen.getByPlaceholderText("Pergunte ao Bimo ou consulte seu vault..."), "oi");
    fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.press(await screen.findByText(notas[0].titulo));
    expect(push).toHaveBeenCalledWith(`/editor/${notas[0].id}`);
  });

  it("não envia com o composer vazio", () => {
    renderizar();
    fireEvent.press(screen.getByRole("button", { name: "Enviar" }));
    expect(useEstadoChat.getState().mensagens).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- Chat`
Expected: FAIL — `Cannot find module './Chat'`

- [ ] **Step 7: Escrever os componentes do chat**

`componentes/Bolha.tsx` — a assinatura visual da marca é o raio 12 com **um** canto em 6, do lado da cauda:

```tsx
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "@/compartilhado/ui";

type Props = { autor: "usuario" | "agente"; texto: string; horario: string; children?: ReactNode };

export function Bolha({ autor, texto, horario, children }: Props) {
  const { cores, tipografia, espacamento, raios, sombras } = useTema();
  const doUsuario = autor === "usuario";

  const cantos = doUsuario
    ? { borderBottomRightRadius: raios.cauda }
    : { borderBottomLeftRadius: raios.cauda };

  const corpo = (
    <View style={{ padding: espacamento.md }}>
      <Text style={[tipografia.corpoRelaxado, { color: doUsuario ? cores.sobrePrimaria : cores.sobreSuperficie }]}>{texto}</Text>
      {children}
    </View>
  );

  return (
    <View style={{ alignSelf: doUsuario ? "flex-end" : "flex-start", maxWidth: "85%" }}>
      {doUsuario ? (
        <View style={[{ backgroundColor: cores.bolhaUsuario, borderWidth: 1, borderColor: cores.bolhaUsuarioBorda, borderRadius: raios.bolha, overflow: "hidden" }, cantos, sombras.pequena]}>
          {corpo}
        </View>
      ) : (
        <Vidro nivel="bolha" style={[{ borderWidth: 1, borderColor: cores.fioDeCabelo, borderRadius: raios.bolha, overflow: "hidden" }, cantos, sombras.pequena]}>
          {corpo}
        </Vidro>
      )}
      <Text
        style={[
          tipografia.legenda,
          { color: cores.textoTenue, marginTop: espacamento.xs, alignSelf: doUsuario ? "flex-end" : "flex-start", paddingHorizontal: espacamento.xs },
        ]}
      >
        {doUsuario ? horario : `Bimo AI · ${horario}`}
      </Text>
    </View>
  );
}
```

`componentes/CartaoDeResultado.tsx`:

```tsx
import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Cartao, Icone } from "@/compartilhado/ui";
import type { Nota } from "@/dados/tipos";

export function CartaoDeResultado({ nota, aoTocar }: { nota: Nota; aoTocar: () => void }) {
  const { cores, tipografia, espacamento } = useTema();

  return (
    <Cartao aoTocar={aoTocar} style={{ marginTop: espacamento.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icone nome="description" tamanho={16} cor={cores.primaria} />
        <Text style={[tipografia.titleSm, { color: cores.primaria, flex: 1 }]} numberOfLines={1}>
          {nota.titulo}
        </Text>
      </View>
      <Text style={[tipografia.legenda, { color: cores.textoSuave, marginTop: espacamento.xs }]} numberOfLines={2}>
        {nota.resumo}
      </Text>
    </Cartao>
  );
}
```

`componentes/IndicadorDeDigitacao.tsx` — três círculos de 6 px com bounce escalonado em 0 / 0.2 / 0.4 s:

```tsx
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "@/compartilhado/ui";

function Ponto({ atraso }: { atraso: number }) {
  const { cores, movimento } = useTema();
  const deslocamento = useSharedValue(0);

  useEffect(() => {
    deslocamento.value = withDelay(
      atraso,
      withRepeat(withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 })), -1, false),
    );
  }, [atraso, deslocamento, movimento]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ translateY: deslocamento.value }] }));

  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: cores.contorno }, estilo]} />;
}

export function IndicadorDeDigitacao() {
  const { cores, espacamento, raios } = useTema();

  return (
    <View testID="indicador-de-digitacao" style={{ alignSelf: "flex-start" }}>
      <Vidro
        nivel="bolha"
        style={{
          flexDirection: "row", gap: espacamento.xs, padding: espacamento.md,
          borderWidth: 1, borderColor: cores.fioDeCabelo,
          borderRadius: raios.bolha, borderBottomLeftRadius: raios.cauda, overflow: "hidden",
        }}
      >
        <Ponto atraso={0} />
        <Ponto atraso={200} />
        <Ponto atraso={400} />
      </Vidro>
    </View>
  );
}
```

`componentes/Composer.tsx`:

```tsx
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTema } from "@/compartilhado/tema";
import { Icone, Vidro } from "@/compartilhado/ui";

type Props = { valor: string; aoMudar: (texto: string) => void; aoEnviar: () => void };

export function Composer({ valor, aoMudar, aoEnviar }: Props) {
  const { cores, tipografia, espacamento, raios, sombras } = useTema();
  const [focado, setFocado] = useState(false);

  return (
    <View>
      <LinearGradient colors={cores.protecaoDock as unknown as [string, string, string]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96 }} pointerEvents="none" />
      <View style={{ paddingHorizontal: espacamento.gutter, paddingTop: espacamento.sm, paddingBottom: espacamento.md }}>
        <Vidro
          nivel="dock"
          style={[
            { padding: espacamento.xs, borderRadius: raios.folha, borderWidth: 1, borderColor: focado ? cores.primaria : cores.fioDeCabelo, overflow: "hidden" },
            sombras.grande,
          ]}
        >
          <TextInput
            value={valor}
            onChangeText={aoMudar}
            onFocus={() => setFocado(true)}
            onBlur={() => setFocado(false)}
            placeholder="Pergunte ao Bimo ou consulte seu vault..."
            placeholderTextColor={cores.textoPlaceholder}
            multiline
            style={[tipografia.corpo, { color: cores.sobreSuperficie, minHeight: 46, maxHeight: espacamento.alturaMaximaComposer, padding: espacamento.md }]}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.md, paddingHorizontal: espacamento.sm, paddingBottom: espacamento.xs }}>
            <Icone nome="attach_file" tamanho={20} cor={cores.contorno} />
            <Icone nome="center_focus_strong" tamanho={20} cor={cores.contorno} />
            <View style={{ flex: 1 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar"
              onPress={aoEnviar}
              style={{ width: 32, height: 32, borderRadius: raios.cartao, backgroundColor: cores.primaria, alignItems: "center", justifyContent: "center" }}
              hitSlop={8}
            >
              <Icone nome="arrow_upward" tamanho={18} cor={cores.sobrePrimaria} />
            </Pressable>
          </View>
        </Vidro>
      </View>
    </View>
  );
}
```

Instalar o gradiente do dock: `npx expo install expo-linear-gradient`.

O botão enviar tem 32 px, abaixo dos 44 do alvo mínimo — por isso o `hitSlop={8}`, que leva a área tocável a 48.

- [ ] **Step 8: Escrever `Chat.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { useServicos } from "@/servicos";
import { CampoDeGrafo } from "@/compartilhado/grafo";
import { useEstadoGrafo } from "@/funcionalidades/grafo/estado";
import { useEstadoConta } from "@/funcionalidades/conta/estado";
import type { Nota } from "@/dados/tipos";
import { Bolha } from "./componentes/Bolha";
import { CartaoDeResultado } from "./componentes/CartaoDeResultado";
import { IndicadorDeDigitacao } from "./componentes/IndicadorDeDigitacao";
import { Composer } from "./componentes/Composer";
import { useEstadoChat } from "./estado";

export function Chat() {
  const { espacamento } = useTema();
  const router = useRouter();
  const { vault, ia } = useServicos();
  const { mensagens, rascunho, digitando, definirRascunho, enviar } = useEstadoChat();
  const pulsar = useEstadoGrafo((estado) => estado.pulsar);
  const pulso = useEstadoGrafo((estado) => estado.pulso);
  const crescerContador = useEstadoGrafo((estado) => estado.crescer);
  const { interruptores, densidade } = useEstadoConta();
  const [notas, setNotas] = useState<Nota[]>([]);
  const lista = useRef<FlatList>(null);

  useEffect(() => {
    vault.listarNotas().then(setNotas);
  }, [vault]);

  useEffect(() => {
    lista.current?.scrollToEnd({ animated: true });
  }, [mensagens.length, digitando]);

  return (
    <View style={{ flex: 1 }}>
      <CampoDeGrafo
        modo="ambiente"
        densidade={densidade}
        ligado={interruptores.grafo}
        particulasLigadas={interruptores.particulas}
        pulso={pulso}
        crescer={crescerContador}
      />
      <FlatList
        ref={lista}
        data={mensagens}
        keyExtractor={(mensagem) => mensagem.id}
        contentContainerStyle={{ padding: espacamento.gutter, gap: espacamento.gutter }}
        renderItem={({ item }) => (
          <Bolha autor={item.autor} texto={item.texto} horario={item.horario}>
            {item.cartoes?.map((id) => {
              const nota = notas.find((candidata) => candidata.id === id);
              if (!nota) return null;
              return <CartaoDeResultado key={id} nota={nota} aoTocar={() => router.push(`/editor/${nota.id}`)} />;
            })}
          </Bolha>
        )}
        ListFooterComponent={digitando ? <IndicadorDeDigitacao /> : null}
      />
      <Composer valor={rascunho} aoMudar={definirRascunho} aoEnviar={() => enviar(ia, pulsar)} />
    </View>
  );
}
```

`useEstadoConta` vem da Task 15. Até ela existir, substituir as três linhas que a usam por `const interruptores = { grafo: true, particulas: true }; const densidade = 60;` e trocar de volta na Task 15.

`mobile/app/(app)/bimo.tsx`:

```tsx
import { Chat } from "@/funcionalidades/chat/Chat";

export default function RotaBimo() {
  return <Chat />;
}
```

- [ ] **Step 9: Rodar os testes e confirmar que passam**

Run: `cd mobile && npm test -- Chat`
Expected: PASS, 6 testes

- [ ] **Step 10: Conferir o fluxo no Expo Go**

Run: `cd mobile && npx expo start`
Expected: digitar e enviar mostra a bolha à direita, os três pontos pulando, uma rajada de partículas no grafo de fundo e, ~1,6 s depois, a bolha do agente com o cartão. Tocar no cartão dá erro de rota (o editor só chega na Task 14) — esperado.

- [ ] **Step 11: Commit**

```bash
git add mobile/src/funcionalidades/chat mobile/app/(app)/bimo.tsx mobile/package.json
git commit -m "feat(mobile): tela de chat com bolhas, cartoes de resultado e composer"
```

---

## Task 12: `CampoDeGrafo` em modo interativo

**Files:**
- Create: `mobile/src/compartilhado/grafo/implementacao-svg/GrafoInterativo.tsx`, `mobile/src/compartilhado/grafo/posicionamento.ts`
- Modify: `mobile/src/compartilhado/grafo/CampoDeGrafo.tsx`
- Test: `mobile/src/compartilhado/grafo/posicionamento.test.ts`, `mobile/src/compartilhado/grafo/GrafoInterativo.test.tsx`

**Interfaces:**
- Consumes: `fisica.ts`, `contrato.ts`
- Produces:
  - `posicionarNo(no: NoDoGrafo, largura: number, altura: number): { x: number; y: number }`
  - `noMaisProximo(nos: NoDoGrafo[], toqueX: number, toqueY: number, largura: number, altura: number): string | null`

- [ ] **Step 1: Escrever o teste de posicionamento que falha**

`mobile/src/compartilhado/grafo/posicionamento.test.ts`:

```ts
import { noMaisProximo, posicionarNo, raioDoNo } from "./posicionamento";
import type { NoDoGrafo } from "@/dados/tipos";

const LARGURA = 402;
const ALTURA = 700;

const nos: NoDoGrafo[] = [
  { id: "a", titulo: "A", x: 0.5, y: 0.5, peso: 1.4 },
  { id: "b", titulo: "B", x: 0.2, y: 0.2, peso: 0.8 },
];

describe("posicionarNo", () => {
  it("mapeia 0,5 / 0,5 para o centro da tela", () => {
    const { x, y } = posicionarNo(nos[0], LARGURA, ALTURA);
    expect(x).toBeCloseTo(LARGURA / 2);
    expect(y).toBeCloseTo(ALTURA / 2);
  });

  it("mapeia coordenadas normalizadas para centro ± raio × 1,05", () => {
    const { x } = posicionarNo({ ...nos[0], x: 1 }, LARGURA, ALTURA);
    const raio = Math.min(LARGURA, ALTURA) * 0.62 * 1.05;
    expect(x).toBeCloseTo(LARGURA / 2 + raio);
  });
});

describe("raioDoNo", () => {
  it("é o peso vezes 5,5", () => {
    expect(raioDoNo(1.4)).toBeCloseTo(7.7);
  });
});

describe("noMaisProximo", () => {
  it("acha o nó sob o toque", () => {
    const { x, y } = posicionarNo(nos[0], LARGURA, ALTURA);
    expect(noMaisProximo(nos, x, y, LARGURA, ALTURA)).toBe("a");
  });

  it("aceita um toque a até raio + 10 px do centro do nó", () => {
    const { x, y } = posicionarNo(nos[0], LARGURA, ALTURA);
    expect(noMaisProximo(nos, x + raioDoNo(nos[0].peso) + 9, y, LARGURA, ALTURA)).toBe("a");
  });

  it("devolve null quando o toque cai longe de todo mundo", () => {
    const { x, y } = posicionarNo(nos[0], LARGURA, ALTURA);
    expect(noMaisProximo(nos, x + raioDoNo(nos[0].peso) + 40, y, LARGURA, ALTURA)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- posicionamento`
Expected: FAIL — `Cannot find module './posicionamento'`

- [ ] **Step 3: Escrever `posicionamento.ts`**

```ts
import type { NoDoGrafo } from "@/dados/tipos";
import { raioDoCampo } from "./fisica";

const EXPANSAO = 1.05;
const RAIO_POR_PESO = 5.5;
const TOLERANCIA_DE_TOQUE = 10;

export function raioDoNo(peso: number): number {
  return peso * RAIO_POR_PESO;
}

export function posicionarNo(no: NoDoGrafo, largura: number, altura: number): { x: number; y: number } {
  const raio = raioDoCampo(largura, altura) * EXPANSAO;
  return {
    x: largura / 2 + (no.x - 0.5) * 2 * raio,
    y: altura / 2 + (no.y - 0.5) * 2 * raio,
  };
}

export function noMaisProximo(nos: NoDoGrafo[], toqueX: number, toqueY: number, largura: number, altura: number): string | null {
  let escolhido: string | null = null;
  let menorDistancia = Number.POSITIVE_INFINITY;

  for (const no of nos) {
    const { x, y } = posicionarNo(no, largura, altura);
    const distancia = Math.hypot(x - toqueX, y - toqueY);
    if (distancia <= raioDoNo(no.peso) + TOLERANCIA_DE_TOQUE && distancia < menorDistancia) {
      menorDistancia = distancia;
      escolhido = no.id;
    }
  }

  return escolhido;
}
```

- [ ] **Step 4: Escrever o teste de interação que falha**

`mobile/src/compartilhado/grafo/GrafoInterativo.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import type { NoDoGrafo } from "@/dados/tipos";
import { GrafoInterativo } from "./implementacao-svg/GrafoInterativo";

const nos: NoDoGrafo[] = [
  { id: "a", titulo: "Notas atômicas", x: 0.5, y: 0.5, peso: 1.4 },
  { id: "b", titulo: "Zettelkasten", x: 0.3, y: 0.4, peso: 0.8 },
];

function renderizar(props: Partial<React.ComponentProps<typeof GrafoInterativo>> = {}) {
  const aoSelecionarNo = jest.fn();
  render(
    <ProvedorDeTema>
      <GrafoInterativo nos={nos} arestas={[{ de: "a", para: "b" }]} noSelecionado={null} aoSelecionarNo={aoSelecionarNo} {...props} />
    </ProvedorDeTema>,
  );
  return { aoSelecionarNo };
}

describe("GrafoInterativo", () => {
  it("rotula só os nós de peso 1,2 ou mais", () => {
    renderizar();
    expect(screen.getByText("Notas atômicas")).toBeOnTheScreen();
    expect(screen.queryByText("Zettelkasten")).toBeNull();
  });

  it("rotula o nó selecionado mesmo com peso baixo", () => {
    renderizar({ noSelecionado: "b" });
    expect(screen.getByText("Zettelkasten")).toBeOnTheScreen();
  });

  it("aceita toque, diferente do modo ambiente", () => {
    renderizar();
    expect(screen.getByTestId("grafo-interativo")).toBeOnTheScreen();
  });

  it("seleciona o nó tocado", () => {
    const { aoSelecionarNo } = renderizar();
    fireEvent.press(screen.getByTestId("alvo-do-no-a"));
    expect(aoSelecionarNo).toHaveBeenCalledWith("a");
  });

  it("limpa a seleção ao tocar fora dos nós", () => {
    const { aoSelecionarNo } = renderizar({ noSelecionado: "a" });
    fireEvent.press(screen.getByTestId("fundo-do-grafo"));
    expect(aoSelecionarNo).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- GrafoInterativo`
Expected: FAIL — `Cannot find module './implementacao-svg/GrafoInterativo'`

- [ ] **Step 6: Escrever `GrafoInterativo.tsx`**

```tsx
import { useMemo } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Circle, G, Line, Text as TextoSvg } from "react-native-svg";
import { useTema } from "@/compartilhado/tema";
import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import { deveRotular } from "../fisica";
import { posicionarNo, raioDoNo } from "../posicionamento";

const ZOOM_MINIMO = 0.6;
const ZOOM_MAXIMO = 2.4;

type Props = {
  nos: NoDoGrafo[];
  arestas: Aresta[];
  noSelecionado: string | null;
  aoSelecionarNo: (id: string | null) => void;
};

export function GrafoInterativo({ nos, arestas, noSelecionado, aoSelecionarNo }: Props) {
  const { cores, tipografia } = useTema();
  const { width: largura, height: altura } = useWindowDimensions();

  const deslocamentoX = useSharedValue(0);
  const deslocamentoY = useSharedValue(0);
  const zoom = useSharedValue(1);

  const arrastar = Gesture.Pan().onChange((evento) => {
    deslocamentoX.value += evento.changeX;
    deslocamentoY.value += evento.changeY;
  });

  const pinçar = Gesture.Pinch().onChange((evento) => {
    zoom.value = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, zoom.value * evento.scaleChange));
  });

  const gestos = Gesture.Simultaneous(arrastar, pinçar);

  const estiloDaCamada = useAnimatedStyle(() => ({
    transform: [{ translateX: deslocamentoX.value }, { translateY: deslocamentoY.value }, { scale: zoom.value }],
  }));

  const posicoes = useMemo(
    () => new Map(nos.map((no) => [no.id, posicionarNo(no, largura, altura)])),
    [nos, largura, altura],
  );

  return (
    <View testID="grafo-interativo" style={StyleSheet.absoluteFill}>
      <Pressable testID="fundo-do-grafo" onPress={() => aoSelecionarNo(null)} style={StyleSheet.absoluteFill} />
      <GestureDetector gesture={gestos}>
        <Animated.View style={[StyleSheet.absoluteFill, estiloDaCamada]}>
          <Svg width={largura} height={altura}>
            {arestas.map((aresta) => {
              const de = posicoes.get(aresta.de);
              const para = posicoes.get(aresta.para);
              if (!de || !para) return null;
              return <Line key={`${aresta.de}-${aresta.para}`} x1={de.x} y1={de.y} x2={para.x} y2={para.y} stroke={cores.grafoLigacaoNomeada} strokeWidth={1} />;
            })}

            {nos.map((no) => {
              const posicao = posicoes.get(no.id);
              if (!posicao) return null;
              const selecionado = no.id === noSelecionado;

              return (
                <G key={no.id}>
                  {selecionado ? <Circle cx={posicao.x} cy={posicao.y} r={raioDoNo(no.peso) + 7} fill="none" stroke={cores.grafoAnelSelecao} strokeWidth={2} /> : null}
                  <Circle
                    cx={posicao.x}
                    cy={posicao.y}
                    r={raioDoNo(no.peso)}
                    fill={selecionado ? cores.grafoNoSinal : cores.grafoNoPreenchimento}
                    stroke={selecionado ? cores.grafoNoSinal : cores.grafoNoBorda}
                    strokeWidth={1}
                  />
                  {deveRotular(no.peso, selecionado) ? (
                    <TextoSvg
                      x={posicao.x}
                      y={posicao.y + raioDoNo(no.peso) + 14}
                      fontSize={12}
                      fontFamily={tipografia.rotuloSm.fontFamily}
                      fill={selecionado ? cores.grafoNoRotuloSelecionado : cores.grafoNoRotulo}
                      textAnchor="middle"
                    >
                      {no.titulo}
                    </TextoSvg>
                  ) : null}
                </G>
              );
            })}
          </Svg>

          {nos.map((no) => {
            const posicao = posicoes.get(no.id);
            if (!posicao) return null;
            const alvo = raioDoNo(no.peso) + 10;
            return (
              <Pressable
                key={`alvo-${no.id}`}
                testID={`alvo-do-no-${no.id}`}
                accessibilityRole="button"
                accessibilityLabel={no.titulo}
                onPress={() => aoSelecionarNo(no.id)}
                style={{ position: "absolute", left: posicao.x - alvo, top: posicao.y - alvo, width: alvo * 2, height: alvo * 2 }}
              />
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
```

Os alvos de toque são `Pressable`s posicionados por cima do SVG em vez de handlers no `<Circle>`: `react-native-svg` só entrega toque de forma confiável no elemento raiz, e assim o raio de acerto de `raio + 10` fica explícito.

- [ ] **Step 7: Ligar o modo interativo no componente público**

`CampoDeGrafo.tsx`:

```tsx
import { CampoDeGrafoSvg } from "./implementacao-svg/CampoDeGrafoSvg";
import { GrafoInterativo } from "./implementacao-svg/GrafoInterativo";
import type { PropsDoCampoDeGrafo } from "./contrato";

export function CampoDeGrafo(props: PropsDoCampoDeGrafo) {
  if (props.modo === "interativo") {
    return (
      <>
        <CampoDeGrafoSvg {...props} />
        <GrafoInterativo
          nos={props.nos ?? []}
          arestas={props.arestas ?? []}
          noSelecionado={props.noSelecionado ?? null}
          aoSelecionarNo={props.aoSelecionarNo ?? (() => {})}
        />
      </>
    );
  }

  return <CampoDeGrafoSvg {...props} />;
}
```

O modo interativo desenha o campo ambiente por baixo e os nós nomeados por cima, como manda o handoff.

- [ ] **Step 8: Rodar os testes e confirmar que passam**

Run: `cd mobile && npm test`
Expected: tudo verde. O pattern `grafo` pega tanto `src/compartilhado/grafo/` quanto `src/funcionalidades/grafo/`, então rodar a suíte inteira aqui é mais honesto que filtrar.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/compartilhado/grafo
git commit -m "feat(mobile): grafo interativo com pan, zoom, selecao de no e regra de rotulo"
```

---

## Task 13: Tela Nota — grafo em tela cheia + folha de notas

**Files:**
- Create: `mobile/src/funcionalidades/vault/grafoDoVault.ts`, `estado.ts`, `componentes/FolhaDeNotas.tsx`, `componentes/CartaoDeNota.tsx`, `componentes/ChipsDeContexto.tsx`, `TelaNota.tsx`
- Modify: `mobile/app/(app)/nota.tsx`
- Test: `mobile/src/funcionalidades/vault/grafoDoVault.test.ts`, `estado.test.ts`, `TelaNota.test.tsx`

**Interfaces:**
- Consumes: `CampoDeGrafo`, `useServicos()`, componentes de UI
- Produces:
  - `montarGrafo(notas: Nota[], arestas: Aresta[]): NoDoGrafo[]`
  - `vizinhosDe(id: string, arestas: Aresta[]): string[]`
  - `useEstadoVault` com `{ busca, noSelecionado, passoDaFolha, definirBusca, selecionarNo, limparSelecao, avancarPasso }`

- [ ] **Step 1: Escrever os testes que falham**

`mobile/src/funcionalidades/vault/grafoDoVault.test.ts`:

```ts
import { montarGrafo, vizinhosDe, filtrarNotas } from "./grafoDoVault";
import { notas } from "@/dados/fixtures/notas";
import { arestas } from "@/dados/fixtures/arestas";

describe("montarGrafo", () => {
  it("cria um nó por nota", () => {
    expect(montarGrafo(notas, arestas)).toHaveLength(notas.length);
  });

  it("mantém as coordenadas dentro de 0 a 1", () => {
    for (const no of montarGrafo(notas, arestas)) {
      expect(no.x).toBeGreaterThanOrEqual(0);
      expect(no.x).toBeLessThanOrEqual(1);
      expect(no.y).toBeGreaterThanOrEqual(0);
      expect(no.y).toBeLessThanOrEqual(1);
    }
  });

  it("é determinístico: o mesmo vault dá as mesmas posições", () => {
    expect(montarGrafo(notas, arestas)).toEqual(montarGrafo(notas, arestas));
  });

  it("dá peso maior a quem tem mais conexões", () => {
    const grafo = montarGrafo(notas, arestas);
    const ordenadas = [...notas].sort((a, b) => b.conexoes - a.conexoes);
    const maior = grafo.find((no) => no.id === ordenadas[0].id);
    const menor = grafo.find((no) => no.id === ordenadas[ordenadas.length - 1].id);
    expect(maior!.peso).toBeGreaterThan(menor!.peso);
  });
});

describe("vizinhosDe", () => {
  it("acha vizinhos nas duas direções da aresta", () => {
    const vizinhos = vizinhosDe("a", [{ de: "a", para: "b" }, { de: "c", para: "a" }]);
    expect(vizinhos.sort()).toEqual(["b", "c"]);
  });

  it("devolve lista vazia para um nó isolado", () => {
    expect(vizinhosDe("z", [{ de: "a", para: "b" }])).toEqual([]);
  });
});

describe("filtrarNotas", () => {
  it("filtra por título", () => {
    const resultado = filtrarNotas(notas, notas[0].titulo.slice(0, 5), null, arestas);
    expect(resultado.map((nota) => nota.id)).toContain(notas[0].id);
  });

  it("filtra por trecho do resumo", () => {
    const termo = notas[0].resumo.split(" ")[1];
    expect(filtrarNotas(notas, termo, null, arestas).length).toBeGreaterThan(0);
  });

  it("com nó selecionado, mostra só ele e os vizinhos", () => {
    const id = notas[0].id;
    const esperados = new Set([id, ...vizinhosDe(id, arestas)]);
    const resultado = filtrarNotas(notas, "", id, arestas);
    expect(new Set(resultado.map((nota) => nota.id))).toEqual(esperados);
  });
});
```

`mobile/src/funcionalidades/vault/estado.test.ts`:

```ts
import { useEstadoVault } from "./estado";

describe("useEstadoVault", () => {
  beforeEach(() => useEstadoVault.setState({ busca: "", noSelecionado: null, passoDaFolha: 1 }));

  it("guarda a busca", () => {
    useEstadoVault.getState().definirBusca("atômica");
    expect(useEstadoVault.getState().busca).toBe("atômica");
  });

  it("sobe a folha ao menos ao passo 1 ao selecionar um nó", () => {
    useEstadoVault.setState({ passoDaFolha: 0 });
    useEstadoVault.getState().selecionarNo("a");
    expect(useEstadoVault.getState().noSelecionado).toBe("a");
    expect(useEstadoVault.getState().passoDaFolha).toBe(1);
  });

  it("não abaixa a folha que já estava no passo 2", () => {
    useEstadoVault.setState({ passoDaFolha: 2 });
    useEstadoVault.getState().selecionarNo("a");
    expect(useEstadoVault.getState().passoDaFolha).toBe(2);
  });

  it("limpa a seleção", () => {
    useEstadoVault.getState().selecionarNo("a");
    useEstadoVault.getState().limparSelecao();
    expect(useEstadoVault.getState().noSelecionado).toBeNull();
  });

  it("cicla os três passos da folha", () => {
    useEstadoVault.setState({ passoDaFolha: 0 });
    useEstadoVault.getState().avancarPasso();
    expect(useEstadoVault.getState().passoDaFolha).toBe(1);
    useEstadoVault.getState().avancarPasso();
    expect(useEstadoVault.getState().passoDaFolha).toBe(2);
    useEstadoVault.getState().avancarPasso();
    expect(useEstadoVault.getState().passoDaFolha).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd mobile && npm test -- vault`
Expected: FAIL — `Cannot find module './grafoDoVault'`

- [ ] **Step 3: Escrever `grafoDoVault.ts`**

```ts
import type { Aresta, Nota, NoDoGrafo } from "@/dados/tipos";

const PESO_MINIMO = 0.6;
const PESO_MAXIMO = 1.8;

function embaralharEstavel(id: string): number {
  let acumulado = 0;
  for (let i = 0; i < id.length; i += 1) acumulado = (acumulado * 31 + id.charCodeAt(i)) % 100000;
  return acumulado / 100000;
}

export function montarGrafo(notas: Nota[], _arestas: Aresta[]): NoDoGrafo[] {
  const conexoes = notas.map((nota) => nota.conexoes);
  const menor = Math.min(...conexoes);
  const maior = Math.max(...conexoes);
  const amplitude = maior - menor || 1;

  return notas.map((nota, indice) => {
    const angulo = (indice / notas.length) * Math.PI * 2;
    const distancia = 0.2 + embaralharEstavel(nota.id) * 0.3;

    return {
      id: nota.id,
      titulo: nota.titulo,
      x: 0.5 + Math.cos(angulo) * distancia,
      y: 0.5 + Math.sin(angulo) * distancia,
      peso: PESO_MINIMO + ((nota.conexoes - menor) / amplitude) * (PESO_MAXIMO - PESO_MINIMO),
    };
  });
}

export function vizinhosDe(id: string, arestas: Aresta[]): string[] {
  const vizinhos = new Set<string>();
  for (const aresta of arestas) {
    if (aresta.de === id) vizinhos.add(aresta.para);
    if (aresta.para === id) vizinhos.add(aresta.de);
  }
  return [...vizinhos];
}

export function filtrarNotas(notas: Nota[], busca: string, noSelecionado: string | null, arestas: Aresta[]): Nota[] {
  const base =
    noSelecionado === null
      ? notas
      : (() => {
          const permitidos = new Set([noSelecionado, ...vizinhosDe(noSelecionado, arestas)]);
          return notas.filter((nota) => permitidos.has(nota.id));
        })();

  const termo = busca.trim().toLowerCase();
  if (termo.length === 0) return base;

  return base.filter(
    (nota) => nota.titulo.toLowerCase().includes(termo) || nota.resumo.toLowerCase().includes(termo),
  );
}
```

Layout em círculo com raio embaralhado de forma estável pelo id: sem motor de física, determinístico, e o handoff é explícito que "posições fixas + deriva senoidal bastam".

- [ ] **Step 4: Escrever `estado.ts`**

```ts
import { create } from "zustand";

export type PassoDaFolha = 0 | 1 | 2;

type EstadoVault = {
  busca: string;
  noSelecionado: string | null;
  passoDaFolha: PassoDaFolha;
  definirBusca: (texto: string) => void;
  selecionarNo: (id: string | null) => void;
  limparSelecao: () => void;
  avancarPasso: () => void;
};

export const useEstadoVault = create<EstadoVault>((set) => ({
  busca: "",
  noSelecionado: null,
  passoDaFolha: 1,

  definirBusca: (texto) => set({ busca: texto }),

  selecionarNo: (id) =>
    set((estado) => ({
      noSelecionado: id,
      passoDaFolha: id === null ? estado.passoDaFolha : (Math.max(1, estado.passoDaFolha) as PassoDaFolha),
    })),

  limparSelecao: () => set({ noSelecionado: null }),

  avancarPasso: () => set((estado) => ({ passoDaFolha: (((estado.passoDaFolha + 1) % 3) as PassoDaFolha) })),
}));
```

- [ ] **Step 5: Rodar os testes de lógica e confirmar que passam**

Run: `cd mobile && npm test -- vault`
Expected: PASS, 14 testes

- [ ] **Step 6: Escrever o teste de tela que falha**

`mobile/src/funcionalidades/vault/TelaNota.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { ProvedorDeServicos } from "@/servicos";
import { notas } from "@/dados/fixtures/notas";
import { useEstadoVault } from "./estado";
import { TelaNota } from "./TelaNota";

const push = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push, replace: jest.fn() }) }));

function renderizar() {
  return render(
    <ProvedorDeTema>
      <ProvedorDeServicos>
        <TelaNota />
      </ProvedorDeServicos>
    </ProvedorDeTema>,
  );
}

describe("TelaNota", () => {
  beforeEach(() => {
    push.mockClear();
    useEstadoVault.setState({ busca: "", noSelecionado: null, passoDaFolha: 1 });
  });

  it("mostra a contagem de nós no chip de contexto", async () => {
    renderizar();
    expect(await screen.findByText(`${notas.length} nós`)).toBeOnTheScreen();
  });

  it("mostra o escopo como vault inteiro quando não há seleção", async () => {
    renderizar();
    expect(await screen.findByText("vault inteiro")).toBeOnTheScreen();
  });

  it("lista as notas recentes", async () => {
    renderizar();
    expect(await screen.findByText("NOTAS RECENTES")).toBeOnTheScreen();
  });

  it("filtra a lista pela busca", async () => {
    renderizar();
    await screen.findByText(notas[0].titulo);
    fireEvent.changeText(screen.getByPlaceholderText("Buscar no vault..."), notas[0].titulo);
    await waitFor(() => expect(screen.queryByText(notas[1].titulo)).toBeNull());
    expect(screen.getByText(notas[0].titulo)).toBeOnTheScreen();
  });

  it("troca a sobrancelha e o escopo ao selecionar um nó", async () => {
    renderizar();
    fireEvent.press(await screen.findByTestId(`alvo-do-no-${notas[0].id}`));
    expect(await screen.findByText("NOTAS CONECTADAS")).toBeOnTheScreen();
    expect(screen.getByText(`vizinhança de '${notas[0].titulo}'`)).toBeOnTheScreen();
  });

  it("mostra Nova Nota sem seleção e Abrir Nota com seleção", async () => {
    renderizar();
    expect(await screen.findByRole("button", { name: "+ Nova Nota" })).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId(`alvo-do-no-${notas[0].id}`));
    expect(await screen.findByRole("button", { name: "Abrir Nota" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Perguntar" })).toBeOnTheScreen();
  });

  it("abre o editor pelo botão Abrir Nota", async () => {
    renderizar();
    fireEvent.press(await screen.findByTestId(`alvo-do-no-${notas[0].id}`));
    fireEvent.press(await screen.findByRole("button", { name: "Abrir Nota" }));
    expect(push).toHaveBeenCalledWith(`/editor/${notas[0].id}`);
  });

  it("avança o passo da folha ao tocar na alça", async () => {
    renderizar();
    fireEvent.press(await screen.findByRole("button", { name: "Ajustar altura da lista" }));
    expect(useEstadoVault.getState().passoDaFolha).toBe(2);
  });
});
```

- [ ] **Step 7: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- TelaNota`
Expected: FAIL — `Cannot find module './TelaNota'`

- [ ] **Step 8: Escrever `ChipsDeContexto.tsx` e `CartaoDeNota.tsx`**

```tsx
// componentes/ChipsDeContexto.tsx
import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "@/compartilhado/ui";

function Pilula({ texto }: { texto: string }) {
  const { cores, tipografia, raios } = useTema();
  return (
    <Vidro nivel="barra" style={{ borderRadius: raios.pill, borderWidth: 1, borderColor: cores.fioDeCabelo, paddingHorizontal: 9, paddingVertical: 4, overflow: "hidden" }}>
      <Text style={[tipografia.legenda, { fontSize: 11, lineHeight: 14, color: cores.contorno }]}>{texto}</Text>
    </Vidro>
  );
}

export function ChipsDeContexto({ escopo, contagem }: { escopo: string; contagem: string }) {
  const { espacamento } = useTema();
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: espacamento.md, left: espacamento.gutter, right: espacamento.gutter, flexDirection: "row", justifyContent: "space-between" }}>
      <Pilula texto={escopo} />
      <Pilula texto={contagem} />
    </View>
  );
}
```

```tsx
// componentes/CartaoDeNota.tsx
import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Cartao, Chip, Icone } from "@/compartilhado/ui";
import type { Nota } from "@/dados/tipos";

export function CartaoDeNota({ nota, selecionado, aoTocar }: { nota: Nota; selecionado: boolean; aoTocar: () => void }) {
  const { cores, tipografia, espacamento } = useTema();

  return (
    <Cartao aoTocar={aoTocar} selecionado={selecionado}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.sm }}>
        <Text style={[tipografia.titleSm, { color: cores.primaria, flex: 1 }]} numberOfLines={1}>
          {nota.titulo}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icone nome="hub" tamanho={14} cor={cores.contorno} />
          <Text style={[tipografia.legenda, { color: cores.contorno }]}>{nota.conexoes}</Text>
        </View>
      </View>
      <Text style={[tipografia.legenda, { color: cores.textoSuave, marginTop: espacamento.xs }]} numberOfLines={2}>
        {nota.resumo}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: espacamento.sm }}>
        <Chip rotulo={nota.pasta} />
        <Text style={[tipografia.legenda, { color: cores.contorno }]}>{nota.editadaEm}</Text>
      </View>
    </Cartao>
  );
}
```

- [ ] **Step 9: Escrever `FolhaDeNotas.tsx`**

```tsx
import { useEffect } from "react";
import { FlatList, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTema } from "@/compartilhado/tema";
import { Botao, CampoDeBusca, Sobrancelha, Vidro } from "@/compartilhado/ui";
import type { Nota } from "@/dados/tipos";
import type { PassoDaFolha } from "../estado";
import { CartaoDeNota } from "./CartaoDeNota";

const FRACOES: Record<PassoDaFolha, number> = { 0: 0.34, 1: 0.58, 2: 0.8 };

type Props = {
  notas: Nota[];
  busca: string;
  aoBuscar: (texto: string) => void;
  noSelecionado: string | null;
  aoSelecionarNota: (id: string) => void;
  aoLimparSelecao: () => void;
  passo: PassoDaFolha;
  aoAvancarPasso: () => void;
  alturaDisponivel: number;
  aoAbrirNota: () => void;
  aoPerguntar: () => void;
};

export function FolhaDeNotas(props: Props) {
  const { cores, espacamento, raios, sombras, movimento } = useTema();
  const altura = useSharedValue(props.alturaDisponivel * FRACOES[props.passo]);

  useEffect(() => {
    altura.value = withTiming(props.alturaDisponivel * FRACOES[props.passo], {
      duration: movimento.duracaoLenta,
      easing: movimento.curvaPadrao,
    });
  }, [props.passo, props.alturaDisponivel, altura, movimento]);

  const estilo = useAnimatedStyle(() => ({ height: altura.value }));

  return (
    <Animated.View style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, estilo]}>
      <Vidro
        nivel="folha"
        style={[
          { flex: 1, borderTopLeftRadius: raios.folha, borderTopRightRadius: raios.folha, borderWidth: 1, borderBottomWidth: 0, borderColor: cores.fioDeCabelo, overflow: "hidden" },
          sombras.grande,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajustar altura da lista"
          onPress={props.aoAvancarPasso}
          style={{ minHeight: 24, paddingTop: espacamento.sm, paddingBottom: espacamento.xs, alignItems: "center" }}
        >
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: cores.contorno, opacity: 0.45 }} />
        </Pressable>

        <View style={{ paddingHorizontal: espacamento.gutter }}>
          <CampoDeBusca valor={props.busca} aoMudar={props.aoBuscar} placeholder="Buscar no vault..." />
        </View>

        <Sobrancelha
          texto={props.noSelecionado ? "NOTAS CONECTADAS" : "NOTAS RECENTES"}
          acao={props.noSelecionado ? { rotulo: "limpar", icone: "close", aoTocar: props.aoLimparSelecao } : undefined}
        />

        <FlatList
          data={props.notas}
          keyExtractor={(nota) => nota.id}
          contentContainerStyle={{ paddingHorizontal: espacamento.md, gap: espacamento.sm }}
          renderItem={({ item }) => (
            <CartaoDeNota nota={item} selecionado={item.id === props.noSelecionado} aoTocar={() => props.aoSelecionarNota(item.id)} />
          )}
        />

        <View style={{ flexDirection: "row", gap: espacamento.sm, paddingHorizontal: espacamento.md, paddingBottom: espacamento.md }}>
          {props.noSelecionado ? (
            <>
              <Botao variante="primario" rotulo="Abrir Nota" icone="description" aoTocar={props.aoAbrirNota} larguraTotal />
              <Botao variante="outline" rotulo="Perguntar" icone="forum" aoTocar={props.aoPerguntar} />
            </>
          ) : (
            <Botao variante="primario" rotulo="+ Nova Nota" aoTocar={props.aoAbrirNota} larguraTotal />
          )}
        </View>
      </Vidro>
    </Animated.View>
  );
}
```

- [ ] **Step 10: Escrever `TelaNota.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { useServicos } from "@/servicos";
import { CampoDeGrafo } from "@/compartilhado/grafo";
import { useEstadoGrafo } from "@/funcionalidades/grafo/estado";
import { useEstadoChat } from "@/funcionalidades/chat/estado";
import { useEstadoConta } from "@/funcionalidades/conta/estado";
import type { Aresta, Nota } from "@/dados/tipos";
import { filtrarNotas, montarGrafo, vizinhosDe } from "./grafoDoVault";
import { useEstadoVault } from "./estado";
import { FolhaDeNotas } from "./componentes/FolhaDeNotas";
import { ChipsDeContexto } from "./componentes/ChipsDeContexto";

export function TelaNota() {
  const router = useRouter();
  const { vault } = useServicos();
  const { busca, noSelecionado, passoDaFolha, definirBusca, selecionarNo, limparSelecao, avancarPasso } = useEstadoVault();
  const pulso = useEstadoGrafo((estado) => estado.pulso);
  const crescer = useEstadoGrafo((estado) => estado.crescer);
  const { interruptores, densidade } = useEstadoConta();
  const preencherRascunho = useEstadoChat((estado) => estado.preencherRascunho);

  const [notas, setNotas] = useState<Nota[]>([]);
  const [arestas, setArestas] = useState<Aresta[]>([]);
  const [alturaDisponivel, setAlturaDisponivel] = useState(0);

  useEffect(() => {
    vault.listarNotas().then(setNotas);
    vault.listarArestas().then(setArestas);
  }, [vault]);

  const nosDoGrafo = useMemo(() => montarGrafo(notas, arestas), [notas, arestas]);
  const visiveis = useMemo(() => filtrarNotas(notas, busca, noSelecionado, arestas), [notas, busca, noSelecionado, arestas]);
  const selecionada = notas.find((nota) => nota.id === noSelecionado) ?? null;

  const escopo = selecionada ? `vizinhança de '${selecionada.titulo}'` : "vault inteiro";
  const contagem = selecionada ? `${vizinhosDe(selecionada.id, arestas).length} conexões` : `${notas.length} nós`;

  return (
    <View style={{ flex: 1 }} onLayout={(evento) => setAlturaDisponivel(evento.nativeEvent.layout.height)}>
      <CampoDeGrafo
        modo="interativo"
        densidade={densidade}
        ligado={interruptores.grafo}
        particulasLigadas={interruptores.particulas}
        pulso={pulso}
        crescer={crescer}
        nos={nosDoGrafo}
        arestas={arestas}
        noSelecionado={noSelecionado}
        aoSelecionarNo={selecionarNo}
      />

      <ChipsDeContexto escopo={escopo} contagem={contagem} />

      <FolhaDeNotas
        notas={visiveis}
        busca={busca}
        aoBuscar={definirBusca}
        noSelecionado={noSelecionado}
        aoSelecionarNota={selecionarNo}
        aoLimparSelecao={limparSelecao}
        passo={passoDaFolha}
        aoAvancarPasso={avancarPasso}
        alturaDisponivel={alturaDisponivel}
        aoAbrirNota={() => router.push(selecionada ? `/editor/${selecionada.id}` : "/editor/nova")}
        aoPerguntar={() => {
          if (!selecionada) return;
          preencherRascunho(selecionada.titulo);
          limparSelecao();
          router.replace("/bimo");
        }}
      />
    </View>
  );
}
```

`mobile/app/(app)/nota.tsx`:

```tsx
import { TelaNota } from "@/funcionalidades/vault/TelaNota";

export default function RotaNota() {
  return <TelaNota />;
}
```

- [ ] **Step 11: Rodar os testes e confirmar que passam**

Run: `cd mobile && npm test -- vault`
Expected: PASS, 22 testes

- [ ] **Step 12: Conferir no Expo Go**

Run: `cd mobile && npx expo start`
Expected: no destino Nota, o grafo ocupa a tela toda com a folha por cima em 58%. Tocar na alça vai para 80%, depois 34%, depois volta. Tocar num nó troca os chips para a vizinhança, filtra a lista, sobe a folha e troca os botões do rodapé. Arrastar dá pan; pinça dá zoom.

- [ ] **Step 13: Commit**

```bash
git add mobile/src/funcionalidades/vault mobile/app/(app)/nota.tsx
git commit -m "feat(mobile): tela Nota com grafo em tela cheia e folha de notas em tres passos"
```

---

## Task 14: Editor de nota

**Files:**
- Create: `mobile/src/funcionalidades/editor/estado.ts`, `componentes/BarraDoEditor.tsx`, `componentes/MenuDeAcoesDaIA.tsx`, `componentes/CartaoDeSugestao.tsx`, `Editor.tsx`
- Create: `mobile/app/(app)/editor/[id].tsx`
- Modify: `mobile/app/(app)/_layout.tsx` (registrar a rota como modal)
- Test: `mobile/src/funcionalidades/editor/estado.test.ts`, `Editor.test.tsx`

**Interfaces:**
- Consumes: `useServicos()`, `useEstadoGrafo`, `Sheet`, componentes de UI
- Produces: `useEstadoEditor` com `{ titulo, texto, tags, menuIA, sugestao, carregar(nota), digitarTexto(texto, aoCrescer), rodarAcao(ia, tipo, nota, aoPulsar), inserirSugestao(aoCrescer), descartarSugestao() }`

- [ ] **Step 1: Escrever o teste de estado que falha**

`mobile/src/funcionalidades/editor/estado.test.ts`:

```ts
import { useEstadoEditor } from "./estado";
import { notas } from "@/dados/fixtures/notas";
import type { ServicoIA } from "@/servicos";

const ia: ServicoIA = {
  conversar: async () => ({ texto: "", cartoes: [] }),
  acaoNaNota: async (tipo) =>
    tipo === "tags"
      ? { tipo, rotulo: "Extrair tags", texto: "Três tags:", tags: ["#novo", ...notas[0].tags] }
      : { tipo, rotulo: "Sugerir links", texto: "Texto sugerido." },
};

describe("useEstadoEditor", () => {
  beforeEach(() => useEstadoEditor.getState().carregar(notas[0]));

  it("carrega título, corpo e tags da nota", () => {
    const estado = useEstadoEditor.getState();
    expect(estado.titulo).toBe(notas[0].titulo);
    expect(estado.texto).toBe(notas[0].corpo);
    expect(estado.tags).toEqual(notas[0].tags);
  });

  it("acende um nó novo a cada 18 caracteres digitados", () => {
    const aoCrescer = jest.fn();
    const base = notas[0].corpo;
    useEstadoEditor.getState().digitarTexto(base + "a".repeat(17), aoCrescer);
    expect(aoCrescer).not.toHaveBeenCalled();
    useEstadoEditor.getState().digitarTexto(base + "a".repeat(18), aoCrescer);
    expect(aoCrescer).toHaveBeenCalledTimes(1);
  });

  it("guarda a sugestão, fecha o menu e pulsa o grafo ao rodar uma ação", async () => {
    const aoPulsar = jest.fn();
    useEstadoEditor.setState({ menuIA: true });
    await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], aoPulsar);
    expect(useEstadoEditor.getState().sugestao?.tipo).toBe("links");
    expect(useEstadoEditor.getState().menuIA).toBe(false);
    expect(aoPulsar).toHaveBeenCalledTimes(1);
  });

  it("anexa o texto da sugestão ao corpo e acende um nó", async () => {
    const aoCrescer = jest.fn();
    await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], jest.fn());
    useEstadoEditor.getState().inserirSugestao(aoCrescer);
    expect(useEstadoEditor.getState().texto).toContain("Texto sugerido.");
    expect(useEstadoEditor.getState().sugestao).toBeNull();
    expect(aoCrescer).toHaveBeenCalledTimes(1);
  });

  it("mescla as tags sem duplicar", async () => {
    await useEstadoEditor.getState().rodarAcao(ia, "tags", notas[0], jest.fn());
    useEstadoEditor.getState().inserirSugestao(jest.fn());
    const tags = useEstadoEditor.getState().tags;
    expect(tags).toContain("#novo");
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("descartar fecha o cartão sem mexer no corpo", async () => {
    await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], jest.fn());
    const antes = useEstadoEditor.getState().texto;
    useEstadoEditor.getState().descartarSugestao();
    expect(useEstadoEditor.getState().sugestao).toBeNull();
    expect(useEstadoEditor.getState().texto).toBe(antes);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- editor/estado`
Expected: FAIL — `Cannot find module './estado'`

- [ ] **Step 3: Escrever `estado.ts`**

```ts
import { create } from "zustand";
import type { Nota, Sugestao, TipoDeAcaoIA } from "@/dados/tipos";
import type { ServicoIA } from "@/servicos";

const CARACTERES_POR_NO = 18;

type EstadoEditor = {
  titulo: string;
  texto: string;
  tags: string[];
  menuIA: boolean;
  sugestao: Sugestao | null;
  carregadosNoUltimoNo: number;
  carregar: (nota: Nota | null) => void;
  definirTitulo: (titulo: string) => void;
  digitarTexto: (texto: string, aoCrescer: () => void) => void;
  abrirMenu: () => void;
  fecharMenu: () => void;
  rodarAcao: (ia: ServicoIA, tipo: TipoDeAcaoIA, nota: Nota, aoPulsar: () => void) => Promise<void>;
  inserirSugestao: (aoCrescer: () => void) => void;
  descartarSugestao: () => void;
};

export const useEstadoEditor = create<EstadoEditor>((set, get) => ({
  titulo: "",
  texto: "",
  tags: [],
  menuIA: false,
  sugestao: null,
  carregadosNoUltimoNo: 0,

  carregar: (nota) =>
    set({
      titulo: nota?.titulo ?? "",
      texto: nota?.corpo ?? "",
      tags: nota?.tags ?? [],
      menuIA: false,
      sugestao: null,
      carregadosNoUltimoNo: nota?.corpo.length ?? 0,
    }),

  definirTitulo: (titulo) => set({ titulo }),

  digitarTexto: (texto, aoCrescer) => {
    const { carregadosNoUltimoNo } = get();
    const cresceu = texto.length - carregadosNoUltimoNo >= CARACTERES_POR_NO;
    set({ texto, carregadosNoUltimoNo: cresceu ? texto.length : carregadosNoUltimoNo });
    if (cresceu) aoCrescer();
  },

  abrirMenu: () => set({ menuIA: true }),
  fecharMenu: () => set({ menuIA: false }),

  rodarAcao: async (ia, tipo, nota, aoPulsar) => {
    set({ menuIA: false });
    aoPulsar();
    const sugestao = await ia.acaoNaNota(tipo, nota);
    set({ sugestao });
  },

  inserirSugestao: (aoCrescer) => {
    const { sugestao, texto, tags } = get();
    if (!sugestao) return;

    if (sugestao.tags) {
      set({ tags: [...new Set([...tags, ...sugestao.tags])], sugestao: null });
    } else {
      set({ texto: `${texto}\n\n${sugestao.texto}`, sugestao: null });
    }

    aoCrescer();
  },

  descartarSugestao: () => set({ sugestao: null }),
}));
```

`rodarAcao` chama `aoPulsar` antes do `await` de propósito: o handoff diz que a rajada de partículas acompanha o pensamento, não a resposta.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd mobile && npm test -- editor/estado`
Expected: PASS, 6 testes

- [ ] **Step 5: Escrever o teste de tela que falha**

`mobile/src/funcionalidades/editor/Editor.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { ProvedorDeServicos } from "@/servicos";
import { notas } from "@/dados/fixtures/notas";
import { Editor } from "./Editor";

const back = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back, push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: notas[0].id }),
}));

function renderizar() {
  return render(
    <ProvedorDeTema>
      <ProvedorDeServicos>
        <Editor />
      </ProvedorDeServicos>
    </ProvedorDeTema>,
  );
}

describe("Editor", () => {
  beforeEach(() => back.mockClear());

  it("mostra o título e a pasta da nota", async () => {
    renderizar();
    expect(await screen.findByDisplayValue(notas[0].titulo)).toBeOnTheScreen();
    expect(screen.getByText(notas[0].pasta)).toBeOnTheScreen();
  });

  it("volta pelo arrow_back", async () => {
    renderizar();
    fireEvent.press(await screen.findByRole("button", { name: "Voltar" }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("abre o menu de ações da IA com as cinco opções", async () => {
    renderizar();
    fireEvent.press(await screen.findByRole("button", { name: "Bimo" }));
    expect(await screen.findByText("BIMO NESTA NOTA")).toBeOnTheScreen();
    for (const rotulo of ["Sugerir links", "Resumir a nota", "Extrair tags", "Continuar escrevendo", "Perguntar sobre a nota"]) {
      expect(screen.getByRole("button", { name: rotulo })).toBeOnTheScreen();
    }
  });

  it("mostra o cartão de sugestão depois de rodar uma ação", async () => {
    renderizar();
    fireEvent.press(await screen.findByRole("button", { name: "Bimo" }));
    fireEvent.press(await screen.findByRole("button", { name: "Resumir a nota" }));
    expect(await screen.findByText(/Sugestão do Bimo/)).toBeOnTheScreen();
  });

  it("insere a sugestão no corpo", async () => {
    renderizar();
    fireEvent.press(await screen.findByRole("button", { name: "Bimo" }));
    fireEvent.press(await screen.findByRole("button", { name: "Continuar escrevendo" }));
    fireEvent.press(await screen.findByRole("button", { name: "Inserir" }));
    await waitFor(() => expect(screen.queryByText(/Sugestão do Bimo/)).toBeNull());
  });

  it("mostra o rodapé de status do grafo", async () => {
    renderizar();
    expect(await screen.findByText("O grafo acompanha o que você escreve")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- Editor`
Expected: FAIL — `Cannot find module './Editor'`

- [ ] **Step 7: Escrever os componentes do editor**

```tsx
// componentes/BarraDoEditor.tsx
import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone } from "@/compartilhado/ui";

type Props = { pasta: string; aoVoltar: () => void; aoAbrirIA: () => void; aoFechar: () => void };

export function BarraDoEditor({ pasta, aoVoltar, aoAbrirIA, aoFechar }: Props) {
  const { cores, tipografia, espacamento, raios } = useTema();

  return (
    <View style={{ minHeight: espacamento.alturaCabecalho, flexDirection: "row", alignItems: "center", gap: espacamento.sm, paddingHorizontal: espacamento.md, borderBottomWidth: 1, borderBottomColor: cores.fioDeCabelo, backgroundColor: cores.superficie }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={aoVoltar} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }} hitSlop={8}>
        <Icone nome="arrow_back" tamanho={22} cor={cores.sobreSuperficie} />
      </Pressable>

      <Text style={[tipografia.titleSm, { color: cores.textoSuave, flex: 1 }]} numberOfLines={1}>
        {pasta}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bimo"
        onPress={aoAbrirIA}
        style={{ minHeight: 36, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: espacamento.md, borderRadius: raios.pill, borderWidth: 1, borderColor: cores.fioDeCabelo, backgroundColor: cores.superficieContainerBaixa }}
      >
        <Icone nome="psychology" tamanho={18} cor={cores.primaria} />
        <Text style={[tipografia.rotuloSm, { color: cores.primaria }]}>Bimo</Text>
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={aoFechar} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }} hitSlop={8}>
        <Icone nome="close" tamanho={18} cor={cores.contorno} />
      </Pressable>
    </View>
  );
}
```

```tsx
// componentes/MenuDeAcoesDaIA.tsx
import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone, Sheet, type NomeDeIcone } from "@/compartilhado/ui";
import type { TipoDeAcaoIA } from "@/dados/tipos";

const ACOES: { tipo: TipoDeAcaoIA; rotulo: string; icone: NomeDeIcone }[] = [
  { tipo: "links", rotulo: "Sugerir links", icone: "hub" },
  { tipo: "resumo", rotulo: "Resumir a nota", icone: "description" },
  { tipo: "tags", rotulo: "Extrair tags", icone: "sell" },
  { tipo: "continuar", rotulo: "Continuar escrevendo", icone: "edit" },
  { tipo: "perguntar", rotulo: "Perguntar sobre a nota", icone: "forum" },
];

export function MenuDeAcoesDaIA({ aberto, aoFechar, aoEscolher }: { aberto: boolean; aoFechar: () => void; aoEscolher: (tipo: TipoDeAcaoIA) => void }) {
  const { cores, tipografia, espacamento, raios } = useTema();

  return (
    <Sheet aberta={aberto} aoFechar={aoFechar} sobrancelha="BIMO NESTA NOTA">
      <View>
        {ACOES.map((acao) => (
          <Pressable
            key={acao.tipo}
            accessibilityRole="button"
            accessibilityLabel={acao.rotulo}
            onPress={() => aoEscolher(acao.tipo)}
            style={{ minHeight: espacamento.alvoDeToque, flexDirection: "row", alignItems: "center", gap: espacamento.md, paddingHorizontal: espacamento.md, paddingVertical: espacamento.sm, borderRadius: raios.cartao }}
          >
            <Icone nome={acao.icone} tamanho={20} cor={cores.primaria} />
            <Text style={[tipografia.corpo, { color: cores.sobreSuperficie }]}>{acao.rotulo}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
```

```tsx
// componentes/CartaoDeSugestao.tsx
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTema } from "@/compartilhado/tema";
import { Botao, Chip, Icone } from "@/compartilhado/ui";
import type { Sugestao } from "@/dados/tipos";

export function CartaoDeSugestao({ sugestao, aoInserir, aoDescartar }: { sugestao: Sugestao; aoInserir: () => void; aoDescartar: () => void }) {
  const { cores, tipografia, espacamento, raios } = useTema();

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={{ marginTop: espacamento.gutter, padding: espacamento.md, borderRadius: raios.cartao, borderWidth: 1, borderStyle: "dashed", borderColor: cores.primaria, backgroundColor: cores.primariaFixa }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icone nome="psychology" tamanho={16} cor={cores.primaria} />
        <Text style={[tipografia.rotuloSm, { color: cores.sobrePrimariaFixaVariante }]}>{`Sugestão do Bimo · ${sugestao.rotulo}`}</Text>
      </View>

      <Text style={[tipografia.corpoRelaxado, { color: cores.sobreSuperficie, marginTop: espacamento.sm }]}>{sugestao.texto}</Text>

      {sugestao.tags ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espacamento.sm, marginTop: espacamento.sm }}>
          {sugestao.tags.map((tag) => (
            <Chip key={tag} rotulo={tag} destacado />
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: espacamento.sm, marginTop: espacamento.md }}>
        <Botao variante="primario" rotulo="Inserir" icone="add" aoTocar={aoInserir} />
        <Botao variante="ghost" rotulo="Descartar" aoTocar={aoDescartar} />
      </View>
    </Animated.View>
  );
}
```

- [ ] **Step 8: Escrever `Editor.tsx` e a rota**

```tsx
import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { useServicos } from "@/servicos";
import { Chip, Icone } from "@/compartilhado/ui";
import { useEstadoGrafo } from "@/funcionalidades/grafo/estado";
import type { Nota } from "@/dados/tipos";
import { BarraDoEditor } from "./componentes/BarraDoEditor";
import { MenuDeAcoesDaIA } from "./componentes/MenuDeAcoesDaIA";
import { CartaoDeSugestao } from "./componentes/CartaoDeSugestao";
import { useEstadoEditor } from "./estado";

const NOTA_NOVA: Nota = { id: "nova", titulo: "", pasta: "Zettelkasten", tags: [], corpo: "", resumo: "", editadaEm: "", conexoes: 0 };

export function Editor() {
  const { cores, tipografia, espacamento } = useTema();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vault, ia } = useServicos();
  const pulsar = useEstadoGrafo((estado) => estado.pulsar);
  const crescerNo = useEstadoGrafo((estado) => estado.crescerNo);
  const editor = useEstadoEditor();
  const [nota, setNota] = useState<Nota>(NOTA_NOVA);
  const [nosNovos, setNosNovos] = useState(0);

  useEffect(() => {
    if (id === "nova") {
      setNota(NOTA_NOVA);
      editor.carregar(NOTA_NOVA);
      return;
    }
    vault.obterNota(id).then((encontrada) => {
      setNota(encontrada);
      editor.carregar(encontrada);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, vault]);

  function acenderNo() {
    crescerNo();
    setNosNovos((total) => total + 1);
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.superficie }}>
      <BarraDoEditor
        pasta={nota.pasta}
        aoVoltar={() => router.back()}
        aoFechar={() => router.back()}
        aoAbrirIA={editor.abrirMenu}
      />

      <ScrollView contentContainerStyle={{ padding: espacamento.lg }}>
        <TextInput
          value={editor.titulo}
          onChangeText={editor.definirTitulo}
          placeholder="Título da nota"
          placeholderTextColor={cores.textoPlaceholder}
          style={[tipografia.displayMd, { color: cores.primaria, borderBottomWidth: 1, borderBottomColor: cores.fioDeCabelo, paddingBottom: espacamento.sm, marginBottom: espacamento.md }]}
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espacamento.sm, marginBottom: espacamento.lg }}>
          {editor.tags.map((tag) => (
            <Chip key={tag} rotulo={tag} />
          ))}
        </View>

        <TextInput
          value={editor.texto}
          onChangeText={(texto) => editor.digitarTexto(texto, acenderNo)}
          multiline
          textAlignVertical="top"
          style={[tipografia.corpoRelaxado, { color: cores.sobreSuperficie, minHeight: 240 }]}
        />

        {editor.sugestao ? (
          <CartaoDeSugestao sugestao={editor.sugestao} aoInserir={() => editor.inserirSugestao(acenderNo)} aoDescartar={editor.descartarSugestao} />
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.sm, marginTop: espacamento.xl, paddingTop: espacamento.md, borderTopWidth: 1, borderTopColor: cores.fioDeCabelo }}>
          <Icone nome="hub" tamanho={16} cor={cores.contorno} />
          <Text style={[tipografia.legenda, { color: cores.contorno }]}>
            {nosNovos === 0 ? "O grafo acompanha o que você escreve" : `${nosNovos} ${nosNovos === 1 ? "nó novo acendeu" : "nós novos acenderam"} no grafo`}
          </Text>
        </View>
      </ScrollView>

      <MenuDeAcoesDaIA
        aberto={editor.menuIA}
        aoFechar={editor.fecharMenu}
        aoEscolher={(tipo) => editor.rodarAcao(ia, tipo, nota, pulsar)}
      />
    </View>
  );
}
```

`mobile/app/(app)/editor/[id].tsx`:

```tsx
import { Editor } from "@/funcionalidades/editor/Editor";

export default function RotaEditor() {
  return <Editor />;
}
```

Trocar o `<Slot />` de `app/(app)/_layout.tsx` por um `<Stack>` para poder declarar a apresentação de cada rota:

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="bimo" />
  <Stack.Screen name="nota" />
  <Stack.Screen name="editor/[id]" options={{ presentation: "fullScreenModal" }} />
  <Stack.Screen name="perfil" options={{ presentation: "formSheet" }} />
  <Stack.Screen name="configuracoes" options={{ presentation: "formSheet" }} />
</Stack>
```

- [ ] **Step 9: Rodar os testes e confirmar que passam**

Run: `cd mobile && npm test -- editor`
Expected: PASS, 12 testes

- [ ] **Step 10: Conferir no Expo Go**

Run: `cd mobile && npx expo start`
Expected: tocar num cartão do chat ou em "Abrir Nota" abre o editor em tela cheia. O botão Bimo abre o menu com as cinco ações; escolher uma dispara partículas no grafo e mostra o cartão tracejado. "Inserir" anexa ao corpo e o rodapé passa a contar nós novos. Digitar no corpo também acende nós.

- [ ] **Step 11: Commit**

```bash
git add mobile/src/funcionalidades/editor "mobile/app/(app)"
git commit -m "feat(mobile): editor de nota com menu de acoes da IA e cartao de sugestao"
```

---

## Task 15: Conta — menu, perfil e configurações

**Files:**
- Create: `mobile/src/funcionalidades/conta/estado.ts`, `componentes/MenuDeConta.tsx`, `componentes/LinhaDeConfiguracao.tsx`, `Perfil.tsx`, `Configuracoes.tsx`
- Create: `mobile/app/(app)/perfil.tsx`, `mobile/app/(app)/configuracoes.tsx`
- Modify: `mobile/app/(app)/_layout.tsx`, `mobile/src/funcionalidades/chat/Chat.tsx`, `mobile/src/funcionalidades/vault/TelaNota.tsx`
- Test: `mobile/src/funcionalidades/conta/estado.test.ts`, `Configuracoes.test.tsx`, `Perfil.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `Interruptor`, `Pill`, componentes de UI
- Produces: `useEstadoConta` com `{ perfil, interruptores, densidade, definirPerfil, alternar(chave), definirDensidade(valor) }`

Esta task fecha as três referências pendentes a `useEstadoConta` deixadas nas tasks 11 e 13.

- [ ] **Step 1: Escrever o teste de estado que falha**

`mobile/src/funcionalidades/conta/estado.test.ts`:

```ts
import { useEstadoConta } from "./estado";
import { perfil } from "@/dados/fixtures/perfil";

describe("useEstadoConta", () => {
  beforeEach(() =>
    useEstadoConta.setState({
      perfil,
      interruptores: { grafo: true, particulas: true, tagsAutomaticas: true, linksAutomaticos: false, somenteWifi: true },
      densidade: 60,
    }),
  );

  it("começa com os padrões do handoff", () => {
    const { interruptores } = useEstadoConta.getState();
    expect(interruptores.grafo).toBe(true);
    expect(interruptores.particulas).toBe(true);
    expect(interruptores.tagsAutomaticas).toBe(true);
    expect(interruptores.linksAutomaticos).toBe(false);
    expect(interruptores.somenteWifi).toBe(true);
  });

  it("alterna um interruptor sem mexer nos outros", () => {
    useEstadoConta.getState().alternar("linksAutomaticos");
    expect(useEstadoConta.getState().interruptores.linksAutomaticos).toBe(true);
    expect(useEstadoConta.getState().interruptores.grafo).toBe(true);
  });

  it("troca a densidade", () => {
    useEstadoConta.getState().definirDensidade(80);
    expect(useEstadoConta.getState().densidade).toBe(80);
  });

  it("edita o perfil", () => {
    useEstadoConta.getState().definirPerfil({ ...perfil, nome: "Marina A." });
    expect(useEstadoConta.getState().perfil.nome).toBe("Marina A.");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd mobile && npm test -- conta/estado`
Expected: FAIL — `Cannot find module './estado'`

- [ ] **Step 3: Escrever `estado.ts`**

```ts
import { create } from "zustand";
import type { Perfil } from "@/dados/tipos";
import { perfil as perfilInicial } from "@/dados/fixtures/perfil";

export type Interruptores = {
  grafo: boolean;
  particulas: boolean;
  tagsAutomaticas: boolean;
  linksAutomaticos: boolean;
  somenteWifi: boolean;
};

export type Densidade = 50 | 60 | 80;

type EstadoConta = {
  perfil: Perfil;
  interruptores: Interruptores;
  densidade: Densidade;
  definirPerfil: (perfil: Perfil) => void;
  alternar: (chave: keyof Interruptores) => void;
  definirDensidade: (densidade: Densidade) => void;
};

export const useEstadoConta = create<EstadoConta>((set) => ({
  perfil: perfilInicial,
  interruptores: { grafo: true, particulas: true, tagsAutomaticas: true, linksAutomaticos: false, somenteWifi: true },
  densidade: 60,

  definirPerfil: (perfil) => set({ perfil }),
  alternar: (chave) => set((estado) => ({ interruptores: { ...estado.interruptores, [chave]: !estado.interruptores[chave] } })),
  definirDensidade: (densidade) => set({ densidade }),
}));
```

O handoff usa 70/90/110; aqui é 50/60/80 pela decisão registrada na seção 2 do spec (limite do SVG). Os três presets ficam só neste arquivo.

- [ ] **Step 4: Escrever os testes de tela que falham**

`mobile/src/funcionalidades/conta/Configuracoes.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { useEstadoConta } from "./estado";
import { Configuracoes } from "./Configuracoes";

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));

function renderizar() {
  return render(
    <ProvedorDeTema>
      <Configuracoes />
    </ProvedorDeTema>,
  );
}

describe("Configuracoes", () => {
  it("mostra os três grupos do handoff", () => {
    renderizar();
    expect(screen.getByText("GRAFO DE FUNDO")).toBeOnTheScreen();
    expect(screen.getByText("INTELIGÊNCIA")).toBeOnTheScreen();
    expect(screen.getByText("SINCRONIZAÇÃO")).toBeOnTheScreen();
  });

  it("alterna um interruptor", () => {
    renderizar();
    const antes = useEstadoConta.getState().interruptores.linksAutomaticos;
    fireEvent.press(screen.getByRole("switch", { name: "Sugerir links enquanto escrevo" }));
    expect(useEstadoConta.getState().interruptores.linksAutomaticos).toBe(!antes);
  });

  it("troca a densidade e atualiza o hint", () => {
    renderizar();
    fireEvent.press(screen.getByRole("button", { name: "80" }));
    expect(useEstadoConta.getState().densidade).toBe(80);
    expect(screen.getByText("80 nós no campo de fundo")).toBeOnTheScreen();
  });

  it("mostra o status de sync e a versão", () => {
    renderizar();
    expect(screen.getByText("Sincronizado")).toBeOnTheScreen();
    expect(screen.getByText("Bimo 1.4.0 · vault local com sincronização")).toBeOnTheScreen();
  });
});
```

`mobile/src/funcionalidades/conta/Perfil.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { notas } from "@/dados/fixtures/notas";
import { useEstadoConta } from "./estado";
import { Perfil } from "./Perfil";

const back = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back }) }));

function renderizar() {
  return render(
    <ProvedorDeTema>
      <Perfil />
    </ProvedorDeTema>,
  );
}

describe("Perfil", () => {
  it("mostra os três cartões de estatística", async () => {
    renderizar();
    expect(await screen.findByText("Notas")).toBeOnTheScreen();
    expect(screen.getByText("Conexões")).toBeOnTheScreen();
    expect(screen.getByText("Pastas")).toBeOnTheScreen();
    expect(screen.getByText(String(notas.length))).toBeOnTheScreen();
  });

  it("edita o nome e salva", () => {
    renderizar();
    fireEvent.changeText(screen.getByLabelText("Nome"), "Marina A.");
    fireEvent.press(screen.getByRole("button", { name: "Salvar Alterações" }));
    expect(useEstadoConta.getState().perfil.nome).toBe("Marina A.");
  });

  it("tem o campo de instruções para a IA", () => {
    renderizar();
    expect(screen.getByLabelText("Como o Bimo deve te tratar")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 5: Rodar os testes e confirmar que falham**

Run: `cd mobile && npm test -- conta`
Expected: FAIL — `Cannot find module './Configuracoes'`

- [ ] **Step 6: Escrever `LinhaDeConfiguracao.tsx`**

```tsx
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";

export function LinhaDeConfiguracao({ rotulo, hint, children }: { rotulo: string; hint: string; children: ReactNode }) {
  const { cores, tipografia, espacamento } = useTema();

  return (
    <View style={{ minHeight: espacamento.alvoDeToque, flexDirection: "row", alignItems: "center", gap: espacamento.md, paddingVertical: espacamento.sm, borderBottomWidth: 1, borderBottomColor: cores.fioDeCabelo }}>
      <View style={{ flex: 1 }}>
        <Text style={[tipografia.corpo, { color: cores.sobreSuperficie }]}>{rotulo}</Text>
        <Text style={[tipografia.legenda, { color: cores.textoSuave }]}>{hint}</Text>
      </View>
      {children}
    </View>
  );
}
```

- [ ] **Step 7: Escrever `Configuracoes.tsx`**

```tsx
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { Cartao, Icone, Interruptor, Pill, Sobrancelha } from "@/compartilhado/ui";
import { LinhaDeConfiguracao } from "./componentes/LinhaDeConfiguracao";
import { useEstadoConta, type Densidade } from "./estado";

const DENSIDADES: Densidade[] = [50, 60, 80];

export function Configuracoes() {
  const { cores, tipografia, espacamento } = useTema();
  const router = useRouter();
  const { interruptores, densidade, alternar, definirDensidade } = useEstadoConta();

  return (
    <View style={{ flex: 1, backgroundColor: cores.superficie }}>
      <View style={{ minHeight: espacamento.alturaCabecalho, flexDirection: "row", alignItems: "center", gap: espacamento.sm, paddingHorizontal: espacamento.md, borderBottomWidth: 1, borderBottomColor: cores.fioDeCabelo }}>
        <Icone nome="arrow_back" tamanho={22} cor={cores.sobreSuperficie} />
        <Text style={[tipografia.titleMd, { color: cores.sobreSuperficie }]}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: espacamento.lg, paddingVertical: espacamento.gutter }}>
        <Cartao>
          <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.md }}>
            <Icone nome="cloud" tamanho={20} cor={cores.secundaria} />
            <View style={{ flex: 1 }}>
              <Text style={[tipografia.corpoMedio, { color: cores.sobreSuperficie }]}>Sincronizado</Text>
              <Text style={[tipografia.legenda, { color: cores.textoSuave }]}>642 notas · há 2 minutos</Text>
            </View>
            <Icone nome="sync" tamanho={18} cor={cores.contorno} />
          </View>
        </Cartao>

        <Sobrancelha texto="GRAFO DE FUNDO" />
        <LinhaDeConfiguracao rotulo="Campo do grafo" hint="Nós à deriva atrás do conteúdo">
          <Interruptor ligado={interruptores.grafo} aoMudar={() => alternar("grafo")} rotuloAcessivel="Campo do grafo" />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao rotulo="Partículas de raciocínio" hint="Iris viaja pelas ligações quando o Bimo pensa">
          <Interruptor ligado={interruptores.particulas} aoMudar={() => alternar("particulas")} rotuloAcessivel="Partículas de raciocínio" />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao rotulo="Densidade de nós" hint={`${densidade} nós no campo de fundo`}>
          <View style={{ flexDirection: "row", gap: espacamento.sm }}>
            {DENSIDADES.map((valor) => (
              <Pill key={valor} rotulo={String(valor)} ativo={valor === densidade} aoTocar={() => definirDensidade(valor)} />
            ))}
          </View>
        </LinhaDeConfiguracao>

        <Sobrancelha texto="INTELIGÊNCIA" />
        <LinhaDeConfiguracao rotulo="Extrair tags ao salvar" hint="Sempre como sugestão, nunca automático">
          <Interruptor ligado={interruptores.tagsAutomaticas} aoMudar={() => alternar("tagsAutomaticas")} rotuloAcessivel="Extrair tags ao salvar" />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao rotulo="Sugerir links enquanto escrevo" hint="Mais interrupções, mais conexões">
          <Interruptor ligado={interruptores.linksAutomaticos} aoMudar={() => alternar("linksAutomaticos")} rotuloAcessivel="Sugerir links enquanto escrevo" />
        </LinhaDeConfiguracao>

        <Sobrancelha texto="SINCRONIZAÇÃO" />
        <LinhaDeConfiguracao rotulo="Sincronizar só no Wi-Fi" hint="Vault local continua disponível offline">
          <Interruptor ligado={interruptores.somenteWifi} aoMudar={() => alternar("somenteWifi")} rotuloAcessivel="Sincronizar só no Wi-Fi" />
        </LinhaDeConfiguracao>

        <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.sm, marginTop: espacamento.xl }}>
          <Icone nome="info" tamanho={20} cor={cores.contorno} />
          <Text style={[tipografia.legenda, { color: cores.contorno }]}>Bimo 1.4.0 · vault local com sincronização</Text>
        </View>
      </ScrollView>
    </View>
  );
}
```

O `arrow_back` da barra precisa virar um `Pressable` com `accessibilityLabel="Voltar"` e `onPress={() => router.back()}` — mesmo padrão do `BarraDoEditor` da Task 14.

- [ ] **Step 8: Escrever `Perfil.tsx`**

Cada `TextInput` leva `accessibilityLabel` igual ao label visível — é assim que os testes o encontram.

```tsx
import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { useServicos } from "@/servicos";
import { Avatar, Botao, Cartao, Icone } from "@/compartilhado/ui";
import { useEstadoConta } from "./estado";

function Estatistica({ valor, rotulo }: { valor: number; rotulo: string }) {
  const { cores, tipografia } = useTema();
  return (
    <Cartao style={{ flex: 1 }}>
      <Text style={[tipografia.displayMd, { color: cores.sobreSuperficie }]}>{valor}</Text>
      <Text style={[tipografia.legenda, { color: cores.textoSuave }]}>{rotulo}</Text>
    </Cartao>
  );
}

function Campo({
  rotulo, valor, aoMudar, multilinha = false,
}: { rotulo: string; valor: string; aoMudar: (texto: string) => void; multilinha?: boolean }) {
  const { cores, tipografia, espacamento, raios } = useTema();
  return (
    <View style={{ marginBottom: espacamento.md }}>
      <Text style={[tipografia.rotuloSm, { color: cores.contorno, marginBottom: espacamento.xs }]}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        value={valor}
        onChangeText={aoMudar}
        multiline={multilinha}
        textAlignVertical={multilinha ? "top" : "center"}
        style={[
          tipografia.corpo,
          {
            color: cores.sobreSuperficie,
            backgroundColor: cores.superficieContainerBaixa,
            borderWidth: 1, borderColor: cores.fioDeCabelo, borderRadius: raios.cartao,
            paddingHorizontal: espacamento.md, paddingVertical: 10,
            minHeight: multilinha ? 88 : undefined,
          },
        ]}
      />
    </View>
  );
}

export function Perfil() {
  const { cores, tipografia, espacamento } = useTema();
  const router = useRouter();
  const { vault } = useServicos();
  const { perfil, definirPerfil } = useEstadoConta();

  const [rascunho, setRascunho] = useState(perfil);
  const [estatisticas, setEstatisticas] = useState({ notas: 0, conexoes: 0, pastas: 0 });

  useEffect(() => {
    Promise.all([vault.listarNotas(), vault.listarArestas()]).then(([notas, arestas]) => {
      setEstatisticas({ notas: notas.length, conexoes: arestas.length, pastas: new Set(notas.map((nota) => nota.pasta)).size });
    });
  }, [vault]);

  const iniciais = rascunho.nome.split(" ").slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: cores.superficie }}>
      <View style={{ minHeight: espacamento.alturaCabecalho, flexDirection: "row", alignItems: "center", gap: espacamento.sm, paddingHorizontal: espacamento.md, borderBottomWidth: 1, borderBottomColor: cores.fioDeCabelo }}>
        <Icone nome="arrow_back" tamanho={22} cor={cores.sobreSuperficie} />
        <Text style={[tipografia.titleMd, { color: cores.sobreSuperficie }]}>Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: espacamento.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.md, marginBottom: espacamento.lg }}>
          <Avatar iniciais={iniciais} tamanho={64} />
          <View style={{ flex: 1, gap: espacamento.xs }}>
            <Botao variante="outline" rotulo="Trocar Foto" icone="person" aoTocar={() => {}} />
            <Text style={[tipografia.legenda, { color: cores.contorno }]}>Sem foto: iniciais em Teal Current.</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: espacamento.sm, marginBottom: espacamento.lg }}>
          <Estatistica valor={estatisticas.notas} rotulo="Notas" />
          <Estatistica valor={estatisticas.conexoes} rotulo="Conexões" />
          <Estatistica valor={estatisticas.pastas} rotulo="Pastas" />
        </View>

        <Campo rotulo="Nome" valor={rascunho.nome} aoMudar={(nome) => setRascunho({ ...rascunho, nome })} />
        <Campo rotulo="E-mail" valor={rascunho.email} aoMudar={(email) => setRascunho({ ...rascunho, email })} />
        <Campo rotulo="Como o Bimo deve te tratar" valor={rascunho.comoMeTratar} aoMudar={(comoMeTratar) => setRascunho({ ...rascunho, comoMeTratar })} multilinha />

        <Botao variante="primario" rotulo="Salvar Alterações" aoTocar={() => definirPerfil(rascunho)} larguraTotal />

        <View style={{ marginTop: espacamento.lg, paddingTop: espacamento.md, borderTopWidth: 1, borderTopColor: cores.fioDeCabelo }}>
          <Botao variante="ghost" rotulo="Sair da Conta" icone="logout" aoTocar={() => router.back()} />
        </View>
      </ScrollView>
    </View>
  );
}
```

O `arrow_back` da barra vira um `Pressable` com `accessibilityLabel="Voltar"` e `onPress={() => router.back()}`, igual ao `BarraDoEditor` da Task 14.

O botão "Trocar Foto" fica sem ação nesta fase: escolher foto exige `expo-image-picker` e um lugar para guardar o arquivo, que é trabalho do backend. O handoff já prevê o estado sem foto (iniciais), então essa é a tela completa para esta etapa.

- [ ] **Step 9: Escrever `MenuDeConta.tsx` e ligar no layout**

```tsx
import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Avatar, Icone, Sheet, type NomeDeIcone } from "@/compartilhado/ui";
import { useEstadoConta } from "../estado";

const LINHAS: { rotulo: string; icone: NomeDeIcone; destino: "perfil" | "configuracoes" | "sair" }[] = [
  { rotulo: "Perfil", icone: "person", destino: "perfil" },
  { rotulo: "Configurações", icone: "settings", destino: "configuracoes" },
  { rotulo: "Sair da conta", icone: "logout", destino: "sair" },
];

export function MenuDeConta({ aberto, aoFechar, aoEscolher }: { aberto: boolean; aoFechar: () => void; aoEscolher: (destino: "perfil" | "configuracoes" | "sair") => void }) {
  const { cores, tipografia, espacamento, raios } = useTema();
  const { perfil } = useEstadoConta();

  return (
    <Sheet aberta={aberto} aoFechar={aoFechar}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.md, padding: espacamento.md }}>
        <Avatar iniciais={perfil.nome.split(" ").slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()} tamanho={40} />
        <View style={{ flex: 1 }}>
          <Text style={[tipografia.titleSm, { color: cores.sobreSuperficie }]}>{perfil.nome}</Text>
          <Text style={[tipografia.legenda, { color: cores.textoSuave }]}>{perfil.email}</Text>
        </View>
      </View>

      {LINHAS.map((linha) => (
        <Pressable
          key={linha.destino}
          accessibilityRole="button"
          accessibilityLabel={linha.rotulo}
          onPress={() => aoEscolher(linha.destino)}
          style={{ minHeight: espacamento.alvoDeToque, flexDirection: "row", alignItems: "center", gap: espacamento.md, paddingHorizontal: espacamento.md, borderRadius: raios.cartao }}
        >
          <Icone nome={linha.icone} tamanho={20} cor={cores.contorno} />
          <Text style={[tipografia.corpo, { color: cores.sobreSuperficie }]}>{linha.rotulo}</Text>
        </Pressable>
      ))}
    </Sheet>
  );
}
```

Em `app/(app)/_layout.tsx`, montar `<MenuDeConta aberto={contaAberta} aoFechar={() => setContaAberta(false)} aoEscolher={...} />` depois do `<Stack>`. `aoEscolher` fecha o menu e navega para `/perfil` ou `/configuracoes`; `"sair"` volta para `/intro` (não há autenticação nesta fase, então sair é só reiniciar o fluxo).

Trocar também as iniciais do `Cabecalho`: passar a lê-las de `useEstadoConta().perfil.nome` em vez da fixture direta, para que editar o nome no Perfil apareça no avatar.

- [ ] **Step 10: Criar as duas rotas**

```tsx
// app/(app)/perfil.tsx
import { Perfil } from "@/funcionalidades/conta/Perfil";

export default function RotaPerfil() {
  return <Perfil />;
}
```

```tsx
// app/(app)/configuracoes.tsx
import { Configuracoes } from "@/funcionalidades/conta/Configuracoes";

export default function RotaConfiguracoes() {
  return <Configuracoes />;
}
```

- [ ] **Step 11: Fechar as pendências das tasks 11 e 13**

Em `Chat.tsx` e `TelaNota.tsx`, trocar os valores provisórios pelo store de verdade:

```ts
const { interruptores, densidade } = useEstadoConta();
```

- [ ] **Step 12: Rodar os testes e confirmar que passam**

Run: `cd mobile && npm test -- conta`
Expected: PASS, 11 testes

- [ ] **Step 13: Rodar a suíte inteira e o lint**

Run: `cd mobile && npm test && npm run lint && npx tsc --noEmit`
Expected: tudo verde, sem erro de tipo

- [ ] **Step 14: Conferir o app inteiro no Expo Go, nos dois temas**

Run: `cd mobile && npx expo start`

Percorrer: intro → chat → enviar mensagem → tocar num cartão → editor → ação de IA → inserir → voltar → destino Nota → selecionar nó → Perguntar → volta ao chat com a pergunta pronta → avatar → Perfil → editar nome → Configurações → desligar o campo do grafo e conferir que o fundo some nas duas telas → trocar a densidade. Repetir com o tema do sistema em escuro.

- [ ] **Step 15: Commit**

```bash
git add mobile/src/funcionalidades "mobile/app/(app)"
git commit -m "feat(mobile): menu de conta, perfil e configuracoes ligados aos interruptores do grafo"
```
