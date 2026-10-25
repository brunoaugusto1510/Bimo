// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const depois = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after: depois }));
vi.mock("server-only", () => ({}));
import { agendarManutencaoWiki, esquecerRodadasDaWiki } from "./agendar";

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  esquecerRodadasDaWiki(); depois.mockReset();
  vi.stubEnv("WIKI_VIVA_ATIVA", "1"); vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "1"); vi.stubEnv("OPENAI_API_KEY", "falsa");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it("não agenda nada com a automação desligada ou sem chave", () => {
  vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "0"); agendarManutencaoWiki();
  vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "1"); vi.stubEnv("OPENAI_API_KEY", ""); agendarManutencaoWiki();
  expect(depois).not.toHaveBeenCalled();
});

it("uma rajada de autosaves agenda uma rodada só e bloqueia por 30 segundos", () => {
  for (let i = 0; i < 10; i++) agendarManutencaoWiki();
  expect(depois).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(29_000); agendarManutencaoWiki();
  expect(depois).toHaveBeenCalledTimes(1);
});

it("depois que a rodada termina e passam 30 segundos, uma nova é agendada", async () => {
  let tarefa!: () => Promise<void>;
  depois.mockImplementation((t: () => Promise<void>) => { tarefa = t; });
  const registro = vi.spyOn(console, "error").mockImplementation(() => {});
  agendarManutencaoWiki();
  // A rodada falha (sem banco configurado no teste) e libera o limitador no finally, registrando só a categoria.
  await tarefa();
  expect(registro).toHaveBeenCalledWith(expect.stringContaining("[wiki]"), { erro: expect.any(String) });
  registro.mockRestore();
  vi.advanceTimersByTime(31_000); agendarManutencaoWiki();
  expect(depois).toHaveBeenCalledTimes(2);
});

it("não sobrepõe uma rodada em andamento, mesmo passado o intervalo", () => {
  // A tarefa nunca termina: a rodada continua em andamento quando o intervalo já passou.
  depois.mockImplementation(() => {});
  agendarManutencaoWiki();
  vi.advanceTimersByTime(60_000); agendarManutencaoWiki();
  expect(depois).toHaveBeenCalledTimes(1);
});

it("sem contexto HTTP não consome o intervalo", () => {
  depois.mockImplementationOnce(() => { throw new Error("fora de uma requisição"); });
  agendarManutencaoWiki();
  agendarManutencaoWiki();
  expect(depois).toHaveBeenCalledTimes(2);
});
