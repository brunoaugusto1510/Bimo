import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "@/compartilhado/ui";

type Props = { autor: "usuario" | "agente"; texto: string; horario: string; children?: ReactNode };

export function Bolha({ autor, texto, horario, children }: Props) {
  const { cores, tipografia, espacamento, raios, sombras } = useTema();
  const doUsuario = autor === "usuario";

  const cantos = doUsuario
    ? { borderBottomRightRadius: raios.cauda }
    : { borderBottomLeftRadius: raios.cauda };

  const corpo = (
    <View style={{ padding: espacamento.md }}>
      <Text style={[tipografia.corpoRelaxado, { color: doUsuario ? cores.sobrePrimaria : cores.sobreSuperficie }]}>{texto}</Text>
      {children}
    </View>
  );

  return (
    <View style={{ alignSelf: doUsuario ? "flex-end" : "flex-start", maxWidth: "85%" }}>
      {doUsuario ? (
        <View style={[{ backgroundColor: cores.bolhaUsuario, borderWidth: 1, borderColor: cores.bolhaUsuarioBorda, borderRadius: raios.bolha, overflow: "hidden" }, cantos, sombras.pequena]}>
          {corpo}
        </View>
      ) : (
        <Vidro nivel="bolha" style={[{ borderWidth: 1, borderColor: cores.fioDeCabelo, borderRadius: raios.bolha, overflow: "hidden" }, cantos, sombras.pequena]}>
          {corpo}
        </Vidro>
      )}
      <Text
        style={[
          tipografia.legenda,
          { color: cores.textoTenue, marginTop: espacamento.xs, alignSelf: doUsuario ? "flex-end" : "flex-start", paddingHorizontal: espacamento.xs },
        ]}
      >
        {doUsuario ? horario : `Bimo AI · ${horario}`}
      </Text>
    </View>
  );
}
