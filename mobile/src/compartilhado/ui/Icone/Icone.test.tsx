import { render, screen } from "@testing-library/react-native";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { Icone } from "./index";
import { codepoints } from "./codepoints";

async function renderizar(elemento: React.ReactElement) {
  return render(<ProvedorDeTema>{elemento}</ProvedorDeTema>);
}

describe("Icone", () => {
  it("renderiza o glifo correspondente ao nome", async () => {
    await renderizar(<Icone nome="psychology" tamanho={22} testID="icone" />);
    expect(screen.getByTestId("icone")).toHaveTextContent(codepoints.psychology);
  });

  it("usa a família preenchida quando preenchido", async () => {
    await renderizar(<Icone nome="folder" tamanho={16} preenchido testID="icone" />);
    expect(screen.getByTestId("icone")).toHaveStyle({ fontFamily: "MaterialSymbolsRounded-Fill" });
  });

  it("usa a família contornada por padrão", async () => {
    await renderizar(<Icone nome="folder" tamanho={16} testID="icone" />);
    expect(screen.getByTestId("icone")).toHaveStyle({ fontFamily: "MaterialSymbolsOutlined" });
  });

  it("cobre os 23 glifos que o design usa", () => {
    expect(Object.keys(codepoints)).toHaveLength(23);
  });
});
