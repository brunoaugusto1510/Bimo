import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";

export function LinhaDeConfiguracao({ rotulo, hint, children }: { rotulo: string; hint: string; children: ReactNode }) {
  const { cores, tipografia, espacamento } = useTema();

  return (
    <View style={{ minHeight: espacamento.alvoDeToque, flexDirection: "row", alignItems: "center", gap: espacamento.md, paddingVertical: espacamento.sm, borderBottomWidth: 1, borderBottomColor: cores.fioDeCabelo }}>
      <View style={{ flex: 1 }}>
        <Text style={[tipografia.corpo, { color: cores.sobreSuperficie }]}>{rotulo}</Text>
        <Text style={[tipografia.legenda, { color: cores.textoSuave }]}>{hint}</Text>
      </View>
      {children}
    </View>
  );
}
