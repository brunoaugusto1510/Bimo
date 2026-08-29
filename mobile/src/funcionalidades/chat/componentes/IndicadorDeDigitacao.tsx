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
