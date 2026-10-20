import { GoogleGenAI } from "@google/genai";

export const MODELO = process.env.GEMINI_MODEL || "gemini-3.5-flash";

export function criarClienteGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não está definida. Pegue uma chave em https://aistudio.google.com/apikey e coloque no .env.local",
    );
  }
  return new GoogleGenAI({ apiKey });
}
