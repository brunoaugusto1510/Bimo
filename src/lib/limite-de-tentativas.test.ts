import { beforeEach, describe, expect, it } from "vitest";
import {
  esquecerTudo,
  limparTentativas,
  registrarFalha,
  verificarLimite,
} from "./limite-de-tentativas";

const IP = "203.0.113.7";
const AGORA = 1_700_000_000_000;

describe("limite-de-tentativas", () => {
  beforeEach(() => {
    esquecerTudo();
  });

  it("libera quem nunca errou", () => {
    expect(verificarLimite(IP, AGORA)).toEqual({ tipo: "liberado" });
  });

  it("libera até a quinta falha", () => {
    for (let i = 0; i < 4; i++) registrarFalha(IP, AGORA);
    expect(verificarLimite(IP, AGORA)).toEqual({ tipo: "liberado" });
  });

  it("bloqueia na quinta falha", () => {
    for (let i = 0; i < 5; i++) registrarFalha(IP, AGORA);

    const resultado = verificarLimite(IP, AGORA);
    expect(resultado.tipo).toBe("bloqueado");
  });

  it("informa quantos segundos faltam para liberar", () => {
    for (let i = 0; i < 5; i++) registrarFalha(IP, AGORA);

    const resultado = verificarLimite(IP, AGORA);
    if (resultado.tipo !== "bloqueado") throw new Error("deveria estar bloqueado");
    expect(resultado.segundosRestantes).toBeGreaterThan(0);
  });

  it("libera de novo depois da janela de 15 minutos", () => {
    for (let i = 0; i < 5; i++) registrarFalha(IP, AGORA);
    const dezesseisMinutos = 16 * 60 * 1000;

    expect(verificarLimite(IP, AGORA + dezesseisMinutos)).toEqual({ tipo: "liberado" });
  });

  it("um login certo zera o contador", () => {
    for (let i = 0; i < 4; i++) registrarFalha(IP, AGORA);
    limparTentativas(IP);

    for (let i = 0; i < 4; i++) registrarFalha(IP, AGORA);
    expect(verificarLimite(IP, AGORA)).toEqual({ tipo: "liberado" });
  });

  it("conta cada IP separadamente", () => {
    for (let i = 0; i < 5; i++) registrarFalha(IP, AGORA);

    expect(verificarLimite("198.51.100.2", AGORA)).toEqual({ tipo: "liberado" });
  });
});
