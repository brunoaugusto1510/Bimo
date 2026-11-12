import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BarraLateral from "./BarraLateral";
import type { ItemDeNotas } from "@/lib/types";

const ITENS: ItemDeNotas[] = [
  {
    tipo: "pasta",
    nome: "Estudos",
    caminho: "Estudos",
    filhos: [
      {
        tipo: "pasta",
        nome: "Redes",
        caminho: "Estudos/Redes",
        filhos: [
          { tipo: "nota", id: "tcp", nome: "TCP", pasta: "Estudos/Redes" },
          { tipo: "nota", id: "dns", nome: "DNS", pasta: "Estudos/Redes" },
        ],
      },
      { tipo: "nota", id: "algebra", nome: "Álgebra Linear", pasta: "Estudos" },
    ],
  },
  { tipo: "nota", id: "inbox", nome: "Inbox", pasta: null },
];

function renderizar(props: Partial<React.ComponentProps<typeof BarraLateral>> = {}) {
  const aoSelecionar = vi.fn();
  render(
    <BarraLateral itens={ITENS} notaSelecionada={null} onSelecionarNota={aoSelecionar} {...props} />,
  );
  return { aoSelecionar, usuario: userEvent.setup() };
}

describe("BarraLateral", () => {
  it("cria na pasta escolhida e encaminha arrastos para pasta e lixeira", async () => {
    const criar = vi.fn(), mover = vi.fn(), lixeira = vi.fn();
    const { usuario } = renderizar({ aoCriarNaPasta: criar, aoMoverNota: mover, aoEnviarLixeira: lixeira, aoAbrirLixeira: vi.fn() });
    await usuario.click(screen.getByRole("button", { name: "Criar nota em Estudos/Redes" }));
    expect(criar).toHaveBeenCalledWith("Estudos/Redes");
    const dados = new Map<string, string>();
    const dataTransfer = { types: ["application/x-bimo-nota"], setData: (tipo: string, valor: string) => dados.set(tipo, valor), getData: (tipo: string) => dados.get(tipo) ?? "", effectAllowed: "" };
    fireEvent.dragStart(screen.getByRole("button", { name: "Inbox" }), { dataTransfer });
    fireEvent.drop(screen.getByRole("button", { name: /^Redes/ }), { dataTransfer });
    expect(mover).toHaveBeenCalledWith("inbox", "Estudos/Redes");
    fireEvent.drop(screen.getByRole("button", { name: "Abrir lixeira" }), { dataTransfer });
    expect(lixeira).toHaveBeenCalledWith("inbox");
  });
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

  it("avisa a nota clicada, com id e nome", async () => {
    const { usuario, aoSelecionar } = renderizar();

    await usuario.click(screen.getByRole("button", { name: /Inbox/ }));

    expect(aoSelecionar).toHaveBeenCalledExactlyOnceWith({ id: "inbox", nome: "Inbox" });
  });

  it("notas com o mesmo nome em pastas diferentes são notas diferentes, cada uma com o seu id", async () => {
    const itens: ItemDeNotas[] = [
      { tipo: "pasta", nome: "Leituras", caminho: "Leituras", filhos: [{ tipo: "nota", id: "10", nome: "Resumo", pasta: "Leituras" }] },
      { tipo: "pasta", nome: "Projetos", caminho: "Projetos", filhos: [{ tipo: "nota", id: "11", nome: "Resumo", pasta: "Projetos" }] },
    ];
    const { usuario, aoSelecionar } = renderizar({ itens, notaSelecionada: "11" });

    const notas = screen.getAllByRole("button", { name: /Resumo/ });
    await usuario.click(notas[0]);

    expect(notas).toHaveLength(2);
    expect(aoSelecionar).toHaveBeenCalledExactlyOnceWith({ id: "10", nome: "Resumo" });
    expect(notas[1]).toHaveAttribute("aria-current", "true");
  });

  it("marca a nota selecionada com aria-current", () => {
    renderizar({ notaSelecionada: "inbox" });

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

describe("BarraLateral — rastro do Bimo", () => {
  it("diz quais notas o Bimo encontrou, usou ou criou, e destaca a que ele está lendo", () => {
    renderizar({
      marcas: new Map([
        ["inbox", { tipo: "candidata", ativa: false }],
        ["algebra", { tipo: "usada", ativa: true }],
        ["tcp", { tipo: "nova", ativa: false }],
      ]),
    });

    expect(screen.getByRole("button", { name: /^Inbox.*encontrada pelo Bimo$/ })).toBeInTheDocument();
    const lendo = screen.getByRole("button", { name: /^Álgebra Linear.*usada pelo Bimo$/ });
    expect(lendo).toHaveClass("bg-destaque-suave");
    expect(screen.queryByRole("button", { name: /TCP/ })).toBeNull(); // Redes começa fechada
  });

  it("a nota criada leva a etiqueta nova", async () => {
    const { usuario } = renderizar({ marcas: new Map([["tcp", { tipo: "nova", ativa: false }]]) });
    await usuario.click(screen.getByRole("button", { name: /Redes/ }));

    expect(screen.getByRole("button", { name: /^TCP.*criada pelo Bimo$/ })).toHaveTextContent("nova");
  });
});

it("filtra autoria e ordena por data sem perder a estrutura", async () => {
  const itens: ItemDeNotas[] = [{ tipo: "pasta", nome: "P", caminho: "P", filhos: [
    { tipo: "nota", id: "a", nome: "Antiga", pasta: "P", criadoPor: "agente", atualizadoEm: "2024-01-01T00:00:00Z" },
    { tipo: "nota", id: "b", nome: "Nova", pasta: "P", criadoPor: "agente", atualizadoEm: "2025-01-01T00:00:00Z" },
    { tipo: "nota", id: "c", nome: "Minha", pasta: "P", criadoPor: "usuario" },
  ] }];
  const { usuario } = renderizar({ itens });
  await usuario.click(screen.getByRole("button", { name: "Filtrar e organizar" }));
  await usuario.selectOptions(screen.getByLabelText("Mostrar"), "agente");
  await usuario.selectOptions(screen.getByLabelText("Ordenar por"), "recentes");
  expect(screen.queryByRole("button", { name: "Minha" })).not.toBeInTheDocument();
  expect(screen.getByText("2 de 3 notas")).toBeInTheDocument();
  const nomes = screen.getByRole("navigation").querySelectorAll("button");
  expect(Array.from(nomes).map((botao) => botao.textContent)).toEqual(["▾P2 notas", "Nova", "Antiga"]);
  await usuario.type(screen.getByRole("searchbox"), "Antiga");
  expect(screen.queryByRole("button", { name: "Nova" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Antiga" })).toBeInTheDocument();
});
