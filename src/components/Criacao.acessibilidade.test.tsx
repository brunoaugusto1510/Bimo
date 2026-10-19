import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import PaletaIrParaNota from "./PaletaIrParaNota";
import LigacaoDeNota from "./LigacaoDeNota";
import BarraDeAbas from "./BarraDeAbas";
import TelaInicial from "./TelaInicial";

it("paleta mantém foco ao criar e descreve opção, motivo e atalhos", async () => {
 let concluir!: (r: { tipo: "erro"; mensagem: string }) => void;
 render(<PaletaIrParaNota aberta notas={[]} recentes={[]} podeCriar pastaDaCriacao={null} aoAbrir={vi.fn()} aoFechar={vi.fn()}
  aoCriar={() => new Promise((r) => { concluir = r; })} />);
 const campo = screen.getByRole("combobox");
 fireEvent.change(campo, { target: { value: "Nova" } });
 expect(campo).toHaveAccessibleDescription(/Ctrl\+Enter cria a nota «Nova»/);
 const botao = screen.getByRole("button", { name: /Criar nota/ });
 expect(botao).toHaveAttribute("aria-keyshortcuts", "Control+Enter Meta+Enter");
 act(() => botao.focus()); fireEvent.click(botao);
 expect(botao).not.toBeDisabled(); expect(botao).toHaveAttribute("aria-disabled", "true"); expect(botao).toHaveFocus();
 await act(async () => concluir({ tipo: "erro", mensagem: "Sem rede" }));
 expect(screen.getAllByRole("alert")).toHaveLength(1);
 expect(screen.getByRole("alert")).toHaveTextContent("Sem rede");
 expect(screen.getByRole("button", { name: "Fechar a paleta" })).toBeInTheDocument();
});
it("ligação com alias inclui o nome visível, explica recusa e mantém o fluxo em linha", () => {
 render(<LigacaoDeNota alvo="P/Nova" resolucao={{ tipo: "nao-resolvida" }} podeCriar={false} aoAbrir={vi.fn()} aoCriar={vi.fn()} carregarPrevia={async () => null}>Alias</LigacaoDeNota>);
 const botao = screen.getByRole("button", { name: "«Alias» (criar nota)" });
 expect(botao).toHaveAccessibleDescription(/somente leitura/);
 expect(botao.className).toContain("aria-disabled:opacity-50");
 expect(botao.className).not.toContain("min-h-10");
 fireEvent.click(botao);
 expect(screen.getByRole("alert")).toHaveClass("text-erro");
});
it("nova nota fica fixa na faixa de abas e explica somente leitura", () => {
 render(<BarraDeAbas abas={[]} ativa="grafico" aoAtivar={vi.fn()} aoFechar={vi.fn()} aoNovaAba={vi.fn()} aoNovaNota={vi.fn()} criarDisponivel={false} />);
 const botao = screen.getByRole("button", { name: "Nova nota" });
 expect(botao).toHaveAccessibleDescription(/somente leitura/);
 expect(botao).toHaveClass("sticky", "right-0", "aria-disabled:opacity-50");
 expect(botao).not.toHaveAttribute("aria-label");
});
it("tela inicial deixa atalhos fora do nome e descreve a ação indisponível", () => {
 render(<TelaInicial recentes={[]} criarDisponivel={false} aoCriar={vi.fn()} aoIrParaNota={vi.fn()} aoAbrirGrafico={vi.fn()} aoPerguntarAoBimo={vi.fn()} aoAbrirNota={vi.fn()} />);
 const botao = screen.getByRole("button", { name: "Criar nova nota" });
 expect(botao).toHaveAccessibleDescription(/somente leitura/);
 expect(botao).toHaveClass("aria-disabled:opacity-50");
});
