import { useState } from "react";
import { View } from "react-native";
import { Stack, usePathname, useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { opcoesDePilha, useTema } from "@/compartilhado/tema";
import { Cabecalho } from "@/compartilhado/ui/Cabecalho";
import type { Destino } from "@/compartilhado/ui/TabSwitcher";
import { MenuDeConta } from "@/funcionalidades/conta/componentes/MenuDeConta";
import { useEstadoConta } from "@/funcionalidades/conta/estado";

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
  const nomeDoPerfil = useEstadoConta((estado) => estado.perfil.nome);

  const destinoAtivo: Destino = caminho.startsWith("/nota") ? "nota" : "bimo";

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Cabecalho
        destinoAtivo={destinoAtivo}
        aoTrocarDestino={(destino) => router.replace(destino === "bimo" ? "/bimo" : "/nota")}
        aoAbrirConta={() => setContaAberta(true)}
        iniciais={iniciaisDe(nomeDoPerfil)}
      />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={opcoesDePilha(cores)}>
          <Stack.Screen name="bimo" />
          <Stack.Screen name="nota" />
          <Stack.Screen name="editor/[id]" options={{ presentation: "fullScreenModal" }} />
          <Stack.Screen name="perfil" options={{ presentation: "formSheet" }} />
          <Stack.Screen name="configuracoes" options={{ presentation: "formSheet" }} />
        </Stack>
      </View>

      <MenuDeConta
        aberto={contaAberta}
        aoFechar={() => setContaAberta(false)}
        aoEscolher={(destino) => {
          setContaAberta(false);
          // `.expo/types/router.d.ts` só é regenerado ao rodar `expo start`/build
          // e ainda não conhece `/perfil` e `/configuracoes` (mesmo motivo do
          // cast em `/editor/[id]` no Chat.tsx e no TelaNota.tsx, Task 14).
          if (destino === "perfil") router.push("/perfil" as Href);
          else if (destino === "configuracoes") router.push("/configuracoes" as Href);
          else router.replace("/intro");
        }}
      />
    </SafeAreaView>
  );
}
