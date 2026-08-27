import { Easing } from "react-native-reanimated";

export const movimento = {
  duracaoRapida: 150,
  duracaoBase: 200,
  duracaoLenta: 300,
  curvaPadrao: Easing.bezier(0.2, 0, 0, 1),
} as const;

export type Movimento = typeof movimento;
