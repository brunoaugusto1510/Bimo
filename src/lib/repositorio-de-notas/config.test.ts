import { describe, expect, it } from "vitest";
import { ErroDeConfiguracao, lerConfiguracaoDeNotas } from "./config";

const UUID = "0b9f6d0e-3c1a-4f55-9a52-2f6c1f0e7a11";

function ambiente(variaveis: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...variaveis } as NodeJS.ProcessEnv;
}

function capturar(funcao: () => unknown): ErroDeConfiguracao {
  try {
    funcao();
  } catch (erro) {
    if (erro instanceof ErroDeConfiguracao) return erro;
    throw erro;
  }
  throw new Error("esperava um ErroDeConfiguracao");
}

describe("lerConfiguracaoDeNotas", () => {
  it("sem NOTAS_FONTE, o padrão é o banco e pede as variáveis dele", () => {
    for (const env of [ambiente({}), ambiente({ NOTAS_FONTE: "" })]) {
      expect(capturar(() => lerConfiguracaoDeNotas(env)).variaveis).toEqual(["DATABASE_URL", "USER_ID_PADRAO"]);
    }
    expect(lerConfiguracaoDeNotas(ambiente({ DATABASE_URL: "postgresql://x", USER_ID_PADRAO: UUID }))).toEqual({
      fonte: "banco",
      userId: UUID,
    });
  });

  it("aceita a fonte em qualquer caixa e com espaços", () => {
    expect(lerConfiguracaoDeNotas(ambiente({ NOTAS_FONTE: " MEMORIA " }))).toEqual({ fonte: "memoria" });
  });

  it("recusa uma fonte desconhecida, apontando a variável", () => {
    const erro = capturar(() => lerConfiguracaoDeNotas(ambiente({ NOTAS_FONTE: "nuvem" })));

    expect(erro).toBeInstanceOf(ErroDeConfiguracao);
    expect(erro.variaveis).toEqual(["NOTAS_FONTE"]);
    expect(erro.message).toMatch(/banco.*memoria/);
    expect(erro.message).not.toContain("nuvem");
  });

  it("a fonte github foi removida: erro claro em vez de cair em outra fonte", () => {
    for (const valor of ["github", " GitHub "]) {
      const erro = capturar(() => lerConfiguracaoDeNotas(ambiente({ NOTAS_FONTE: valor })));

      expect(erro.variaveis).toEqual(["NOTAS_FONTE"]);
      expect(erro.message).toMatch(/GitHub.*removida.*banco/i);
    }
  });

  describe("memoria", () => {
    it("vale fora de produção", () => {
      expect(lerConfiguracaoDeNotas(ambiente({ NOTAS_FONTE: "memoria" }))).toEqual({ fonte: "memoria" });
    });

    it("é recusada em produção: perderia tudo a cada reinício", () => {
      const erro = capturar(() => lerConfiguracaoDeNotas(ambiente({ NOTAS_FONTE: "memoria", NODE_ENV: "production" })));

      expect(erro.variaveis).toEqual(["NOTAS_FONTE"]);
      expect(erro.message).toMatch(/produção/);
    });
  });

  describe("banco", () => {
    it("pede DATABASE_URL e USER_ID_PADRAO", () => {
      const erro = capturar(() => lerConfiguracaoDeNotas(ambiente({ NOTAS_FONTE: "banco" })));

      expect(erro.variaveis).toEqual(["DATABASE_URL", "USER_ID_PADRAO"]);
    });

    it("recusa um USER_ID_PADRAO que não é UUID", () => {
      const erro = capturar(() =>
        lerConfiguracaoDeNotas(ambiente({ NOTAS_FONTE: "banco", DATABASE_URL: "postgresql://x", USER_ID_PADRAO: "abc" })),
      );

      expect(erro.variaveis).toEqual(["USER_ID_PADRAO"]);
    });

    it("com tudo certo devolve o usuário dono das notas", () => {
      const config = lerConfiguracaoDeNotas(
        ambiente({ NOTAS_FONTE: "banco", DATABASE_URL: "postgresql://x", USER_ID_PADRAO: UUID }),
      );

      expect(config).toEqual({ fonte: "banco", userId: UUID });
    });
  });
});
