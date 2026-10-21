import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const criarRespostaMock = vi.fn();
vi.mock("../openai", () => ({ criarRespostaOpenAI: (...args: unknown[]) => criarRespostaMock(...args) }));

/** As ferramentas de verdade já têm teste próprio (`ferramentas.test.ts`); aqui só o despacho do laço importa. */
vi.mock("../ferramentas", () => ({
  declaracoesDeFerramentas: [],
  executarFerramenta: vi.fn(),
}));

import { executarFerramenta } from "../ferramentas";
import { responder, type PassoDoServidor } from "../agente";

function turnoDeTexto(texto: string) {
  return { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: texto }] }] };
}

let sequencia = 0;
function turnoComChamada(nome: string, args: Record<string, unknown>, id = `call-${++sequencia}`) {
  return { status: "completed", output: [{ type: "function_call", name: nome, arguments: JSON.stringify(args), call_id: id }] };
}

beforeEach(() => {
  vi.resetAllMocks();
  sequencia = 0;
  vi.stubEnv("OPENAI_API_KEY", "chave-fake-de-teste");
});

afterEach(() => vi.unstubAllEnvs());

describe("responder", () => {
  it("envia o prompt da fonte configurada e passa notaId sem inventar um commit", async () => {
    vi.stubEnv("NOTAS_FONTE", "memoria");
    criarRespostaMock
      .mockResolvedValueOnce(turnoComChamada("criar_nota", { caminho: "Nova.md", conteudo: "# Nova" }))
      .mockResolvedValueOnce(turnoDeTexto("Criei Nova.md."));
    vi.mocked(executarFerramenta).mockResolvedValue({
      resposta: { sucesso: true, caminho: "Nova.md" }, resumo: 'Criou a nota "Nova.md"', notaId: "nota-7",
    });
    const resultado = await responder([{ papel: "usuario", conteudo: "crie uma nota" }]);
    expect(resultado.ferramentas[0]).toMatchObject({ notaId: "nota-7" });
    expect(resultado.ferramentas[0]).not.toHaveProperty("commitUrl");
    expect(criarRespostaMock.mock.calls[0][0].instructions).toMatch(/guardadas no Bimo/);
    expect(criarRespostaMock.mock.calls[0][0].instructions).not.toMatch(/commit|GitHub|vault/i);
  });
  it("lança um erro claro se OPENAI_API_KEY não estiver definida", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(responder([{ papel: "usuario", conteudo: "oi" }])).rejects.toThrow(
      /OPENAI_API_KEY/,
    );
    expect(criarRespostaMock).not.toHaveBeenCalled();
  });

  it("devolve o texto direto quando o modelo não pede ferramentas", async () => {
    criarRespostaMock.mockResolvedValueOnce(turnoDeTexto("Resposta direta."));

    const resultado = await responder([{ papel: "usuario", conteudo: "oi" }]);

    expect(resultado).toEqual({ resposta: "Resposta direta.", ferramentas: [] });
    expect(criarRespostaMock).toHaveBeenCalledTimes(1);
  });

  it("mapeia 'usuario'/'agente' para 'user'/'assistant' no histórico enviado ao Luna", async () => {
    criarRespostaMock.mockResolvedValueOnce(turnoDeTexto("ok"));

    await responder([
      { papel: "usuario", conteudo: "pergunta" },
      { papel: "agente", conteudo: "resposta anterior" },
    ]);

    const { input } = criarRespostaMock.mock.calls[0][0];
    expect(input[0]).toMatchObject({ role: "user" });
    expect(input[1]).toMatchObject({ role: "assistant" });
  });

  it("executa a ferramenta pedida e faz uma segunda volta para a resposta final", async () => {
    criarRespostaMock
      .mockResolvedValueOnce(turnoComChamada("buscar_notas", { consulta: "TCP" }))
      .mockResolvedValueOnce(turnoDeTexto("Resposta final, citando a nota."));

    vi.mocked(executarFerramenta).mockResolvedValue({
      resposta: { encontradas: 1 },
      resumo: 'Buscou "TCP" — 1 nota(s)',
    });

    const resultado = await responder([{ papel: "usuario", conteudo: "o que é TCP?" }]);

    expect(executarFerramenta).toHaveBeenCalledWith("buscar_notas", { consulta: "TCP" }, { leituras: expect.any(Map) });
    expect(criarRespostaMock).toHaveBeenCalledTimes(2);
    expect(resultado.resposta).toBe("Resposta final, citando a nota.");
    expect(resultado.ferramentas).toEqual([
      { nome: "buscar_notas", argumentos: { consulta: "TCP" }, resumo: 'Buscou "TCP" — 1 nota(s)', erro: undefined },
    ]);
  });

  it("registra o uso da ferramenta mesmo quando ela devolve erro, sem interromper o laço", async () => {
    criarRespostaMock
      .mockResolvedValueOnce(turnoComChamada("ler_nota", { caminho: "Não/Existe.md" }))
      .mockResolvedValueOnce(turnoDeTexto("Não encontrei essa nota."));

    vi.mocked(executarFerramenta).mockResolvedValue({
      resposta: { erro: "Nota não encontrada." },
      resumo: "Nota não encontrada: Não/Existe.md",
      erro: true,
    });

    const resultado = await responder([{ papel: "usuario", conteudo: "leia Não/Existe.md" }]);

    expect(resultado.ferramentas[0]?.erro).toBe(true);
    expect(resultado.resposta).toBe("Não encontrei essa nota.");
  });

  it("para depois de MAX_VOLTAS (5) chamadas seguidas e devolve uma mensagem de desistência", async () => {
    criarRespostaMock.mockImplementation(async () => turnoComChamada("buscar_notas", { consulta: "x" }));
    vi.mocked(executarFerramenta).mockResolvedValue({ resposta: {}, resumo: "ok" });

    const resultado = await responder([{ papel: "usuario", conteudo: "pergunta difícil" }]);

    expect(criarRespostaMock).toHaveBeenCalledTimes(5);
    expect(resultado.resposta).toMatch(/não cheguei a uma resposta final/);
    expect(resultado.ferramentas).toHaveLength(5);
  });
});

it("compartilha leituras no laço e isola chamadas de responder", async () => {
  vi.stubEnv("NOTAS_FONTE", "memoria");
  criarRespostaMock.mockResolvedValueOnce(turnoComChamada("ler_nota", { caminho: "TCP" }))
    .mockResolvedValueOnce(turnoComChamada("editar_nota", { caminho: "TCP" }))
    .mockResolvedValueOnce(turnoDeTexto("ok"))
    .mockResolvedValueOnce(turnoComChamada("ler_nota", { caminho: "TCP" }))
    .mockResolvedValueOnce(turnoDeTexto("ok"));
  vi.mocked(executarFerramenta).mockResolvedValue({ resposta: {}, resumo: "ok" });
  await responder([{ papel: "usuario", conteudo: "edite" }]);
  await responder([{ papel: "usuario", conteudo: "leia" }]);
  const chamadas = vi.mocked(executarFerramenta).mock.calls;
  expect(chamadas[0][2]?.leituras).toBeInstanceOf(Map);
  expect(chamadas[0][2]?.leituras).toBe(chamadas[1][2]?.leituras);
  expect(chamadas[0][2]?.leituras).not.toBe(chamadas[2][2]?.leituras);
});

describe("responder com aoPasso", () => {
  const pergunta = [{ papel: "usuario" as const, conteudo: "o que é TCP?" }];

  it("emite cada passo logo após a ferramenta rodar, com os ids e o mesmo objeto de `ferramentas`", async () => {
    criarRespostaMock
      .mockResolvedValueOnce(turnoComChamada("buscar_notas", { consulta: "TCP" }))
      .mockResolvedValueOnce(turnoComChamada("ler_nota", { caminho: "TCP" }, "call-2"))
      .mockResolvedValueOnce(turnoDeTexto("Pronto."));
    vi.mocked(executarFerramenta)
      .mockResolvedValueOnce({ resposta: {}, resumo: "Buscou", ids: ["a", "b"] })
      .mockResolvedValueOnce({ resposta: {}, resumo: "Leu", ids: ["a"] });

    const passos: PassoDoServidor[] = [];
    const resultado = await responder(pergunta, { aoPasso: (passo) => passos.push(passo) });

    expect(passos.map((p) => p.ferramenta.nome)).toEqual(["buscar_notas", "ler_nota"]);
    expect(passos.map((p) => p.ids)).toEqual([["a", "b"], ["a"]]);
    expect(passos[0].ferramenta).toBe(resultado.ferramentas[0]);
    expect(passos[1].ferramenta).toBe(resultado.ferramentas[1]);
  });

  it("emite o passo antes de executar a ferramenta seguinte", async () => {
    criarRespostaMock
      .mockResolvedValueOnce({
        status: "completed",
        output: [
          { type: "function_call", name: "buscar_notas", arguments: '{"consulta":"a"}', call_id: "call-a" },
          { type: "function_call", name: "listar_notas", arguments: "{}", call_id: "call-b" },
        ],
      })
      .mockResolvedValueOnce(turnoDeTexto("ok"));
    const ordem: string[] = [];
    vi.mocked(executarFerramenta).mockImplementation(async (nome) => {
      ordem.push(`exec:${nome}`);
      return { resposta: {}, resumo: nome };
    });

    await responder(pergunta, { aoPasso: (passo) => ordem.push(`passo:${passo.ferramenta.nome}`) });

    expect(ordem).toEqual(["exec:buscar_notas", "passo:buscar_notas", "exec:listar_notas", "passo:listar_notas"]);
  });

  it("passo sem ids na saída da ferramenta leva lista vazia", async () => {
    criarRespostaMock
      .mockResolvedValueOnce(turnoComChamada("listar_notas", {}))
      .mockResolvedValueOnce(turnoDeTexto("ok"));
    vi.mocked(executarFerramenta).mockResolvedValue({ resposta: {}, resumo: "Listou" });
    const aoPasso = vi.fn();

    await responder(pergunta, { aoPasso });

    expect(aoPasso).toHaveBeenCalledWith({ ferramenta: expect.objectContaining({ nome: "listar_notas" }), ids: [] });
  });

  it("o laço segue normalmente quando aoPasso lança", async () => {
    criarRespostaMock
      .mockResolvedValueOnce(turnoComChamada("buscar_notas", { consulta: "TCP" }))
      .mockResolvedValueOnce(turnoDeTexto("Resposta final."));
    vi.mocked(executarFerramenta).mockResolvedValue({ resposta: { ok: true }, resumo: "Buscou" });

    const resultado = await responder(pergunta, { aoPasso: () => { throw new Error("cliente caiu"); } });

    expect(resultado.resposta).toBe("Resposta final.");
    expect(resultado.ferramentas).toHaveLength(1);
  });

  it("não manda os ids ao Luna nem muda o retorno de ferramentas", async () => {
    criarRespostaMock
      .mockResolvedValueOnce(turnoComChamada("buscar_notas", { consulta: "TCP" }))
      .mockResolvedValueOnce(turnoDeTexto("ok"));
    vi.mocked(executarFerramenta).mockResolvedValue({ resposta: { encontradas: 1 }, resumo: "Buscou", ids: ["segredo-id"] });

    const resultado = await responder(pergunta);

    expect(JSON.stringify(criarRespostaMock.mock.calls[1][0].input)).not.toContain("segredo-id");
    expect(resultado.ferramentas[0]).not.toHaveProperty("ids");
  });
});


describe("contrato Responses do Luna", () => {
  const pergunta = [{ papel: "usuario" as const, conteudo: "consulte TCP" }];
  it("preserva raciocínio e correlaciona o resultado pelo call_id sem enviar ids da interface", async () => {
    const raciocinio = { type: "reasoning", id: "rs-1", summary: [], encrypted_content: "opaco" };
    const chamada = turnoComChamada("buscar_notas", { consulta: "TCP", limite: null }, "call-tcp");
    criarRespostaMock.mockResolvedValueOnce({ ...chamada, output: [raciocinio, ...chamada.output] }).mockResolvedValueOnce(turnoDeTexto("ok"));
    vi.mocked(executarFerramenta).mockResolvedValue({ resposta: { encontradas: 1 }, resumo: "Buscou", ids: ["id-interno"] });
    await responder(pergunta);
    const pedido = criarRespostaMock.mock.calls[1][0];
    expect(pedido.input).toContainEqual(raciocinio);
    expect(pedido.input).toContainEqual({ type: "function_call_output", call_id: "call-tcp", output: '{"encontradas":1}' });
    expect(JSON.stringify(pedido.input)).not.toContain("id-interno");
    expect(executarFerramenta).toHaveBeenCalledWith("buscar_notas", { consulta: "TCP" }, { leituras: expect.any(Map) });
  });
  it.each(["incomplete", "failed"])("não executa ferramentas quando o estado é %s", async (status) => {
    criarRespostaMock.mockResolvedValue({ ...turnoComChamada("criar_nota", { caminho: "N.md", conteudo: "x" }), status });
    await expect(responder(pergunta)).rejects.toThrow();
    expect(executarFerramenta).not.toHaveBeenCalled();
  });
  it.each(["{", "[]", "null"])("recusa argumentos inválidos %s antes da ferramenta", async (argumentsTexto) => {
    const turno = turnoComChamada("editar_nota", {});
    turno.output[0].arguments = argumentsTexto;
    criarRespostaMock.mockResolvedValue(turno);
    await expect(responder(pergunta)).rejects.toThrow();
    expect(executarFerramenta).not.toHaveBeenCalled();
  });
  it("não repete uma escrita idêntica mesmo com outro call_id", async () => {
    const args = { caminho: "N.md", conteudo: "acréscimo", modo: "acrescentar" };
    criarRespostaMock.mockResolvedValueOnce(turnoComChamada("editar_nota", args, "a"))
      .mockResolvedValueOnce(turnoComChamada("editar_nota", args, "b"))
      .mockResolvedValueOnce(turnoDeTexto("ok"));
    vi.mocked(executarFerramenta).mockResolvedValue({ resposta: { sucesso: true }, resumo: "Editou", notaId: "n" });
    const aoPasso = vi.fn();
    await responder(pergunta, { aoPasso });
    expect(executarFerramenta).toHaveBeenCalledTimes(1);
    expect(aoPasso).toHaveBeenCalledTimes(1);
  });
  it("não tenta novamente quando a API falha após uma escrita", async () => {
    criarRespostaMock.mockResolvedValueOnce(turnoComChamada("criar_nota", { caminho: "N.md", conteudo: "x" }))
      .mockRejectedValueOnce(new Error("rede"));
    vi.mocked(executarFerramenta).mockResolvedValue({ resposta: { sucesso: true }, resumo: "Criou" });
    await expect(responder(pergunta)).rejects.toThrow();
    expect(executarFerramenta).toHaveBeenCalledTimes(1);
    expect(criarRespostaMock).toHaveBeenCalledTimes(2);
  });
  it("interrompe antes de chamar a API quando o sinal já foi cancelado", async () => {
    const controlador = new AbortController();
    controlador.abort();
    await expect(responder(pergunta, { signal: controlador.signal })).rejects.toThrow();
    expect(criarRespostaMock).not.toHaveBeenCalled();
  });
  it("não expõe recusa como resposta bem sucedida nem executa ferramenta junto dela", async () => {
    criarRespostaMock.mockResolvedValue({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "recusa" }] }] });
    await expect(responder(pergunta)).rejects.toThrow();
    expect(executarFerramenta).not.toHaveBeenCalled();
  });
});


it("interrompe a chamada pendente após 45 segundos sem executar ferramentas tardias", async () => {
  vi.useFakeTimers();
  try {
    criarRespostaMock.mockImplementation((_pedido, sinal: AbortSignal) => new Promise((_resolve, reject) => {
      sinal.addEventListener("abort", () => reject(new Error("cancelado")), { once: true });
    }));
    const resultado = responder([{ papel: "usuario", conteudo: "oi" }]);
    const verificacao = expect(resultado).rejects.toThrow("cancelado");
    await vi.advanceTimersByTimeAsync(45_000);
    await verificacao;
    expect(executarFerramenta).not.toHaveBeenCalled();
    expect(criarRespostaMock).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});

it("não envia ao modelo uma nota que ultrapassa o limite de contexto", async () => {
  criarRespostaMock.mockResolvedValueOnce(turnoComChamada("ler_nota", { caminho: "Grande.md" }));
  vi.mocked(executarFerramenta).mockResolvedValue({ resposta: { conteudo: "x".repeat(200_001) }, resumo: "Leu" });
  await expect(responder([{ papel: "usuario", conteudo: "leia" }])).rejects.toThrow(/contexto/);
  expect(criarRespostaMock).toHaveBeenCalledTimes(1);
});

it("interrompe quando a API repete um call_id já executado", async () => {
  criarRespostaMock.mockResolvedValue(turnoComChamada("editar_nota", { caminho: "N.md", conteudo: "x", modo: "acrescentar" }, "repetido"));
  vi.mocked(executarFerramenta).mockResolvedValue({ resposta: { sucesso: true }, resumo: "Editou" });
  await expect(responder([{ papel: "usuario", conteudo: "acrescente x" }])).rejects.toThrow(/repetiu/);
  expect(executarFerramenta).toHaveBeenCalledTimes(1);
});
