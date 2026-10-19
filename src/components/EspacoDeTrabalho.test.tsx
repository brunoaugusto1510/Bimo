import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ABA_DO_GRAFICO, ESTADO_INICIAL, reduzir, type EstadoDoEspaco } from "@/lib/espaco-de-trabalho/estado";
import EspacoDeTrabalho from "./EspacoDeTrabalho";
import { consultarSemente, semearNota } from "@/lib/cliente-de-notas";

/** Um filho com estado próprio — faz o papel do chat (a conversa) e do grafo (o layout da simulação). */
function Conversa() {
  const [mensagens, setMensagens] = useState(0);
  return (
    <button type="button" onClick={() => setMensagens((n) => n + 1)}>
      mensagens: {mensagens}
    </button>
  );
}

const NOTAS = new Map([["1", { id: "1", titulo: "Ler é uma conversa", pasta: "Leituras" }]]);

function propsBase(estado: EstadoDoEspaco = ESTADO_INICIAL): ComponentProps<typeof EspacoDeTrabalho> {
  return {
    ativo: false,
    estado,
    despachar: vi.fn(),
    notas: NOTAS,
    conexoesPorNota: new Map(),
    totais: { notas: 1, conexoes: 0 },
    aoAbrirNota: vi.fn(),
    aoCriarNota: vi.fn(),
    aoPerguntarAoBimo: vi.fn(),
    aoIrParaNota: vi.fn(),
    children: <Conversa />,
  };
}

describe("EspacoDeTrabalho", () => {
  it("fechar uma aba invalida a semente mesmo com a nota no histórico de outra", async () => {
    const primeira = reduzir(ESTADO_INICIAL, { tipo: "abrir-nota", id: "1" });
    const segunda = reduzir(primeira, { tipo: "abrir-nota", id: "2" });
    const ambas = reduzir(segunda, { tipo: "abrir-nota", id: "1", novaAba: true });
    const nota = { id: "1", titulo: "Ler é uma conversa", conteudo: "", pasta: null, revisao: 1, tags: [], criadoEm: null, atualizadoEm: null };
    render(<EspacoDeTrabalho {...propsBase({ ...ambas, ativa: ABA_DO_GRAFICO })} ativo />);
    semearNota({ nota, capacidades: { escrita: true, datas: true } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Fechar Ler é uma conversa" }));
    expect(consultarSemente("1")).toBeUndefined();
  });
  it("o que está em children continua montado ao alternar entre o modo Bimo e o modo Notas", async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<EspacoDeTrabalho {...propsBase()} />);
    await usuario.click(screen.getByRole("button", { name: /mensagens/ }));
    await usuario.click(screen.getByRole("button", { name: /mensagens/ }));

    rerender(<EspacoDeTrabalho {...propsBase()} ativo />);
    expect(screen.getByRole("button", { name: "mensagens: 2" })).toBeInTheDocument();

    rerender(<EspacoDeTrabalho {...propsBase()} />);
    expect(screen.getByRole("button", { name: "mensagens: 2" })).toBeInTheDocument();
  });

  it("o mesmo vale quando uma aba de nota está por cima e quando ela é fechada", async () => {
    const usuario = userEvent.setup();
    const comNota = reduzir(ESTADO_INICIAL, { tipo: "abrir-nota", id: "1" });
    const { rerender } = render(<EspacoDeTrabalho {...propsBase()} ativo />);
    await usuario.click(screen.getByRole("button", { name: /mensagens/ }));

    rerender(<EspacoDeTrabalho {...propsBase(comNota)} ativo />);
    rerender(<EspacoDeTrabalho {...propsBase({ ...comNota, ativa: ABA_DO_GRAFICO })} ativo />);

    expect(screen.getByRole("button", { name: "mensagens: 1" })).toBeInTheDocument();
  });

  it("no modo Bimo não mostra a barra de abas nem a barra de status", () => {
    render(<EspacoDeTrabalho {...propsBase()} />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("no modo Notas mostra as abas e os totais de notas e conexões", () => {
    render(<EspacoDeTrabalho {...propsBase()} ativo />);

    expect(screen.getByRole("tablist", { name: "Abas abertas" })).toBeInTheDocument();
    expect(screen.getByText("1 nota")).toBeInTheDocument();
    expect(screen.getByText("0 conexões")).toBeInTheDocument();
  });

  it("o conteúdo da aba ativa fica num painel ligado à aba por id", () => {
    const comNota = reduzir(ESTADO_INICIAL, { tipo: "abrir-nota", id: "1" });
    render(<EspacoDeTrabalho {...propsBase({ ...comNota, ativa: ABA_DO_GRAFICO })} ativo />);

    const painel = screen.getByRole("tabpanel");
    expect(painel).toHaveAttribute("id", `painel-${ABA_DO_GRAFICO}`);
    expect(painel).toHaveAttribute("aria-labelledby", `aba-${ABA_DO_GRAFICO}`);
  });
});
