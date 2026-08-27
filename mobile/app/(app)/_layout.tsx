import { useState } from "react";
import { View } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTema } from "@/compartilhado/tema";
import { Cabecalho } from "@/compartilhado/ui/Cabecalho";
import type { Destino } from "@/compartilhado/ui/TabSwitcher";
import { perfil } from "@/dados/fixtures/perfil";

function iniciaisDe(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export default function LayoutDoApp() {
  const { cores } = useTema();
  const router = useRouter();
  const caminho = usePathname();
  const [contaAberta, setContaAberta] = useState(false);

  const destinoAtivo: Destino = caminho.startsWith("/nota") ? "nota" : "bimo";

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Cabecalho
        destinoAtivo={destinoAtivo}
        aoTrocarDestino={(destino) => router.replace(destino === "bimo" ? "/bimo" : "/nota")}
        aoAbrirConta={() => setContaAberta(true)}
        iniciais={iniciaisDe(perfil.nome)}
      />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="bimo" />
          <Stack.Screen name="nota" />
          <Stack.Screen name="editor/[id]" options={{ presentation: "fullScreenModal" }} />
          {/* `perfil` e `configuracoes` só ganham arquivo na Task 15 — expo-router
              tolera declarar a apresentação de uma rota ainda inexistente:
              `useSortedScreens` (expo-router/build/useScreens.js) só emite um
              console.warn e descarta a entrada, sem lançar. Deixar registrado
              aqui evita ter que lembrar de voltar neste arquivo na Task 15. */}
          <Stack.Screen name="perfil" options={{ presentation: "formSheet" }} />
          <Stack.Screen name="configuracoes" options={{ presentation: "formSheet" }} />
        </Stack>
      </View>
    </SafeAreaView>
  );
}
