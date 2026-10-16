import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { criarResolvedor } from "@/lib/ligacoes";
import RenderizadorDeMarkdown from "./RenderizadorDeMarkdown";

const NOTAS = [
  { id: "1", titulo: "Notas atômicas", pasta: "Método" },
  { id: "2", titulo: "A*B*C", pasta: null },
];
const RESOLVER = criarResolvedor(NOTAS);

function montar(conteudo: string, extras: Partial<React.ComponentProps<typeof RenderizadorDeMarkdown>> = {}) {
  const aoAbrirNota = vi.fn();
  const aoCriarNota = vi.fn();
  const resultado = render(
    <RenderizadorDeMarkdown
      conteudo={conteudo}
      resolver={RESOLVER}
      pastaDeOrigem={null}
      podeCriar
      aoAbrirNota={aoAbrirNota}
      aoCriarNota={aoCriarNota}
      carregarPrevia={vi.fn().mockResolvedValue(null)}
      {...extras}
    />,
  );
  return { ...resultado, aoAbrirNota, aoCriarNota, usuario: userEvent.setup() };
}

describe("RenderizadorDeMarkdown", () => {
  it("renderiza o Markdown comum: títulos, listas, citações e tarefas", () => {
    montar("## O hábito\n\n- um\n- dois\n\n> A leitura só termina quando eu respondo.\n\n- [x] feito\n- [ ] por fazer");

    expect(screen.getByRole("heading", { level: 2, name: "O hábito" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("A leitura só termina quando eu respondo.")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("não mostra o frontmatter", () => {
    const { container } = montar("---\ntags: [leitura]\ntitulo: X\n---\n\nTexto da nota.");

    expect(container).toHaveTextContent("Texto da nota.");
    expect(container).not.toHaveTextContent("tags:");
  });

  it("marca os títulos com a linha deles no texto inteiro, frontmatter incluído", () => {
    montar("---\ntags: [a]\n---\n# Um\n\ntexto\n\n## Dois");

    expect(screen.getByRole("heading", { name: "Um" })).toHaveAttribute("data-linha", "4");
    expect(screen.getByRole("heading", { name: "Dois" })).toHaveAttribute("data-linha", "8");
  });

  describe("ligações", () => {
    it("uma ligação para nota que existe é um link que abre a nota", async () => {
      const { aoAbrirNota, usuario } = montar("Veja [[Notas atômicas]] hoje.");

      await usuario.click(screen.getByRole("link", { name: "Notas atômicas" }));

      expect(aoAbrirNota).toHaveBeenCalledWith("1", { novaAba: false });
    });

    it("o apelido é o que aparece, e a nota é a do alvo", async () => {
      const { aoAbrirNota, usuario } = montar("[[Notas atômicas|o método]]");

      await usuario.click(screen.getByRole("link", { name: "o método" }));

      expect(aoAbrirNota).toHaveBeenCalledWith("1", { novaAba: false });
    });

    it("uma ligação sem nota é um botão que cria a nota", async () => {
      const { aoCriarNota, usuario } = montar("Ainda falta [[Zettelkasten]].");

      await usuario.click(screen.getByRole("button", { name: "Zettelkasten" }));

      expect(aoCriarNota).toHaveBeenCalledWith("Zettelkasten");
    });

    it("nomes com asteriscos aparecem como estão escritos e ainda abrem a nota", async () => {
      const { aoAbrirNota, usuario } = montar("[[A*B*C]]");

      await usuario.click(screen.getByRole("link", { name: "A*B*C" }));

      expect(aoAbrirNota).toHaveBeenCalledWith("2", { novaAba: false });
    });

    it("anexos viram um aviso, não um link", () => {
      montar("![[foto.png]]");

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText(/anexo não disponível/i)).toBeInTheDocument();
    });

    it("ligação dentro de código fica como texto", () => {
      const { container } = montar("No código `[[Notas atômicas]]` nada acontece.");

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(within(container.querySelector("code") as HTMLElement).getByText("[[Notas atômicas]]")).toBeInTheDocument();
    });
  });

  describe("segurança", () => {
    it("um link comum para fora abre em outra aba, sem passar o controle da página", () => {
      montar("[o site](https://exemplo.com)");

      const link = screen.getByRole("link", { name: "o site" });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    });

    it("HTML dentro da nota não vira elemento", () => {
      const { container } = montar("antes <script>window.invadido = true</script> <b onclick=\"x()\">negrito</b> depois");

      expect(container.querySelector("script")).toBeNull();
      expect(container.querySelector("b")).toBeNull();
      expect((window as unknown as { invadido?: boolean }).invadido).toBeUndefined();
    });

    it("um link javascript: não é seguido", () => {
      montar("[clique](javascript:alert(1))");

      const link = screen.queryByRole("link", { name: "clique" });
      expect(link?.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
    });
  });
});
