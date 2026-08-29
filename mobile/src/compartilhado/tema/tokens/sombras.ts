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
