import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConfiguracaoNecessaria from "./ConfiguracaoNecessaria";

describe("ConfiguracaoNecessaria", () => {
  it("mostra a mensagem de erro que explica o problema", () => {
    render(<ConfiguracaoNecessaria mensagem="Falta configurar GITHUB_TOKEN." />);

    expect(screen.getByRole("heading", { name: "Não consegui ler as suas notas" })).toBeInTheDocument();
    expect(screen.getByText("Falta configurar GITHUB_TOKEN.")).toBeInTheDocument();
  });

  it("lista exatamente as variáveis que a fonte configurada pede", () => {
    render(<ConfiguracaoNecessaria mensagem="Falta." variaveis={["DATABASE_URL", "USER_ID_PADRAO"]} />);

    const lista = screen.getByRole("list");
    expect(within(lista).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "DATABASE_URL",
      "USER_ID_PADRAO",
    ]);
  });

  it("sem variáveis específicas, lembra as do repositório do GitHub", () => {
    render(<ConfiguracaoNecessaria mensagem="Erro." />);

    const itens = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(itens.some((texto) => texto.includes("VAULT_REPO"))).toBe(true);
    expect(itens.some((texto) => texto.includes("GITHUB_TOKEN"))).toBe(true);
  });

  it("aponta para o .env e para o .env.example (e não para um .env.local.example que não existe)", () => {
    const { container } = render(<ConfiguracaoNecessaria mensagem="Erro." />);

    expect(container).toHaveTextContent(".env.example");
    expect(container).not.toHaveTextContent(".env.local.example");
  });
});
