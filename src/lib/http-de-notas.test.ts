import { afterEach, describe, expect, it, vi } from "vitest";
import { ErroDeConfiguracao } from "./repositorio-de-notas/config";
import {
  LIMITE_DO_CORPO_EM_BYTES,
  exigirMesmaOrigem,
  lerJsonComLimite,
  respostaDeErroInterno,
  respostaDeEscrita,
  tratarErroDeRepositorio,
} from "./http-de-notas";
import type { NotaCompleta } from "./repositorio-de-notas/tipos";
import { criarRepositorioEmMemoria } from "./repositorio-de-notas/memoria";
import { contextoComId, pedido as pedidoDeNota, SEGREDO_DE_TESTE } from "@/app/api/notas/apoio-de-teste";

const estadoDaRota = vi.hoisted(() => ({ obterRepositorio: vi.fn() }));
vi.mock("@/lib/repositorio-de-notas", () => estadoDaRota);
import { PATCH } from "@/app/api/notas/[id]/route";

describe("PATCH /api/notas/[id] ao mudar pasta", () => {
  it("devolve a nota e a contagem das outras notas reescritas", async () => {
    vi.stubEnv("SEGREDO_SESSAO", SEGREDO_DE_TESTE);
    try {
      const repo = criarRepositorioEmMemoria([
        { titulo: "Título", pasta: "Pasta" },
        { titulo: "Outra", conteudo: "[[Pasta/Título]]" },
      ]);
      estadoDaRota.obterRepositorio.mockResolvedValue(repo);
      const nota = (await repo.listarResumos()).find((n) => n.titulo === "Título")!;
      const resposta = await PATCH(pedidoDeNota(`/api/notas/${nota.id}`, {
        metodo: "PATCH", corpo: { pasta: "Destino", revisaoBase: nota.revisao, checkpoint: true },
      }), contextoComId(nota.id));

      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toMatchObject({ nota: { id: nota.id, pasta: "Destino" }, notasReescritas: 1 });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

const NOTA: NotaCompleta = {
  id: "1",
  titulo: "A",
  pasta: null,
  tags: [],
  conteudo: "x",
  criadoEm: null,
  atualizadoEm: null,
  revisao: 2,
};

function pedido(
  corpo: BodyInit | null,
  cabecalhos: Record<string, string> = { "content-type": "application/json" },
  metodo = "POST",
): Request {
  return new Request("http://localhost:3000/api/notas", { method: metodo, headers: cabecalhos, body: corpo });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("exigirMesmaOrigem", () => {
  it("deixa passar pedido sem Origin (cliente que não é navegador) e com a mesma origem", () => {
    expect(exigirMesmaOrigem(pedido("{}"))).toBeNull();
    expect(exigirMesmaOrigem(pedido("{}", { origin: "http://localhost:3000" }))).toBeNull();
  });

  it("recusa pedido de outra origem com 403", async () => {
    const recusa = exigirMesmaOrigem(pedido("{}", { origin: "https://site-malicioso.example" }));

    expect(recusa?.status).toBe(403);
    expect(await recusa?.json()).toMatchObject({ erro: expect.stringMatching(/origem/i) });
  });

  it("recusa Origin ilegível e pedido que o navegador marcou como cross-site", () => {
    expect(exigirMesmaOrigem(pedido("{}", { origin: "isso não é url" }))?.status).toBe(403);
    expect(exigirMesmaOrigem(pedido("{}", { "sec-fetch-site": "cross-site" }))?.status).toBe(403);
  });

  it("atrás de proxy, compara com o host que o proxy repassou", () => {
    const atrasDoProxy = pedido("{}", {
      origin: "https://bimo.example.com",
      "x-forwarded-host": "bimo.example.com",
      host: "interno:3000",
    });

    expect(exigirMesmaOrigem(atrasDoProxy)).toBeNull();
  });
});

describe("lerJsonComLimite", () => {
  it("devolve o JSON lido", async () => {
    const resultado = await lerJsonComLimite(pedido(JSON.stringify({ a: 1 })));

    expect(resultado).toEqual({ ok: true, dados: { a: 1 } });
  });

  it("recusa JSON inválido e corpo vazio com 400", async () => {
    const quebrado = await lerJsonComLimite(pedido("{ não é json"));
    const vazio = await lerJsonComLimite(pedido(""));

    expect(!quebrado.ok && quebrado.resposta.status).toBe(400);
    expect(!vazio.ok && vazio.resposta.status).toBe(400);
  });

  it("só aceita o tipo exato application/json, não um texto que o menciona", async () => {
    const disfarcado = await lerJsonComLimite(pedido("{}", { "content-type": "text/plain;x=application/json" }));
    const comCharset = await lerJsonComLimite(pedido("{}", { "content-type": "Application/JSON; charset=utf-8" }));

    expect(!disfarcado.ok && disfarcado.resposta.status).toBe(415);
    expect(comCharset.ok).toBe(true);
  });

  it("recusa Content-Type que não é JSON com 415", async () => {
    const resultado = await lerJsonComLimite(pedido("{}", { "content-type": "text/plain" }));

    expect(!resultado.ok && resultado.resposta.status).toBe(415);
  });

  it("recusa corpo acima de 1 MB com 413, sem depender do Content-Length", async () => {
    const grande = JSON.stringify({ conteudo: "a".repeat(LIMITE_DO_CORPO_EM_BYTES) });

    const resultado = await lerJsonComLimite(pedido(grande));

    expect(!resultado.ok && resultado.resposta.status).toBe(413);
  });

  it("recusa de cara quando o Content-Length já passa do limite", async () => {
    const resultado = await lerJsonComLimite(
      pedido("{}", { "content-type": "application/json", "content-length": String(LIMITE_DO_CORPO_EM_BYTES + 1) }),
    );

    expect(!resultado.ok && resultado.resposta.status).toBe(413);
  });

  it("aceita acentos contando bytes, não caracteres", async () => {
    const quaseNoLimite = JSON.stringify({ t: "é".repeat(LIMITE_DO_CORPO_EM_BYTES / 2 - 20) });

    const resultado = await lerJsonComLimite(pedido(quaseNoLimite));

    expect(resultado.ok).toBe(true);
  });
});

describe("respostaDeEscrita", () => {
  it("ok devolve a nota com o status pedido", async () => {
    const resposta = respostaDeEscrita({ tipo: "ok", nota: NOTA }, 201);

    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toEqual({ nota: NOTA });
  });

  it("repassa as notas reescritas de uma renomeação", async () => {
    const resposta = respostaDeEscrita({ tipo: "ok", nota: NOTA, notasReescritas: 3 });

    expect(await resposta.json()).toEqual({ nota: NOTA, notasReescritas: 3 });
  });

  it("conflito é 409 e leva o que está salvo", async () => {
    const resposta = respostaDeEscrita({ tipo: "conflito", atual: NOTA });

    expect(resposta.status).toBe(409);
    expect(await resposta.json()).toMatchObject({ tipo: "conflito", atual: NOTA });
  });

  it("título em uso é 409 e diz qual nota o usa", async () => {
    const resposta = respostaDeEscrita({ tipo: "titulo-em-uso", idExistente: "7" });

    expect(resposta.status).toBe(409);
    expect(await resposta.json()).toMatchObject({ tipo: "titulo-em-uso", idExistente: "7" });
  });

  it("nao-encontrada é 404 e somente-leitura é 403", async () => {
    expect(respostaDeEscrita({ tipo: "nao-encontrada" }).status).toBe(404);

    const somenteLeitura = respostaDeEscrita({ tipo: "somente-leitura" });
    expect(somenteLeitura.status).toBe(403);
    expect(await somenteLeitura.json()).toMatchObject({ tipo: "somente-leitura" });
  });
});

describe("tratarErroDeRepositorio", () => {
  it("configuração faltando é 503, com a mensagem e as variáveis para a pessoa corrigir", async () => {
    const resposta = tratarErroDeRepositorio(new ErroDeConfiguracao("Falta DATABASE_URL.", ["DATABASE_URL"]), "x");

    expect(resposta.status).toBe(503);
    expect(await resposta.json()).toEqual({ erro: "Falta DATABASE_URL.", variaveis: ["DATABASE_URL"] });
  });

  it("qualquer outro erro é 500 genérico, sem vazar a mensagem interna", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const resposta = tratarErroDeRepositorio(new Error('relation "notas" does not exist'), "GET /api/notas");

    expect(resposta.status).toBe(500);
    expect(JSON.stringify(await resposta.json())).not.toMatch(/relation|notas/);
  });
});

describe("respostaDeErroInterno", () => {
  it("registra o erro detalhado no servidor e devolve só uma mensagem genérica", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    const erro = new Error("segredo interno");

    const resposta = respostaDeErroInterno(erro, "PATCH /api/notas/1");

    expect(registro).toHaveBeenCalledWith("PATCH /api/notas/1:", erro);
    expect(resposta.status).toBe(500);
    expect(JSON.stringify(await resposta.json())).not.toContain("segredo");
  });
});
