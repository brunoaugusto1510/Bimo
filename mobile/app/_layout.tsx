import { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { useFontes } from "@/compartilhado/tema/useFontes";
import { ProvedorDeServicos } from "@/servicos";

SplashScreen.preventAutoHideAsync();

export default function LayoutRaiz() {
  const { carregadas, erro } = useFontes();
  const pronto = carregadas || erro !== null;

  useEffect(() => {
    if (pronto) SplashScreen.hideAsync();
  }, [pronto]);

  useEffect(() => {
    if (erro) {
      console.warn("Falha ao carregar as fontes; seguindo com as fontes do sistema.", erro);
    }
  }, [erro]);

  if (!pronto) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProvedorDeTema>
        <ProvedorDeServicos>
          <Stack screenOptions={{ headerShown: false }} />
        </ProvedorDeServicos>
      </ProvedorDeTema>
    </GestureHandlerRootView>
  );
}
