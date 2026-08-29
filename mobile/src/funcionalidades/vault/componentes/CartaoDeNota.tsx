import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Cartao, Chip, Icone } from "@/compartilhado/ui";
import type { Nota } from "@/dados/tipos";

export function CartaoDeNota({ nota, selecionado, aoTocar }: { nota: Nota; selecionado: boolean; aoTocar: () => void }) {
  const { cores, tipografia, espacamento } = useTema();

  return (
    // rotuloAcessivel: o cartão mistura título, resumo, chip de pasta e
    // ícone de conexões — sem um nome acessível explícito, a síntese padrão
    // de Text descendentes não produz um rótulo utilizável (ver Cartao.tsx,
    // adicionado na Task 11).
    <Cartao aoTocar={aoTocar} selecionado={selecionado} rotuloAcessivel={nota.titulo}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.sm }}>
        <Text style={[tipografia.titleSm, { color: cores.primaria, flex: 1 }]} numberOfLines={1}>
          {nota.titulo}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icone nome="hub" tamanho={14} cor={cores.contorno} />
          <Text style={[tipografia.legenda, { color: cores.contorno }]}>{nota.conexoes}</Text>
        </View>
      </View>
      <Text style={[tipografia.legenda, { color: cores.textoSuave, marginTop: espacamento.xs }]} numberOfLines={2}>
        {nota.resumo}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: espacamento.sm }}>
        <Chip rotulo={nota.pasta} />
        <Text style={[tipografia.legenda, { color: cores.contorno }]}>{nota.editadaEm}</Text>
      </View>
    </Cartao>
  );
}
