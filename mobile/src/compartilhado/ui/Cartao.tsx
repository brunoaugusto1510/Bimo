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
