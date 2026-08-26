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
