import { act, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import AtualizadorDasNotas from "./AtualizadorDasNotas";
it("criação força outra busca depois do voo antigo e repassa o instante inicial", async () => {
 let resolver!: (r: Response) => void;
 const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((r) => resolver = r)).mockResolvedValue(Response.json({ itens: [] }));
 vi.stubGlobal("fetch", fetch); const callback = vi.fn(); const tela = render(<AtualizadorDasNotas aoAtualizar={callback} />);
 await act(async () => window.dispatchEvent(new Event("bimo:nota-salva")));
 await act(async () => window.dispatchEvent(new Event("bimo:nota-criada")));
 expect(fetch).toHaveBeenCalledTimes(1);
 await act(async () => { resolver(Response.json({ itens: [] })); });
 expect(fetch).toHaveBeenCalledTimes(2); expect(callback.mock.calls[0][1]).toEqual(expect.any(Number));
 tela.unmount(); vi.unstubAllGlobals();
});
