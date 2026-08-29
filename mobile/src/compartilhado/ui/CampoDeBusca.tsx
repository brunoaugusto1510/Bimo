import { useState } from "react";
import { TextInput, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone } from "./Icone";

export function CampoDeBusca({ valor, aoMudar, placeholder }: { valor: string; aoMudar: (texto: string) => void; placeholder: string }) {
  const { cores, tipografia, raios } = useTema();
  const [focado, setFocado] = useState(false);

  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingLeft: 8, paddingRight: 8, minHeight: 36,
        borderRadius: raios.pill,
        backgroundColor: cores.superficieContainerBaixa,
        borderWidth: 1,
        borderColor: focado ? cores.primaria : cores.fioDeCabelo,
      }}
    >
      <Icone nome="search" tamanho={18} cor={cores.contorno} />
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        placeholder={placeholder}
        placeholderTextColor={cores.textoPlaceholder}
        style={[tipografia.corpo, { flex: 1, color: cores.sobreSuperficie, paddingVertical: 6 }]}
      />
    </View>
  );
}
