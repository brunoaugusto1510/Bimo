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
      hitSlop={6}
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
