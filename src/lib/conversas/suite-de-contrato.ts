/**
 * O que todo repositório de conversas precisa cumprir. Cada implementação
 * (memória, banco) roda esta suíte, para as duas se comportarem igual.
 */

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Mensagem } from "../types";
import {
  ErroDeConversa,
  LIMITE_DE_MENSAGENS_ABERTAS,
  MAXIMO_DE_CARACTERES_DO_TITULO,
  MAXIMO_DE_MENSAGENS_POR_PEDIDO,
  type RepositorioDeConversas,
} from "./tipos";

export function mensagem(papel: Mensagem["papel"], conteudo: string, extras: Partial<Mensagem> = {}): Mensagem {
  return { id: randomUUID(), papel, conteudo, ...extras };
}

/** `fabrica` devolve um repositório vazio e, quando a implementação tem donos, um segundo repositório de outra pessoa. */
export function executarContratoDoRepositorioDeConversas(
  nome: string,
  fabrica: () => Promise<{ repo: RepositorioDeConversas; outraPessoa: RepositorioDeConversas }>,
) {
  describe(`contrato do repositório de conversas (${nome})`, () => {
    it("cria a conversa na primeira mensagem, com o título da primeira pergunta", async () => {
      const { repo } = await fabrica();
      const id = randomUUID();

      const resumo = await repo.acrescentar(id, [mensagem("usuario", "  O que eu sei\nsobre redes?  ")]);

      expect(resumo).toMatchObject({ id, titulo: "O que eu sei sobre redes?" });
      expect(Number.isNaN(Date.parse(resumo.atualizadaEm))).toBe(false);
    });

    it("corta um título longo e termina com reticências", async () => {
      const { repo } = await fabrica();

      const resumo = await repo.acrescentar(randomUUID(), [mensagem("usuario", "a".repeat(300))]);

      expect(resumo.titulo).toHaveLength(MAXIMO_DE_CARACTERES_DO_TITULO);
      expect(resumo.titulo.endsWith("…")).toBe(true);
    });

    it("devolve as mensagens na ordem em que foram acrescentadas, com ferramentas e fontes", async () => {
      const { repo } = await fabrica();
      const id = randomUUID();
      const pergunta = mensagem("usuario", "Resume as notas de TCP");
      const resposta = mensagem("agente", "Aqui está.", {
        ferramentas: [{ nome: "ler_nota", argumentos: { caminho: "Redes/TCP", conteudo: "texto enorme da nota" }, resumo: "Leu Redes/TCP", notaId: "42" }],
        fontes: [{ id: "42", titulo: "TCP" }],
      });

      await repo.acrescentar(id, [pergunta]);
      await repo.acrescentar(id, [resposta]);
      const conversa = await repo.obter(id);

      expect(conversa?.mensagens.map((m) => m.id)).toEqual([pergunta.id, resposta.id]);
      expect(conversa?.mensagens[1]).toEqual({
        id: resposta.id,
        papel: "agente",
        conteudo: "Aqui está.",
        // Os argumentos não ficam guardados: só o caminho, que a tela usa para o "Abrir".
        ferramentas: [{ nome: "ler_nota", argumentos: { caminho: "Redes/TCP" }, resumo: "Leu Redes/TCP", notaId: "42" }],
        fontes: [{ id: "42", titulo: "TCP" }],
      });
    });

    it("repetir uma mensagem não duplica nem muda o título", async () => {
      const { repo } = await fabrica();
      const id = randomUUID();
      const pergunta = mensagem("usuario", "Primeira pergunta");

      await repo.acrescentar(id, [pergunta]);
      await repo.acrescentar(id, [pergunta, mensagem("agente", "Resposta")]);
      await repo.acrescentar(id, [mensagem("usuario", "Outra pergunta")]);
      const conversa = await repo.obter(id);

      expect(conversa?.mensagens).toHaveLength(3);
      expect(conversa?.conversa.titulo).toBe("Primeira pergunta");
    });

    it("lista a conversa que mexeu por último primeiro", async () => {
      const { repo } = await fabrica();
      const antiga = randomUUID();
      const recente = randomUUID();

      await repo.acrescentar(antiga, [mensagem("usuario", "Antiga")]);
      await repo.acrescentar(recente, [mensagem("usuario", "Recente")]);
      await repo.acrescentar(antiga, [mensagem("agente", "Resposta tardia")]);

      expect((await repo.listar()).map((c) => c.id)).toEqual([antiga, recente]);
    });

    it("respeita o limite da lista", async () => {
      const { repo } = await fabrica();
      for (let i = 0; i < 3; i++) await repo.acrescentar(randomUUID(), [mensagem("usuario", `Conversa ${i}`)]);

      expect(await repo.listar(2)).toHaveLength(2);
    });

    it("ao reabrir devolve só as mensagens mais recentes, em ordem", async () => {
      const { repo } = await fabrica();
      const id = randomUUID();
      const todas = Array.from({ length: LIMITE_DE_MENSAGENS_ABERTAS + 5 }, (_, i) => mensagem(i % 2 === 0 ? "usuario" : "agente", `Mensagem ${i}`));
      for (let i = 0; i < todas.length; i += MAXIMO_DE_MENSAGENS_POR_PEDIDO) {
        await repo.acrescentar(id, todas.slice(i, i + MAXIMO_DE_MENSAGENS_POR_PEDIDO));
      }

      const conversa = await repo.obter(id);

      expect(conversa?.mensagens.map((m) => m.id)).toEqual(todas.slice(-LIMITE_DE_MENSAGENS_ABERTAS).map((m) => m.id));
    }, 30_000);

    it("obter uma conversa que não existe devolve null", async () => {
      const { repo } = await fabrica();

      expect(await repo.obter(randomUUID())).toBeNull();
    });

    it("excluir apaga a conversa e as mensagens; excluir de novo avisa que não havia nada", async () => {
      const { repo } = await fabrica();
      const id = randomUUID();
      await repo.acrescentar(id, [mensagem("usuario", "Some")]);

      expect(await repo.excluir(id)).toBe(true);
      expect(await repo.obter(id)).toBeNull();
      expect(await repo.listar()).toEqual([]);
      expect(await repo.excluir(id)).toBe(false);
    });

    it("uma conversa é só de quem a criou", async () => {
      const { repo, outraPessoa } = await fabrica();
      const id = randomUUID();
      await repo.acrescentar(id, [mensagem("usuario", "Particular")]);

      expect(await outraPessoa.obter(id)).toBeNull();
      expect(await outraPessoa.listar()).toEqual([]);
      expect(await outraPessoa.excluir(id)).toBe(false);
      await expect(outraPessoa.acrescentar(id, [mensagem("usuario", "Invasão")])).rejects.toMatchObject({ motivo: "nao-encontrada" });
      await expect(outraPessoa.acrescentar(id, [mensagem("usuario", "Invasão")])).rejects.toBeInstanceOf(ErroDeConversa);
      expect((await repo.obter(id))?.mensagens).toHaveLength(1);
    });

    it("recusa mensagem vazia ou papel inventado", async () => {
      const { repo } = await fabrica();

      await expect(repo.acrescentar(randomUUID(), [mensagem("usuario", "   ")])).rejects.toMatchObject({ motivo: "invalida" });
      await expect(repo.acrescentar(randomUUID(), [{ id: randomUUID(), papel: "sistema" as never, conteudo: "x" }])).rejects.toMatchObject({ motivo: "invalida" });
      await expect(repo.acrescentar(randomUUID(), [])).rejects.toMatchObject({ motivo: "invalida" });
    });
  });
}
