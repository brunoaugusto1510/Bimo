import { alternarAltura, alturaMedia, proximaAltura } from "./alturaDaFolha";

describe("proximaAltura", () => {
  it("soma o delta dentro da faixa", () => {
    expect(proximaAltura(300, 50, 100, 800)).toBe(350);
  });

  it("trava no mínimo", () => {
    expect(proximaAltura(120, -200, 100, 800)).toBe(100);
  });

  it("trava no máximo", () => {
    expect(proximaAltura(700, 500, 100, 800)).toBe(800);
  });
});

describe("alturaMedia", () => {
  it("é o ponto médio entre mínimo e máximo", () => {
    expect(alturaMedia(100, 800)).toBe(450);
  });
});

describe("alternarAltura", () => {
  it("sobe para a média quando está no mínimo", () => {
    expect(alternarAltura(100, 100, 800)).toBe(450);
  });

  it("recolhe para o mínimo quando está acima dele", () => {
    expect(alternarAltura(600, 100, 800)).toBe(100);
  });

  it("trata diferença de arredondamento como 'está no mínimo'", () => {
    // A altura vem de medida de layout, então chega com fração; sem a
    // tolerância, 100.4 contaria como "acima do mínimo" e o toque
    // recolheria para 100 em vez de abrir.
    expect(alternarAltura(100.4, 100, 800)).toBe(450);
  });
});
