import { useFonts } from "expo-font";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from "@expo-google-fonts/geist";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";

export function useFontes(): boolean {
  const [carregadas] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    JetBrainsMono_400Regular,
    MaterialSymbolsOutlined: require("../../../assets/fontes/MaterialSymbolsOutlined.ttf"),
    "MaterialSymbolsRounded-Fill": require("../../../assets/fontes/MaterialSymbolsRounded-Fill.ttf"),
  });

  return carregadas;
}
