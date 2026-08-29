import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { coresClaro, coresEscuro, type Cores } from "./tokens/cores";
import { sombrasClaro, sombrasEscuro, type Sombras } from "./tokens/sombras";
import { tipografia, type Tipografia } from "./tokens/tipografia";
import { espacamento, type Espacamento } from "./tokens/espacamento";
import { raios, type Raios } from "./tokens/raios";
import { movimento, type Movimento } from "./tokens/movimento";

export type Tema = {
  cores: Cores;
  sombras: Sombras;
  tipografia: Tipografia;
  espacamento: Espacamento;
  raios: Raios;
  movimento: Movimento;
  escuro: boolean;
};

const ContextoDeTema = createContext<Tema | null>(null);

export function ProvedorDeTema({ children }: { children: ReactNode }) {
  const esquema = useColorScheme();
  const escuro = esquema === "dark";

  const tema = useMemo<Tema>(
    () => ({
      cores: escuro ? coresEscuro : coresClaro,
      sombras: escuro ? sombrasEscuro : sombrasClaro,
      tipografia,
      espacamento,
      raios,
      movimento,
      escuro,
    }),
    [escuro],
  );

  return <ContextoDeTema.Provider value={tema}>{children}</ContextoDeTema.Provider>;
}

export function useTema(): Tema {
  const tema = useContext(ContextoDeTema);
  if (!tema) throw new Error("useTema precisa estar dentro de ProvedorDeTema");
  return tema;
}
