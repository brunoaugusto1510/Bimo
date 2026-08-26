import { renderHook } from "@testing-library/react-native";
import { useFonts } from "expo-font";
import { useFontes } from "./useFontes";

jest.mock("expo-font", () => ({
  useFonts: jest.fn(),
}));
const useFontsMock = useFonts as jest.Mock;

describe("useFontes", () => {
  it("devolve carregadas=true e erro=null quando o carregamento é bem-sucedido", async () => {
    useFontsMock.mockReturnValue([true, null]);
    const { result } = await renderHook(() => useFontes());
    expect(result.current).toEqual({ carregadas: true, erro: null });
  });

  it("devolve o erro quando o carregamento das fontes falha", async () => {
    const erroDeCarregamento = new Error("falha ao baixar a fonte");
    useFontsMock.mockReturnValue([false, erroDeCarregamento]);
    const { result } = await renderHook(() => useFontes());
    expect(result.current.carregadas).toBe(false);
    expect(result.current.erro).toBe(erroDeCarregamento);
  });
});
