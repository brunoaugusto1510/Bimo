import { View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Pill } from "./Pill";

export type Destino = "bimo" | "nota";

const ROTULOS: Record<Destino, string> = { bimo: "Bimo", nota: "Nota" };

export function TabSwitcher({ ativo, aoTrocar }: { ativo: Destino; aoTrocar: (destino: Destino) => void }) {
  const { cores, espacamento, raios } = useTema();

  return (
    <View
      style={{
        flexDirection: "row",
        gap: espacamento.xs,
        padding: 4,
        borderRadius: raios.pill,
        backgroundColor: cores.superficieContainerBaixa,
        borderWidth: 1,
        borderColor: cores.fioDeCabelo,
      }}
    >
      {(Object.keys(ROTULOS) as Destino[]).map((destino) => (
        <Pill
          key={destino}
          rotulo={ROTULOS[destino]}
          ativo={destino === ativo}
          aoTocar={() => {
            if (destino !== ativo) aoTrocar(destino);
          }}
        />
      ))}
    </View>
  );
}
