import { afterEach, describe, expect, it, vi } from "vitest";
import { aplicarEdicaoNoCampo, planejarInsercaoDeLigacao } from "./insercao-no-editor";

const comandoOriginal = Object.getOwnPropertyDescriptor(document, "execCommand");

afterEach(() => {
  vi.restoreAllMocks();
  if (comandoOriginal) Object.defineProperty(document, "execCommand", comandoOriginal);
  else Reflect.deleteProperty(document, "execCommand");
  document.body.replaceChildren();
});

describe("planejarInsercaoDeLigacao", () => {
  it.each(["", "]]", "]"])("substitui a consulta consumindo o fechamento %j", (fecho) => {
    const texto = `Veja [[con${fecho} depois`;
    const edicao = planejarInsercaoDeLigacao(texto, { inicio: 5 }, 10, "Pasta/Nota");
    expect(edicao).toEqual({ de: 7, ate: 10 + fecho.length, texto: "Pasta/Nota]]", cursor: 19 });
    expect(texto.slice(0, edicao.de) + edicao.texto + texto.slice(edicao.ate)).toBe("Veja [[Pasta/Nota]] depois");
  });

  it("insere depois de [[ com consulta vazia", () => {
    expect(planejarInsercaoDeLigacao("[[", { inicio: 0 }, 2, "Olá😀")).toEqual({
      de: 2, ate: 2, texto: "Olá😀]]", cursor: 9,
    });
  });
});

describe("aplicarEdicaoNoCampo", () => {
  it("não escreve num campo somente leitura (o setRangeText ignoraria o readOnly)", () => {
    const campo = document.createElement("textarea");
    campo.value = "[[abc"; campo.readOnly = true;
    document.body.append(campo);
    aplicarEdicaoNoCampo(campo, { de: 2, ate: 5, texto: "Nota]]", cursor: 8 });
    expect(campo.value).toBe("[[abc");
  });

  it.each([undefined, false, true])("aplica com execCommand retornando %s", (resultado) => {
    const campo = document.createElement("textarea");
    campo.value = "[[abc]] resto";
    document.body.append(campo);
    const eventos = vi.fn();
    document.body.addEventListener("input", eventos, { once: true });
    const substituir = vi.spyOn(campo, "setRangeText");
    const comando = resultado === undefined ? undefined : vi.fn(() => {
      expect(document.activeElement).toBe(campo);
      expect([campo.selectionStart, campo.selectionEnd]).toEqual([2, 7]);
      if (resultado) {
        campo.value = "[[Nota]] resto";
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return resultado;
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: comando });
    aplicarEdicaoNoCampo(campo, { de: 2, ate: 7, texto: "Nota]]", cursor: 8 });
    expect(campo.value).toBe("[[Nota]] resto");
    expect(document.activeElement).toBe(campo);
    expect([campo.selectionStart, campo.selectionEnd]).toEqual([8, 8]);
    expect(eventos).toHaveBeenCalledTimes(1);
    if (comando) expect(comando).toHaveBeenCalledWith("insertText", false, "Nota]]");
    if (resultado) expect(substituir).not.toHaveBeenCalled();
    else expect(substituir).toHaveBeenCalledWith("Nota]]", 2, 7, "end");
  });
});
