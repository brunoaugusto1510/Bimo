import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone, type NomeDeIcone } from "./Icone";

type Acao = { rotulo: string; icone: NomeDeIcone; aoTocar: () => void };

export function Sobrancelha({ texto, acao }: { texto: string; acao?: Acao }) {
  const { cores, tipografia, espacamento } = useTema();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: espacamento.md, paddingVertical: espacamento.sm }}>
      <Text style={[tipografia.sobrancelha, { color: cores.contorno, textTransform: "uppercase" }]}>{texto}</Text>
      {acao ? (
        <Pressable accessibilityRole="button" accessibilityLabel={acao.rotulo} onPress={acao.aoTocar} hitSlop={16} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icone nome={acao.icone} tamanho={14} cor={cores.primaria} />
          <Text style={[tipografia.legenda, { color: cores.primaria }]}>{acao.rotulo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
