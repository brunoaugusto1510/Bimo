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
