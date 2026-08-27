import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTema } from "@/compartilhado/tema";
import { Icone, Vidro } from "@/compartilhado/ui";

type Props = { valor: string; aoMudar: (texto: string) => void; aoEnviar: () => void };

export function Composer({ valor, aoMudar, aoEnviar }: Props) {
  const { cores, tipografia, espacamento, raios, sombras } = useTema();
  const [focado, setFocado] = useState(false);

  return (
    <View>
      <LinearGradient colors={cores.protecaoDock as unknown as [string, string, string]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96 }} pointerEvents="none" />
      <View style={{ paddingHorizontal: espacamento.gutter, paddingTop: espacamento.sm, paddingBottom: espacamento.md }}>
        <Vidro
          nivel="dock"
          style={[
            { padding: espacamento.xs, borderRadius: raios.folha, borderWidth: 1, borderColor: focado ? cores.primaria : cores.fioDeCabelo, overflow: "hidden" },
            sombras.grande,
          ]}
        >
          <TextInput
            value={valor}
            onChangeText={aoMudar}
            onFocus={() => setFocado(true)}
            onBlur={() => setFocado(false)}
            placeholder="Pergunte ao Bimo ou consulte seu vault..."
            placeholderTextColor={cores.textoPlaceholder}
            multiline
            style={[tipografia.corpo, { color: cores.sobreSuperficie, minHeight: 46, maxHeight: espacamento.alturaMaximaComposer, padding: espacamento.md }]}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.md, paddingHorizontal: espacamento.sm, paddingBottom: espacamento.xs }}>
            <Icone nome="attach_file" tamanho={20} cor={cores.contorno} />
            <Icone nome="center_focus_strong" tamanho={20} cor={cores.contorno} />
            <View style={{ flex: 1 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar"
              onPress={aoEnviar}
              style={{ width: 32, height: 32, borderRadius: raios.cartao, backgroundColor: cores.primaria, alignItems: "center", justifyContent: "center" }}
              hitSlop={8}
            >
              <Icone nome="arrow_upward" tamanho={18} cor={cores.sobrePrimaria} />
            </Pressable>
          </View>
        </Vidro>
      </View>
    </View>
  );
}
