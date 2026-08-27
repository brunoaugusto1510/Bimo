import { View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "./Vidro";
import { Icone } from "./Icone";
import { Avatar } from "./Avatar";
import { TabSwitcher, type Destino } from "./TabSwitcher";

type Props = {
  destinoAtivo: Destino;
  aoTrocarDestino: (destino: Destino) => void;
  aoAbrirConta: () => void;
  iniciais: string;
};

export function Cabecalho({ destinoAtivo, aoTrocarDestino, aoAbrirConta, iniciais }: Props) {
  const { cores, espacamento } = useTema();

  return (
    <Vidro
      nivel="barra"
      testID="cabecalho"
      style={{
        height: espacamento.alturaCabecalho,
        flexDirection: "row",
        alignItems: "center",
        gap: espacamento.sm,
        paddingHorizontal: espacamento.md,
        borderBottomWidth: 1,
        borderBottomColor: cores.fioDeCabelo,
      }}
    >
      <Icone nome="psychology" tamanho={22} cor={cores.primaria} preenchido />
      <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
        <TabSwitcher ativo={destinoAtivo} aoTrocar={aoTrocarDestino} />
      </View>
      <Avatar iniciais={iniciais} tamanho={32} aoTocar={aoAbrirConta} />
    </Vidro>
  );
}
