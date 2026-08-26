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
