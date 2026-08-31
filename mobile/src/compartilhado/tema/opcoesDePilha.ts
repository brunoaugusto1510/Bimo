import type { Cores } from "./tokens/cores";

// O expo-router embute o React Navigation, e o `DefaultTheme` dele pinta o
// fundo de cada tela da pilha com `rgb(242, 242, 242)` — claro, e alheio ao
// nosso `ProvedorDeTema`
// (`node_modules/expo-router/build/react-navigation/native/theming/DefaultTheme.js`).
// Sem passar `contentStyle`, no tema escuro so as faixas de safe area ficavam
// escuras (elas vem do `SafeAreaView` do layout) e o miolo continuava branco:
// os vidros translucidos — `vidroBolha` nas bolhas, `vidroDock` no composer,
// ambos `rgba(19,19,21,0.60)` — eram compostos sobre esse branco e liam como
// retangulos claros, em vez do vidro escuro que deveriam ser.
export function opcoesDePilha(cores: Cores) {
  return { headerShown: false, contentStyle: { backgroundColor: cores.fundo } } as const;
}
