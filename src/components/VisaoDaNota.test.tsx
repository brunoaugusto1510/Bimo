import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { criarResolvedor } from "@/lib/ligacoes";
import type { NotaCompleta } from "@/lib/repositorio-de-notas/tipos";
import VisaoDaNota from "./VisaoDaNota";

const NOTA: NotaCompleta = {
  id: "1",
  titulo: "Ler é uma conversa",
  pasta: "Leituras",
  tags: [],
  conteudo: "---\ntags: [leitura, hábitos]\n---\n# Ler é uma conversa\n\nVeja [[Notas atômicas]] e #extra.",
  criadoEm: null,
  atualizadoEm: null,
  revisao: 1,
};

function montar(nota: NotaCompleta = NOTA) {
  const aoAbrirNota = vi.fn();
  const resultado = render(
    <VisaoDaNota
      nota={nota}
      conexoes={3}
      resolver={criarResolvedor([{ id: "2", titulo: "Notas atômicas", pasta: null }])}
      podeCriar={false}
      aoAbrirNota={aoAbrirNota}
      aoCriarNota={vi.fn()}
    />,
  );
  return { ...resultado, aoAbrirNota, usuario: userEvent.setup() };
}

describe("VisaoDaNota", () => {
  it("mostra o título da nota como o título da página", () => {
    montar();

    expect(screen.getAllByRole("heading", { level: 1, name: "Ler é uma conversa" })[0]).toBeInTheDocument();
  });

  it("mostra as propriedades com as tags do frontmatter e do texto", () => {
    montar();

    const propriedades = screen.getByRole("region", { name: "Propriedades" });
    expect(propriedades).toHaveTextContent("#leitura");
    expect(propriedades).toHaveTextContent("#hábitos");
    expect(propriedades).toHaveTextContent("#extra");
    expect(propriedades).toHaveTextContent("Leituras");
  });

  it("junta as tags da própria nota com as do texto, sem repetir", () => {
    montar({ ...NOTA, tags: ["leitura", "meta"] });

    const propriedades = screen.getByRole("region", { name: "Propriedades" });
    expect(propriedades.textContent?.match(/#leitura/g)).toHaveLength(1);
    expect(propriedades).toHaveTextContent("#meta");
  });

  it("o texto traz as ligações clicáveis, que abrem a nota", async () => {
    const { aoAbrirNota, usuario } = montar();

    await usuario.click(screen.getByRole("link", { name: "Notas atômicas" }));

    expect(aoAbrirNota).toHaveBeenCalledWith("2", { novaAba: false });
  });

  it("não repete o frontmatter no texto", () => {
    const { container } = montar();

    expect(container).not.toHaveTextContent("tags: [leitura");
  });
});
