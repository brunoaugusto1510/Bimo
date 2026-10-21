import { describe, expect, it } from "vitest";
import { iniciarRastro, quadroDoRastro, registrarPasso } from "./rastro-do-agente";
import { aplicarRealce, DURACAO_DO_REALCE_MS, SAIDA_DO_REALCE_MS } from "./realce-no-grafo";

describe("aplicarRealce", () => {
  const vazio = quadroDoRastro(null, 0);

  it("devolve o mesmo quadro sem realce ou fora da janela", () => {
    expect(aplicarRealce(vazio, null, 100)).toBe(vazio);
    expect(aplicarRealce(vazio, { id: "a", em: 500 }, 100)).toBe(vazio);
    expect(aplicarRealce(vazio, { id: "a", em: 0 }, DURACAO_DO_REALCE_MS)).toBe(vazio);
  });

  it("acende a nota pedida como lida agora, sem mexer no quadro original", () => {
    const realcado = aplicarRealce(vazio, { id: "a", em: 100 }, 200);
    expect(realcado.notas.get("a")).toEqual({ estado: "lendo", intensidade: 1, desde: 100 });
    expect(realcado.foco).toBe(vazio.foco);
    expect(vazio.notas.size).toBe(0);
  });

  it("apaga aos poucos no fim da janela", () => {
    const quase = DURACAO_DO_REALCE_MS - SAIDA_DO_REALCE_MS / 2;
    expect(aplicarRealce(vazio, { id: "a", em: 0 }, quase).notas.get("a")?.intensidade).toBeCloseTo(0.5);
    expect(aplicarRealce(vazio, { id: "a", em: 0 }, DURACAO_DO_REALCE_MS - 1).notas.get("a")?.intensidade).toBeGreaterThan(0);
  });

  it("mantém o resto do rastro", () => {
    const rastro = registrarPasso(iniciarRastro(0), { tipo: "leitura", id: "b" }, 10);
    const quadro = quadroDoRastro(rastro, 50);
    const realcado = aplicarRealce(quadro, { id: "a", em: 20 }, 50);
    expect(realcado.notas.get("b")).toEqual(quadro.notas.get("b"));
    expect(realcado.segmentos).toBe(quadro.segmentos);
  });
});
