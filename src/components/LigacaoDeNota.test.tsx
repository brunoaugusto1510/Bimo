import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolucaoDeLigacao } from "@/lib/ligacoes";
import type { PreviaDeNota } from "@/lib/cliente-de-notas";
import LigacaoDeNota from "./LigacaoDeNota";

const PREVIA: PreviaDeNota = { titulo: "Notas atômicas", pasta: "Método", trecho: "Uma ideia por nota." };

const RESOLVIDA: ResolucaoDeLigacao = { tipo: "resolvida", nota: { id: "7", titulo: "Notas atômicas", pasta: "Método" } };

function montar(
  props: Partial<React.ComponentProps<typeof LigacaoDeNota>> = {},
  resolucao: ResolucaoDeLigacao = RESOLVIDA,
) {
  const aoAbrir = vi.fn();
  const aoCriar = vi.fn();
  const carregarPrevia = vi.fn().mockResolvedValue(PREVIA);
  const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  render(
    <p>
      Veja{" "}
      <LigacaoDeNota
        alvo="Notas atômicas"
        resolucao={resolucao}
        podeCriar
        aoAbrir={aoAbrir}
        aoCriar={aoCriar}
        carregarPrevia={carregarPrevia}
        {...props}
      >
        Notas atômicas
      </LigacaoDeNota>
    </p>,
  );
  return { aoAbrir, aoCriar, carregarPrevia, usuario };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LigacaoDeNota — nota que existe", () => {
  it("é um link; o clique abre a nota na aba atual", async () => {
    const { aoAbrir, usuario } = montar();

    await usuario.click(screen.getByRole("link", { name: "Notas atômicas" }));

    expect(aoAbrir).toHaveBeenCalledExactlyOnceWith("7", { novaAba: false });
  });

  it("Ctrl+clique e Cmd+clique abrem numa aba nova", async () => {
    const { aoAbrir, usuario } = montar();
    const link = screen.getByRole("link", { name: "Notas atômicas" });

    await usuario.keyboard("{Control>}");
    await usuario.click(link);
    await usuario.keyboard("{/Control}{Meta>}");
    await usuario.click(link);
    await usuario.keyboard("{/Meta}");

    expect(aoAbrir).toHaveBeenNthCalledWith(1, "7", { novaAba: true });
    expect(aoAbrir).toHaveBeenNthCalledWith(2, "7", { novaAba: true });
  });

  it("Enter no link focado também abre", async () => {
    const { aoAbrir, usuario } = montar();

    await usuario.tab();
    await usuario.keyboard("{Enter}");

    expect(aoAbrir).toHaveBeenCalledWith("7", { novaAba: false });
  });
});

describe("LigacaoDeNota — título repetido", () => {
  const ambigua: ResolucaoDeLigacao = {
    tipo: "ambigua",
    nota: { id: "7", titulo: "Resumo", pasta: "Leituras" },
    candidatas: [
      { id: "7", titulo: "Resumo", pasta: "Leituras" },
      { id: "8", titulo: "Resumo", pasta: "Projetos" },
    ],
  };

  it("abre a escolhida e avisa quantas notas têm o título", async () => {
    const { aoAbrir, usuario } = montar({}, ambigua);
    const link = screen.getByRole("link", { name: "Notas atômicas" });

    await usuario.click(link);

    expect(aoAbrir).toHaveBeenCalledWith("7", { novaAba: false });
    expect(link).toHaveAttribute("title", "2 notas com este título — abrindo a de Leituras");
  });
});

describe("LigacaoDeNota — nota que ainda não existe", () => {
  const naoResolvida: ResolucaoDeLigacao = { tipo: "nao-resolvida" };

  it("é um botão com aparência de ligação pendente; o clique cria a nota com esse título", async () => {
    const { aoCriar, aoAbrir, usuario } = montar({ alvo: "Fantasma" }, naoResolvida);

    await usuario.click(screen.getByRole("button", { name: "Notas atômicas" }));

    expect(aoCriar).toHaveBeenCalledExactlyOnceWith("Fantasma");
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it("usa só o último pedaço de 'Pasta/Título' como título da nota nova", async () => {
    const { aoCriar, usuario } = montar({ alvo: "Pasta/Fantasma" }, naoResolvida);

    await usuario.click(screen.getByRole("button", { name: "Notas atômicas" }));

    expect(aoCriar).toHaveBeenCalledWith("Fantasma");
  });

  it("sem permissão para criar, o botão fica desabilitado e explica por quê", async () => {
    const { aoCriar, usuario } = montar({ podeCriar: false }, naoResolvida);
    const botao = screen.getByRole("button", { name: "Notas atômicas" });

    await usuario.click(botao);

    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).toHaveAttribute("title", expect.stringMatching(/somente leitura/i));
    expect(aoCriar).not.toHaveBeenCalled();
  });

  it("não mostra prévia: não há nota para mostrar", async () => {
    const { carregarPrevia, usuario } = montar({}, naoResolvida);

    await usuario.hover(screen.getByRole("button", { name: "Notas atômicas" }));
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(carregarPrevia).not.toHaveBeenCalled();
  });
});

describe("LigacaoDeNota — prévia", () => {
  it("aparece depois de 300 ms com o mouse em cima, com título, pasta e trecho", async () => {
    const { carregarPrevia, usuario } = montar();

    await usuario.hover(screen.getByRole("link", { name: "Notas atômicas" }));
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(150));

    const previa = await screen.findByRole("tooltip");
    expect(carregarPrevia).toHaveBeenCalledWith("7");
    expect(previa).toHaveTextContent("Notas atômicas");
    expect(previa).toHaveTextContent("Método");
    expect(previa).toHaveTextContent("Uma ideia por nota.");
  });

  it("não aparece se o mouse sair antes dos 300 ms", async () => {
    const { carregarPrevia, usuario } = montar();
    const link = screen.getByRole("link", { name: "Notas atômicas" });

    await usuario.hover(link);
    await act(() => vi.advanceTimersByTimeAsync(100));
    await usuario.unhover(link);
    await act(() => vi.advanceTimersByTimeAsync(600));

    expect(carregarPrevia).not.toHaveBeenCalled();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("some quando o mouse sai, e liga o link à prévia por aria-describedby enquanto aberta", async () => {
    const { usuario } = montar();
    const link = screen.getByRole("link", { name: "Notas atômicas" });

    await usuario.hover(link);
    await act(() => vi.advanceTimersByTimeAsync(350));
    const previa = await screen.findByRole("tooltip");
    expect(link).toHaveAttribute("aria-describedby", previa.id);

    await usuario.unhover(link);
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(link).not.toHaveAttribute("aria-describedby");
  });

  it("aparece também pelo foco do teclado, e Esc fecha", async () => {
    const { usuario } = montar();

    await usuario.tab();
    await act(() => vi.advanceTimersByTimeAsync(350));
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();

    await usuario.keyboard("{Escape}");

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("deixa o mouse ir do link até a prévia sem fechá-la", async () => {
    const { usuario } = montar();
    const link = screen.getByRole("link", { name: "Notas atômicas" });

    await usuario.hover(link);
    await act(() => vi.advanceTimersByTimeAsync(350));
    const previa = await screen.findByRole("tooltip");
    await usuario.unhover(link);
    await usuario.hover(previa);
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("os botões da prévia abrem a nota, na aba atual ou ao lado", async () => {
    const { aoAbrir, usuario } = montar();
    const link = screen.getByRole("link", { name: "Notas atômicas" });
    const abrirPrevia = async () => {
      await usuario.hover(link);
      await act(() => vi.advanceTimersByTimeAsync(350));
      await screen.findByRole("tooltip");
    };

    await abrirPrevia();
    await usuario.click(screen.getByRole("button", { name: "Abrir ao lado" }));
    // Abrir fecha a prévia: para o segundo botão, ela precisa ser aberta de novo.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await usuario.unhover(link);
    await abrirPrevia();
    await usuario.click(screen.getByRole("button", { name: "Abrir Nota" }));

    expect(aoAbrir).toHaveBeenNthCalledWith(1, "7", { novaAba: true });
    expect(aoAbrir).toHaveBeenNthCalledWith(2, "7", { novaAba: false });
  });

  it("quando a prévia não pode ser carregada, simplesmente não aparece", async () => {
    const { usuario } = montar({ carregarPrevia: vi.fn().mockResolvedValue(null) });

    await usuario.hover(screen.getByRole("link", { name: "Notas atômicas" }));
    await act(() => vi.advanceTimersByTimeAsync(600));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("não mostra uma prévia que chegou depois de o mouse já ter saído", async () => {
    let entregar: (previa: PreviaDeNota) => void = () => {};
    const carregarPrevia = vi.fn().mockReturnValue(new Promise<PreviaDeNota>((resolver) => (entregar = resolver)));
    const { usuario } = montar({ carregarPrevia });
    const link = screen.getByRole("link", { name: "Notas atômicas" });

    await usuario.hover(link);
    await act(() => vi.advanceTimersByTimeAsync(350));
    await usuario.unhover(link);
    await act(() => vi.advanceTimersByTimeAsync(400));
    await act(async () => entregar(PREVIA));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
