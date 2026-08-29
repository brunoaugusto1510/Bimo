import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Avatar, Icone, Sheet, type NomeDeIcone } from "@/compartilhado/ui";
import { useEstadoConta } from "../estado";

const LINHAS: { rotulo: string; icone: NomeDeIcone; destino: "perfil" | "configuracoes" | "sair" }[] = [
  { rotulo: "Perfil", icone: "person", destino: "perfil" },
  { rotulo: "Configurações", icone: "settings", destino: "configuracoes" },
  { rotulo: "Sair da conta", icone: "logout", destino: "sair" },
];

export function MenuDeConta({ aberto, aoFechar, aoEscolher }: { aberto: boolean; aoFechar: () => void; aoEscolher: (destino: "perfil" | "configuracoes" | "sair") => void }) {
  const { cores, tipografia, espacamento, raios } = useTema();
  const { perfil } = useEstadoConta();

  return (
    <Sheet aberta={aberto} aoFechar={aoFechar}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.md, padding: espacamento.md }}>
        <Avatar iniciais={perfil.nome.split(" ").slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()} tamanho={40} />
        <View style={{ flex: 1 }}>
          <Text style={[tipografia.titleSm, { color: cores.sobreSuperficie }]}>{perfil.nome}</Text>
          <Text style={[tipografia.legenda, { color: cores.textoSuave }]}>{perfil.email}</Text>
        </View>
      </View>

      {LINHAS.map((linha) => (
        <Pressable
          key={linha.destino}
          accessibilityRole="button"
          accessibilityLabel={linha.rotulo}
          onPress={() => aoEscolher(linha.destino)}
          style={{ minHeight: espacamento.alvoDeToque, flexDirection: "row", alignItems: "center", gap: espacamento.md, paddingHorizontal: espacamento.md, borderRadius: raios.cartao }}
        >
          <Icone nome={linha.icone} tamanho={20} cor={cores.contorno} />
          <Text style={[tipografia.corpo, { color: cores.sobreSuperficie }]}>{linha.rotulo}</Text>
        </Pressable>
      ))}
    </Sheet>
  );
}
