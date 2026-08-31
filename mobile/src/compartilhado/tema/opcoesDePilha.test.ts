import { coresClaro, coresEscuro } from "./tokens/cores";
import { opcoesDePilha } from "./opcoesDePilha";

describe("opcoesDePilha", () => {
  it("pinta o fundo da tela com o fundo do tema claro", () => {
    expect(opcoesDePilha(coresClaro).contentStyle).toEqual({ backgroundColor: coresClaro.fundo });
  });

  // Sem isto, o `DefaultTheme` que o expo-router embute pintava toda tela com
  // `rgb(242, 242, 242)`. No tema escuro sobrava um miolo branco sob o
  // `SafeAreaView` escuro, e os vidros translucidos (`vidroBolha`, `vidroDock`)
  // eram compostos sobre branco — liam como retangulos claros.
  it("pinta o fundo da tela com o fundo do tema escuro", () => {
    expect(opcoesDePilha(coresEscuro).contentStyle).toEqual({ backgroundColor: coresEscuro.fundo });
  });

  it("mantem o cabecalho nativo desligado", () => {
    expect(opcoesDePilha(coresEscuro).headerShown).toBe(false);
  });
});
