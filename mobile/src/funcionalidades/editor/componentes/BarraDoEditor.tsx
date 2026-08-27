import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone } from "@/compartilhado/ui";

type Props = {
  pasta: string;
  aoVoltar: () => void;
  aoAbrirIA: () => void;
  aoFechar: () => void;
  // Desabilita o gatilho da IA enquanto o conteúdo real da nota ainda não
  // chegou — rodar uma ação da IA contra uma nota vazia produziria uma
  // sugestão sem sentido (resumir/perguntar sobre nada). A janela é curta
  // (só o tempo do fetch), então desabilitar é mais honesto do que deixar
  // o usuário disparar algo contra um casco vazio.
  iaDesabilitada?: boolean;
};

export function BarraDoEditor({ pasta, aoVoltar, aoAbrirIA, aoFechar, iaDesabilitada = false }: Props) {
  const { cores, tipografia, espacamento, raios } = useTema();

  return (
    <View
      style={{
        minHeight: espacamento.alturaCabecalho,
        flexDirection: "row",
        alignItems: "center",
        gap: espacamento.sm,
        paddingHorizontal: espacamento.md,
        borderBottomWidth: 1,
        borderBottomColor: cores.fioDeCabelo,
        backgroundColor: cores.superficie,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={aoVoltar}
        style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        hitSlop={8}
      >
        <Icone nome="arrow_back" tamanho={22} cor={cores.sobreSuperficie} />
      </Pressable>

      <Text style={[tipografia.titleSm, { color: cores.textoSuave, flex: 1 }]} numberOfLines={1}>
        {pasta}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bimo"
        accessibilityState={{ disabled: iaDesabilitada }}
        disabled={iaDesabilitada}
        onPress={aoAbrirIA}
        hitSlop={4}
        style={{
          minHeight: 36,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: espacamento.md,
          borderRadius: raios.pill,
          borderWidth: 1,
          borderColor: cores.fioDeCabelo,
          backgroundColor: cores.superficieContainerBaixa,
          opacity: iaDesabilitada ? 0.5 : 1,
        }}
      >
        <Icone nome="psychology" tamanho={18} cor={cores.primaria} />
        <Text style={[tipografia.rotuloSm, { color: cores.primaria }]}>Bimo</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={aoFechar}
        style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        hitSlop={8}
      >
        <Icone nome="close" tamanho={18} cor={cores.contorno} />
      </Pressable>
    </View>
  );
}
