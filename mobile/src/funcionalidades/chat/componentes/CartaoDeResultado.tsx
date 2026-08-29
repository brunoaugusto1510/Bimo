import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Cartao, Icone } from "@/compartilhado/ui";
import type { Nota } from "@/dados/tipos";

export function CartaoDeResultado({ nota, aoTocar }: { nota: Nota; aoTocar: () => void }) {
  const { cores, tipografia, espacamento } = useTema();

  return (
    <Cartao aoTocar={aoTocar} rotuloAcessivel={nota.titulo} style={{ marginTop: espacamento.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icone nome="description" tamanho={16} cor={cores.primaria} />
        <Text style={[tipografia.titleSm, { color: cores.primaria, flex: 1 }]} numberOfLines={1}>
          {nota.titulo}
        </Text>
      </View>
      <Text style={[tipografia.legenda, { color: cores.textoSuave, marginTop: espacamento.xs }]} numberOfLines={2}>
        {nota.resumo}
      </Text>
    </Cartao>
  );
}
