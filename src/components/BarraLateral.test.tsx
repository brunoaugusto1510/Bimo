import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BarraLateral from "./BarraLateral";
import type { ItemVault } from "@/lib/types";

const ITENS: ItemVault[] = [
  {
    tipo: "pasta",
    nome: "Estudos",
    filhos: [
      {
        tipo: "pasta",
        nome: "Redes",
        filhos: [
          { tipo: "nota", nome: "TCP", caminho: "Estudos/Redes/TCP.md" },
          { tipo: "nota", nome: "DNS", caminho: "Estudos/Redes/DNS.md" },
        ],
      },
      { tipo: "nota", nome: "Álgebra Linear", caminho: "Estudos/Álgebra Linear.md" },
    ],
  },
  { tipo: "nota", nome: "Inbox", caminho: "Inbox.md" },
];

function renderizar(props: Partial<React.ComponentProps<typeof BarraLateral>> = {}) {
  const aoSelecionar = vi.fn();
  render(
    <BarraLateral itens={ITENS} notaSelecionada={null} onSelecionarNota={aoSelecionar} {...props} />,
  );
  return { aoSelecionar, usuario: userEvent.setup() };
}

describe("BarraLateral", () => {
  it("mostra o rótulo da seção e o total de notas", () => {
    renderizar();

    expect(screen.getByText("Estrutura das notas")).toBeInTheDocument();
    expect(screen.getByText("4 notas")).toBeInTheDocument();
  });

  it("não usa mais a palavra 'vault' em lugar nenhum da interface, nem em rótulos de acessibilidade", () => {
    const { container } = render(
      <BarraLateral itens={ITENS} notaSelecionada={null} onSelecionarNota={() => {}} />,
    );

    // As notas passam a viver no banco do Bimo: "vault" (o repositório do Obsidian) saiu do vocabulário.
    expect(container).not.toHaveTextContent(/vault/i);
    expect(screen.queryByPlaceholderText(/vault/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/vault/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/exemplo/i)).not.toBeInTheDocument();
  });

  it("começa com as pastas de primeiro nível abertas e as de dentro fechadas", () => {
    renderizar();

    expect(screen.getByRole("button", { name: /Estudos/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Redes/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("TCP")).not.toBeInTheDocument();
  });

  it("abre e fecha uma pasta ao clicar nela", async () => {
    const { usuario } = renderizar();

    await usuario.click(screen.getByRole("button", { name: /Redes/ }));
    expect(screen.getByText("TCP")).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /Redes/ }));
    expect(screen.queryByText("TCP")).not.toBeInTheDocument();
  });

  it("avisa a nota clicada, com caminho e nome", async () => {
    const { usuario, aoSelecionar } = renderizar();

    await usuario.click(screen.getByRole("button", { name: /Inbox/ }));

    expect(aoSelecionar).toHaveBeenCalledExactlyOnceWith({ caminho: "Inbox.md", nome: "Inbox" });
  });

  it("marca a nota selecionada com aria-current", () => {
    renderizar({ notaSelecionada: "Inbox.md" });

    expect(screen.getByRole("button", { name: /Inbox/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /Álgebra Linear/ })).not.toHaveAttribute("aria-current");
  });

  describe("busca", () => {
    it("filtra as notas e abre as pastas que contêm o resultado", async () => {
      const { usuario } = renderizar();

      await usuario.type(screen.getByRole("searchbox", { name: "Buscar nas notas" }), "tcp");

      // "Redes" estava fechada, mas o resultado mora nela — então abre sozinha.
      expect(screen.getByText("TCP")).toBeInTheDocument();
      expect(screen.queryByText("DNS")).not.toBeInTheDocument();
      expect(screen.queryByText("Inbox")).not.toBeInTheDocument();
    });

    it("mostra quantas notas casaram do total", async () => {
      const { usuario } = renderizar();

      await usuario.type(screen.getByRole("searchbox", { name: "Buscar nas notas" }), "redes");

      expect(screen.getByText("2 de 4 notas")).toBeInTheDocument();
    });

    it("ignora acentos ao buscar", async () => {
      const { usuario } = renderizar();

      await usuario.type(screen.getByRole("searchbox", { name: "Buscar nas notas" }), "algebra");

      expect(screen.getByText("Álgebra Linear")).toBeInTheDocument();
    });

    it("avisa quando nada casa", async () => {
      const { usuario } = renderizar();

      await usuario.type(screen.getByRole("searchbox", { name: "Buscar nas notas" }), "zzz");

      expect(screen.getByText(/Nenhuma nota encontrada/)).toBeInTheDocument();
    });

    it("volta à árvore completa quando a busca é apagada", async () => {
      const { usuario } = renderizar();
      const campo = screen.getByRole("searchbox", { name: "Buscar nas notas" });

      await usuario.type(campo, "tcp");
      await usuario.clear(campo);

      expect(screen.getByText("4 notas")).toBeInTheDocument();
      expect(screen.getByText("Inbox")).toBeInTheDocument();
    });
  });
});
