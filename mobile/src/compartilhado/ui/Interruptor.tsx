import { Pressable, View } from "react-native";
import { useTema } from "@/compartilhado/tema";

export function Interruptor({ ligado, aoMudar, rotuloAcessivel }: { ligado: boolean; aoMudar: (ligado: boolean) => void; rotuloAcessivel: string }) {
  const { cores, raios, sombras } = useTema();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={rotuloAcessivel}
      accessibilityState={{ checked: ligado }}
      onPress={() => aoMudar(!ligado)}
      hitSlop={10}
      style={{
        width: 44, height: 26, padding: 2,
        borderRadius: raios.pill,
        borderWidth: 1, borderColor: cores.fioDeCabelo,
        backgroundColor: ligado ? cores.primaria : cores.superficieContainerAlta,
        justifyContent: "center",
        alignItems: ligado ? "flex-end" : "flex-start",
      }}
    >
      <View style={[{ width: 20, height: 20, borderRadius: raios.pill, backgroundColor: ligado ? cores.sobrePrimaria : cores.contorno }, sombras.pequena]} />
    </Pressable>
  );
}
