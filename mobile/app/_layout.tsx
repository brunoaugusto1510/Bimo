import { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { ProvedorDeTema, opcoesDePilha, useTema } from "@/compartilhado/tema";
import { useFontes } from "@/compartilhado/tema/useFontes";
import { ProvedorDeServicos } from "@/servicos";

SplashScreen.preventAutoHideAsync();

// A pilha precisa ler o tema, e quem monta o `ProvedorDeTema` nao consegue
// chamar `useTema` no mesmo componente — dai este componente-filho.
function PilhaRaiz() {
  const { cores } = useTema();
  return <Stack screenOptions={opcoesDePilha(cores)} />;
}

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
          <PilhaRaiz />
        </ProvedorDeServicos>
      </ProvedorDeTema>
    </GestureHandlerRootView>
  );
}
