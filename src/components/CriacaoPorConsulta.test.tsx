import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import PaletaIrParaNota from "./PaletaIrParaNota";
import LigacaoDeNota from "./LigacaoDeNota";
it("paleta cria na pasta de destino e bloqueia duplicação; erro preserva consulta", async () => {
 let resolver!: (r: { tipo: "erro"; mensagem: string }) => void;
 const criar = vi.fn(() => new Promise<{ tipo: "erro"; mensagem: string }>((r) => resolver = r));
 render(<PaletaIrParaNota aberta notas={[{ id: "a", titulo: "Nova", pasta: "Outra" }]} recentes={[]} podeCriar pastaDaCriacao="Atual" aoFechar={() => {}} aoAbrir={() => {}} aoCriar={criar} />);
 const campo = screen.getByRole("combobox"); fireEvent.change(campo, { target: { value: "P/Nova" } });
 fireEvent.keyDown(campo, { key: "Enter", metaKey: true }); fireEvent.keyDown(campo, { key: "Enter", metaKey: true });
 expect(criar).toHaveBeenCalledTimes(1); expect(criar).toHaveBeenCalledWith("Nova", "P");
 await act(async () => resolver({ tipo: "erro", mensagem: "Sem rede" }));
 expect(screen.getByRole("alert")).toHaveTextContent("Sem rede"); expect(campo).toHaveValue("P/Nova");
});
it("ligação preserva pasta e modificadores e ignora duplo clique", async () => {
 let concluir!: () => void;
 const criar = vi.fn(() => new Promise<void>((r) => concluir = r));
 render(<LigacaoDeNota alvo="P/x" pastaDeOrigem="Origem" resolucao={{ tipo: "nao-resolvida" }} podeCriar aoAbrir={() => {}} aoCriar={criar} carregarPrevia={async () => null}>x</LigacaoDeNota>);
 const botao = screen.getByRole("button", { name: "Criar a nota «x»" });
 fireEvent.click(botao, { ctrlKey: true }); fireEvent.click(botao);
 expect(criar).toHaveBeenCalledTimes(1); expect(criar).toHaveBeenCalledWith("P/x", "Origem", { novaAba: true }); expect(botao).toHaveAttribute("aria-busy", "true");
 await act(async () => concluir());
});
