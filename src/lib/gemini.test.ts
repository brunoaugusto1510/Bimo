import { afterEach, expect, it, vi } from "vitest";
vi.mock("@google/genai", () => ({ GoogleGenAI: vi.fn(function () { return { models: {} }; }) }));
import { GoogleGenAI } from "@google/genai";
import { criarClienteGemini, MODELO } from "./gemini";
afterEach(() => vi.unstubAllEnvs());
it("recusa chave ausente sem criar cliente", () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  expect(() => criarClienteGemini()).toThrow(/GEMINI_API_KEY não está definida/);
  expect(GoogleGenAI).not.toHaveBeenCalled();
});
it("cria cliente com chave e preserva modelo padrão", () => {
  vi.stubEnv("GEMINI_API_KEY", "teste");
  criarClienteGemini();
  expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: "teste" });
  expect(MODELO).toBe(process.env.GEMINI_MODEL || "gemini-3.5-flash");
});
