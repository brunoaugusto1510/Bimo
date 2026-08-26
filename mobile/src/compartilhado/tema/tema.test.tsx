import { renderHook } from "@testing-library/react-native";
import { useColorScheme } from "react-native";
import { ProvedorDeTema, useTema } from "./index";
import { coresClaro, coresEscuro } from "./tokens/cores";

jest.mock("react-native/Libraries/Utilities/useColorScheme");
const useColorSchemeMock = useColorScheme as jest.Mock;

function envolver({ children }: { children: React.ReactNode }) {
  return <ProvedorDeTema>{children}</ProvedorDeTema>;
}

describe("useTema", () => {
  it("usa a paleta clara quando o sistema está em claro", async () => {
    useColorSchemeMock.mockReturnValue("light");
    const { result } = await renderHook(() => useTema(), { wrapper: envolver });
    expect(result.current.cores.primaria).toBe("#5e4bc0");
  });

  it("usa a paleta escura quando o sistema está em escuro", async () => {
    useColorSchemeMock.mockReturnValue("dark");
    const { result } = await renderHook(() => useTema(), { wrapper: envolver });
    expect(result.current.cores.primaria).toBe("#c9bfff");
  });

  it("mantém as duas paletas com exatamente as mesmas chaves", () => {
    expect(Object.keys(coresClaro).sort()).toEqual(Object.keys(coresEscuro).sort());
  });

  it("expõe as escalas do handoff", async () => {
    useColorSchemeMock.mockReturnValue("light");
    const { result } = await renderHook(() => useTema(), { wrapper: envolver });
    expect(result.current.espacamento.gutter).toBe(16);
    expect(result.current.raios.bolha).toBe(12);
    expect(result.current.tipografia.titleSm.fontWeight).toBe("600");
    expect(result.current.movimento.duracaoLenta).toBe(300);
  });
});
