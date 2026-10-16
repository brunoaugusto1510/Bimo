import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AbaDeNota as EstadoDaAba } from "@/lib/espaco-de-trabalho/estado";
import type { PedidoDeNota } from "@/lib/espaco-de-trabalho/usar-nota";
import type { RespostaDeNota } from "@/lib/cliente-de-notas";
import type { LigacoesDaNota } from "@/lib/servico-de-notas";

const hooks = vi.hoisted(() => ({ nota: vi.fn(), ligacoes: vi.fn() }));
vi.mock("@/lib/espaco-de-trabalho/usar-nota", () => ({ useNota: hooks.nota, useLigacoes: hooks.ligacoes }));

import AbaDeNota from "./AbaDeNota";

const NOTAS = new Map([
  ["1", { id: "1", titulo: "Ler é uma conversa", pasta: "Leituras" }],
  ["2", { id: "2", titulo: "Notas atômicas", pasta: "Método" }],
]);

const ABA: EstadoDaAba = { tipo: "nota", chave: "aba-1", historico: { pilha: ["1"], indice: 0 }, modo: "leitura" };

const RESPOSTA: RespostaDeNota = {
  nota: {
    id: "1",
    titulo: "Ler é uma conversa",
    pasta: "Leituras",
    tags: [],
    conteudo: "# Ler é uma conversa\n\nUm texto curto com cinco palavras.\n\n## O hábito\n\nMais texto.",
    criadoEm: null,
    atualizadoEm: null,
    revisao: 1,
  },
  capacidades: { escrita: false, datas: false },
};

const LIGACOES: LigacoesDaNota = {
  ligacoes: {
    saida: [{ tipo: "nota", id: "2", titulo: "Notas atômicas", pasta: "Método", ambigua: false }],
    entrada: [{ id: "2", titulo: "Notas atômicas", pasta: "Método", trecho: "…cada leitura vira um nó…" }],
  },
  mencoesSemLigacao: [],
};

const recarregar = vi.fn();

function pedido<T>(extras: Partial<PedidoDeNota<T>>): PedidoDeNota<T> {
  return { estado: "carregando", recarregar, ...extras };
}

function montar(aba: EstadoDaAba = ABA) {
  const acoes = {
    aoVoltar: vi.fn(),
    aoAvancar: vi.fn(),
    aoAlternarModo: vi.fn(),
    aoAbrirNota: vi.fn(),
    aoCriarNota: vi.fn(),
    aoPerguntarAoBimo: vi.fn(),
  };
  render(<AbaDeNota aba={aba} notas={NOTAS} {...acoes} />);
  return { ...acoes, usuario: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  hooks.nota.mockReturnValue(pedido({ estado: "pronto", dados: RESPOSTA }));
  hooks.ligacoes.mockReturnValue(pedido({ estado: "pronto", dados: LIGACOES }));
});

describe("AbaDeNota", () => {
  it("mostra a nota, o caminho dela e as contagens da barra de status", () => {
    montar();

    expect(screen.getAllByRole("heading", { level: 1, name: "Ler é uma conversa" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Caminho da nota" })).toHaveTextContent("Leituras");
    expect(screen.getByRole("status")).toHaveTextContent("Somente leitura");
    expect(screen.getByText(/\d+ palavras/)).toBeInTheDocument();
    expect(screen.getByText("1 conexão")).toBeInTheDocument();
  });

  it("enquanto a nota carrega, avisa e já mostra o título e a pasta que a barra lateral conhece", () => {
    hooks.nota.mockReturnValue(pedido({ estado: "carregando" }));
    montar();

    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Caminho da nota" })).toHaveTextContent("Ler é uma conversa");
  });

  it("uma nota que não existe mais diz isso, sem oferecer tentar de novo", () => {
    hooks.nota.mockReturnValue(pedido({ estado: "erro", mensagem: "Nota não encontrada.", status: 404 }));
    montar();

    expect(screen.getByText("Esta nota não existe mais.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("uma falha de rede mostra a mensagem e deixa tentar de novo", async () => {
    hooks.nota.mockReturnValue(pedido({ estado: "erro", mensagem: "Não consegui falar com o servidor." }));
    const { usuario } = montar();

    await usuario.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(screen.getByText("Não consegui falar com o servidor.")).toBeInTheDocument();
    expect(recarregar).toHaveBeenCalledOnce();
  });

  it("sessão expirada leva a entrar de novo", () => {
    hooks.nota.mockReturnValue(pedido({ estado: "erro", mensagem: "Sessão inválida ou expirada.", status: 401 }));
    montar();

    expect(screen.getByRole("link", { name: "Entrar de novo" })).toHaveAttribute("href", "/login");
  });

  describe("navegação", () => {
    it("voltar começa desabilitado e avançar também, num histórico de uma nota só", () => {
      montar();

      expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Avançar" })).toBeDisabled();
    });

    it("com histórico, voltar e avançar chamam as ações", async () => {
      const aba: EstadoDaAba = { ...ABA, historico: { pilha: ["2", "1", "2"], indice: 1 } };
      const { aoVoltar, aoAvancar, usuario } = montar(aba);

      await usuario.click(screen.getByRole("button", { name: "Voltar" }));
      await usuario.click(screen.getByRole("button", { name: "Avançar" }));

      expect(aoVoltar).toHaveBeenCalledOnce();
      expect(aoAvancar).toHaveBeenCalledOnce();
    });
  });

  describe("painel lateral", () => {
    it("lista quem cita a nota e abre a citante ao clicar", async () => {
      const { aoAbrirNota, usuario } = montar();
      const entrada = screen.getByRole("region", { name: "Ligações de entrada" });

      await usuario.click(within(entrada).getByRole("button", { name: /Notas atômicas/ }));

      expect(aoAbrirNota).toHaveBeenCalledWith("2", { novaAba: false });
    });

    it("a estrutura lista os títulos e rolar até um deles leva ao título no texto", async () => {
      const { usuario } = montar();
      const estrutura = screen.getByRole("region", { name: "Estrutura" });

      await usuario.click(within(estrutura).getByRole("button", { name: "O hábito" }));

      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it("sem ligações carregadas, a contagem de conexões não aparece", () => {
      hooks.ligacoes.mockReturnValue(pedido({ estado: "carregando" }));
      montar();

      expect(screen.queryByText(/conexã/)).not.toBeInTheDocument();
    });
  });

  it("copiar a ligação da nota põe o [[Título]] na área de transferência (ou o caminho, se o título se repete)", async () => {
    // O `userEvent.setup()` instala a própria área de transferência: a espionagem vem depois dele.
    const { usuario } = montar();
    const escrever = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await usuario.click(screen.getByRole("button", { name: "Mais opções" }));
    await usuario.click(screen.getByRole("menuitem", { name: "Copiar ligação" }));

    expect(escrever).toHaveBeenCalledWith("[[Ler é uma conversa]]");
  });

  it("copiar a ligação de uma nota com título repetido usa o caminho, para a ligação achar a certa", async () => {
    const repetidas = new Map([
      ["1", { id: "1", titulo: "Ler é uma conversa", pasta: "Leituras" }],
      ["9", { id: "9", titulo: "Ler é uma conversa", pasta: "Arquivo" }],
    ]);
    const acoes = {
      aoVoltar: vi.fn(),
      aoAvancar: vi.fn(),
      aoAlternarModo: vi.fn(),
      aoAbrirNota: vi.fn(),
      aoCriarNota: vi.fn(),
      aoPerguntarAoBimo: vi.fn(),
    };
    render(<AbaDeNota aba={ABA} notas={repetidas} {...acoes} />);
    const usuario = userEvent.setup();
    const escrever = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await usuario.click(screen.getByRole("button", { name: "Mais opções" }));
    await usuario.click(screen.getByRole("menuitem", { name: "Copiar ligação" }));

    expect(escrever).toHaveBeenCalledWith("[[Leituras/Ler é uma conversa]]");
  });
});
