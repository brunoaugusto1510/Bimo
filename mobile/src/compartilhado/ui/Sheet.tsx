import type { ReactNode } from "react";
import { Modal, Pressable } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Vidro } from "./Vidro";
import { Sobrancelha } from "./Sobrancelha";

type Props = { aberta: boolean; aoFechar: () => void; sobrancelha?: string; children: ReactNode };

export function Sheet({ aberta, aoFechar, sobrancelha, children }: Props) {
  const { cores, espacamento, raios, sombras } = useTema();

  if (!aberta) return null;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={aoFechar}>
      <Pressable
        testID="backdrop-da-sheet"
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={aoFechar}
        style={{ flex: 1, backgroundColor: cores.backdrop, justifyContent: "flex-end" }}
      >
        <Pressable testID="guarda-da-sheet" onPress={() => {}}>
          <Vidro
            nivel="folha"
            style={[
              {
                marginHorizontal: espacamento.md,
                marginBottom: 46,
                padding: espacamento.sm,
                borderRadius: raios.folha,
                borderWidth: 1,
                borderColor: cores.fioDeCabelo,
                overflow: "hidden",
              },
              sombras.grande,
            ]}
          >
            {sobrancelha ? <Sobrancelha texto={sobrancelha} /> : null}
            {children}
          </Vidro>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
