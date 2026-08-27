import { Text, View } from "react-native";
import { CampoDeGrafo } from "@/compartilhado/grafo";

export default function RotaBimo() {
  return (
    <View style={{ flex: 1 }}>
      <CampoDeGrafo modo="ambiente" densidade={60} ligado particulasLigadas pulso={0} crescer={0} />
      <Text>Bimo</Text>
    </View>
  );
}
