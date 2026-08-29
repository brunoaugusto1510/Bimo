import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "@/compartilhado/ui";

function Pilula({ texto }: { texto: string }) {
  const { cores, tipografia, raios } = useTema();
  return (
    <Vidro
      nivel="barra"
      style={{
        borderRadius: raios.pill,
        borderWidth: 1,
        borderColor: cores.fioDeCabelo,
        paddingHorizontal: 9,
        paddingVertical: 4,
        overflow: "hidden",
      }}
    >
      <Text style={[tipografia.legenda, { fontSize: 11, lineHeight: 14, color: cores.contorno }]}>{texto}</Text>
    </Vidro>
  );
}

export function ChipsDeContexto({ escopo, contagem }: { escopo: string; contagem: string }) {
  const { espacamento } = useTema();
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: espacamento.md,
        left: espacamento.gutter,
        right: espacamento.gutter,
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <Pilula texto={escopo} />
      <Pilula texto={contagem} />
    </View>
  );
}
