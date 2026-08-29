import { Pressable, Text } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone, type NomeDeIcone } from "./Icone";

type Variante = "primario" | "outline" | "ghost";

type Props = {
  variante: Variante;
  rotulo: string;
  aoTocar: () => void;
  icone?: NomeDeIcone;
  desabilitado?: boolean;
  larguraTotal?: boolean;
  testID?: string;
};

export function Botao({ variante, rotulo, aoTocar, icone, desabilitado = false, larguraTotal = false, testID }: Props) {
  const { cores, tipografia, espacamento, raios, sombras } = useTema();

  const fundo = variante === "primario" ? cores.primaria : "transparent";
  const texto = variante === "primario" ? cores.sobrePrimaria : cores.primaria;
  const borda = variante === "outline" ? cores.fioDeCabelo : "transparent";

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={aoTocar}
      style={({ pressed }) => [
        {
          minHeight: espacamento.alvoDeToque,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: espacamento.sm,
          paddingHorizontal: espacamento.gutter,
          borderRadius: raios.bolha,
          backgroundColor: fundo,
          borderWidth: 1,
          borderColor: borda,
          opacity: desabilitado ? 0.5 : pressed ? 0.85 : 1,
          flex: larguraTotal ? 1 : undefined,
        },
        variante === "primario" ? sombras.pequena : null,
      ]}
    >
      {icone ? <Icone nome={icone} tamanho={18} cor={texto} /> : null}
      <Text style={[tipografia.titleSm, { color: texto }]}>{rotulo}</Text>
    </Pressable>
  );
}
