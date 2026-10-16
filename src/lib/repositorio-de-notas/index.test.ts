import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroDeConfiguracao } from "./config";
import { esquecerRepositorioEmCache, obterRepositorio } from "./index";

beforeEach(() => {
  esquecerRepositorioEmCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  esquecerRepositorioEmCache();
});

describe("obterRepositorio", () => {
  it("sem NOTAS_FONTE, entrega o repositório do GitHub, somente leitura", async () => {
    const repo = await obterRepositorio();

    expect(repo.capacidades).toEqual({ escrita: false, datas: false });
  });

  it("com NOTAS_FONTE=memoria, entrega a memória com as notas de exemplo", async () => {
    vi.stubEnv("NOTAS_FONTE", "memoria");

    const repo = await obterRepositorio();

    expect(repo.capacidades.escrita).toBe(true);
    expect((await repo.listarResumos()).length).toBeGreaterThan(0);
  });

  it("devolve a mesma instância enquanto a configuração é a mesma (o cache do serviço depende disso)", async () => {
    vi.stubEnv("NOTAS_FONTE", "memoria");

    expect(await obterRepositorio()).toBe(await obterRepositorio());
  });

  it("troca de repositório quando a configuração muda", async () => {
    const github = await obterRepositorio();
    vi.stubEnv("NOTAS_FONTE", "memoria");

    expect(await obterRepositorio()).not.toBe(github);
  });

  it("propaga a configuração errada como ErroDeConfiguracao, sem tocar no banco", async () => {
    vi.stubEnv("NOTAS_FONTE", "nuvem");

    await expect(obterRepositorio()).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });

  it("o banco ainda não está disponível nesta versão e explica", async () => {
    vi.stubEnv("NOTAS_FONTE", "banco");
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("USER_ID_PADRAO", "0b9f6d0e-3c1a-4f55-9a52-2f6c1f0e7a11");

    await expect(obterRepositorio()).rejects.toThrow(/ainda não está disponível/);
  });
});
