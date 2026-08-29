import { createContext, useContext, type ReactNode } from "react";
import type { ServicoIA, ServicoVault } from "./contratos";
import { servicoVaultFake } from "./fake/servicoVaultFake";
import { servicoIaFake } from "./fake/servicoIaFake";

export type Servicos = { vault: ServicoVault; ia: ServicoIA };

const padrao: Servicos = { vault: servicoVaultFake, ia: servicoIaFake };
const ContextoDeServicos = createContext<Servicos>(padrao);

export function ProvedorDeServicos({ children, servicos = padrao }: { children: ReactNode; servicos?: Servicos }) {
  return <ContextoDeServicos.Provider value={servicos}>{children}</ContextoDeServicos.Provider>;
}

export function useServicos(): Servicos {
  return useContext(ContextoDeServicos);
}
