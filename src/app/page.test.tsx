import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIGURACAO_PADRAO } from "@/lib/fisica-do-grafo";
import { ErroDeConfiguracao } from "@/lib/repositorio-de-notas/config";
import type { DadosDaPagina } from "@/lib/servico-de-notas";

vi.mock("@/lib/repositorio-de-notas", () => ({ obterRepositorio: vi.fn() }));
vi.mock("@/components/AtualizadorDasNotas", () => ({ default: () => null }));
vi.mock("@/lib/servico-de-notas", () => ({ obterDadosDaPagina: vi.fn() }));
/** O grafo desenha num canvas, que o jsdom não tem: a página só precisa saber o que repassa a ele. */
vi.mock("@/components/PaginaPrincipal", () => ({
  default: (props: { itens: unknown[]; aviso?: string }) => (
    <div data-testid="principal" data-itens={props.itens.length} data-aviso={props.aviso ?? ""} />
  ),
}));

import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { obterDadosDaPagina } from "@/lib/servico-de-notas";
import Pagina from "./page";

const DADOS: DadosDaPagina = {
  itens: [{ tipo: "nota", id: "1", nome: "A", pasta: null }],
  grafo: { nos: [], arestas: [], configuracao: CONFIGURACAO_PADRAO },
  aviso: "lista incompleta",
  capacidades: { escrita: true, datas: true },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("página inicial", () => {
  it("entrega as notas e o aviso à interface principal", async () => {
    vi.mocked(obterRepositorio).mockResolvedValue({} as never);
    vi.mocked(obterDadosDaPagina).mockResolvedValue(DADOS);

    render(await Pagina());

    expect(screen.getByTestId("principal")).toHaveAttribute("data-itens", "1");
    expect(screen.getByTestId("principal")).toHaveAttribute("data-aviso", "lista incompleta");
  });

  it("mostra 'falta configurar', com as variáveis, quando a fonte está mal configurada — sem derrubar a página", async () => {
    vi.mocked(obterRepositorio).mockRejectedValue(new ErroDeConfiguracao("Falta DATABASE_URL.", ["DATABASE_URL"]));

    render(await Pagina());

    expect(screen.getByText("Falta DATABASE_URL.")).toBeInTheDocument();
    expect(screen.getByText("DATABASE_URL")).toBeInTheDocument();
    expect(screen.queryByTestId("principal")).not.toBeInTheDocument();
  });

  it("qualquer outro erro também vira a tela de configuração, com a mensagem", async () => {
    vi.mocked(obterRepositorio).mockResolvedValue({} as never);
    vi.mocked(obterDadosDaPagina).mockRejectedValue(new Error("Token sem permissão."));

    render(await Pagina());

    expect(screen.getByText("Token sem permissão.")).toBeInTheDocument();
    expect(screen.queryByTestId("principal")).not.toBeInTheDocument();
  });
});
