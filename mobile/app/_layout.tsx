import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { useFontes } from "@/compartilhado/tema/useFontes";

SplashScreen.preventAutoHideAsync();

export default function LayoutRaiz() {
  const fontesCarregadas = useFontes();

  useEffect(() => {
    if (fontesCarregadas) SplashScreen.hideAsync();
  }, [fontesCarregadas]);

  if (!fontesCarregadas) return null;

  return (
    <ProvedorDeTema>
      <Stack screenOptions={{ headerShown: false }} />
    </ProvedorDeTema>
  );
}
