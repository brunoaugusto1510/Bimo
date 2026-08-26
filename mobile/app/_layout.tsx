import { Stack } from "expo-router";
import { ProvedorDeTema } from "@/compartilhado/tema";

export default function LayoutRaiz() {
  return (
    <ProvedorDeTema>
      <Stack screenOptions={{ headerShown: false }} />
    </ProvedorDeTema>
  );
}
