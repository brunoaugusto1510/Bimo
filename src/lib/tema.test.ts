import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ATRIBUTO_DO_TEMA,
  CHAVE_DO_TEMA,
  SCRIPT_DO_TEMA,
  aplicarTema,
  lerPreferenciaSalva,
  proximaPreferencia,
  resolverTema,
  salvarPreferencia,
} from "./tema";

function simularSistema(escuro: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((consulta: string) => ({
      matches: escuro && consulta.includes("dark"),
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

const temaNoHtml = () => document.documentElement.getAttribute(ATRIBUTO_DO_TEMA);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(ATRIBUTO_DO_TEMA);
  simularSistema(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolverTema", () => {
  it("claro e escuro valem sempre, não importa o sistema", () => {
    expect(resolverTema("claro", true)).toBe("claro");
    expect(resolverTema("escuro", false)).toBe("escuro");
  });

  it("sistema segue o que o sistema pede", () => {
    expect(resolverTema("sistema", true)).toBe("escuro");
    expect(resolverTema("sistema", false)).toBe("claro");
  });
});

describe("proximaPreferencia", () => {
  it("percorre automático → claro → escuro → automático", () => {
    expect(proximaPreferencia("sistema")).toBe("claro");
    expect(proximaPreferencia("claro")).toBe("escuro");
    expect(proximaPreferencia("escuro")).toBe("sistema");
  });
});

describe("preferência salva", () => {
  it("sem nada salvo, é automático", () => {
    expect(lerPreferenciaSalva()).toBe("sistema");
  });

  it("devolve o que foi salvo, e guarda no localStorage", () => {
    salvarPreferencia("escuro");

    expect(lerPreferenciaSalva()).toBe("escuro");
    expect(localStorage.getItem(CHAVE_DO_TEMA)).toBe("escuro");
  });

  it("ignora lixo no armazenamento e cai em automático", () => {
    localStorage.setItem(CHAVE_DO_TEMA, "roxo");

    expect(lerPreferenciaSalva()).toBe("sistema");
  });

  it("não quebra quando o armazenamento está bloqueado (janela privada, cookies desligados)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });

    expect(() => salvarPreferencia("claro")).not.toThrow();
    // O botão continua funcionando na sessão, mesmo sem conseguir lembrar para a próxima.
    expect(lerPreferenciaSalva()).toBe("claro");
  });

  it("avisa quem está ouvindo (o botão) quando a preferência muda", () => {
    const aoMudar = vi.fn();
    window.addEventListener("bimo:tema", aoMudar);

    salvarPreferencia("claro");

    expect(aoMudar).toHaveBeenCalledOnce();
    window.removeEventListener("bimo:tema", aoMudar);
  });
});

describe("aplicarTema", () => {
  it("escreve o tema resolvido no <html>, que é o que o CSS lê", () => {
    aplicarTema("escuro");

    expect(temaNoHtml()).toBe("escuro");
  });

  it("no automático, usa o tema do sistema", () => {
    simularSistema(true);

    expect(aplicarTema("sistema")).toBe("escuro");
    expect(temaNoHtml()).toBe("escuro");
  });

  it("claro vale mesmo com o sistema escuro", () => {
    simularSistema(true);

    aplicarTema("claro");

    expect(temaNoHtml()).toBe("claro");
  });

  it("sem matchMedia (navegador antigo), o automático vira claro", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(aplicarTema("sistema")).toBe("claro");
  });
});

describe("SCRIPT_DO_TEMA (roda antes da primeira pintura, para a página não piscar no tema errado)", () => {
  const executar = () => new Function(SCRIPT_DO_TEMA)();

  it("aplica a preferência salva", () => {
    localStorage.setItem(CHAVE_DO_TEMA, "escuro");

    executar();

    expect(temaNoHtml()).toBe("escuro");
  });

  it("no automático (ou sem nada salvo), segue o sistema", () => {
    simularSistema(true);
    executar();
    expect(temaNoHtml()).toBe("escuro");

    simularSistema(false);
    executar();
    expect(temaNoHtml()).toBe("claro");
  });

  it("claro salvo vale mesmo com o sistema escuro", () => {
    simularSistema(true);
    localStorage.setItem(CHAVE_DO_TEMA, "claro");

    executar();

    expect(temaNoHtml()).toBe("claro");
  });

  it("concorda com aplicarTema em todos os casos", () => {
    for (const sistemaEscuro of [true, false]) {
      for (const preferencia of ["sistema", "claro", "escuro"] as const) {
        simularSistema(sistemaEscuro);
        localStorage.setItem(CHAVE_DO_TEMA, preferencia);
        executar();
        const doScript = temaNoHtml();

        aplicarTema(preferencia);

        expect(doScript, `${preferencia} / sistema escuro=${sistemaEscuro}`).toBe(temaNoHtml());
      }
    }
  });

  it("não quebra a página se o armazenamento estiver bloqueado", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });

    expect(executar).not.toThrow();
  });
});
