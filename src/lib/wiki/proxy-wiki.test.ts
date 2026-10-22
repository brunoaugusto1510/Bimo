// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

const segredo = "segredo-falso-do-executor-com-mais-de-32-caracteres";
afterEach(() => vi.unstubAllEnvs());
it("o segredo do executor só libera POST no endpoint exato de manutenção", () => {
  vi.stubEnv("SEGREDO_SESSAO", "segredo-de-sessao-falso-com-mais-de-32-caracteres");
  vi.stubEnv("WIKI_EXECUTOR_SEGREDO", segredo);
  for (const [caminho, metodo, permitido] of [["/api/wiki/processar", "POST", true], ["/api/wiki/processar", "GET", false],
    ["/api/notas", "POST", false], ["/api/wiki/gerenciamento", "POST", false]] as const) {
    const r = proxy(new NextRequest(`https://bimo.local${caminho}`, { method: metodo, headers: { authorization: `Bearer ${segredo}` } }));
    expect(r.headers.get("x-middleware-next") === "1").toBe(permitido);
    if (!permitido) expect(r.status).toBe(401);
  }
});
