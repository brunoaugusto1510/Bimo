/**
 * A suíte de contrato: o que *qualquer* repositório que aceita escrita
 * precisa cumprir. Roda contra a memória (sempre) e contra o banco (quando há
 * `DATABASE_URL`), então os dois não divergem em silêncio.
 *
 * Não é um teste em si — cada implementação a chama de dentro do seu
 * `.test.ts`, passando uma fábrica que devolve um repositório **vazio**.
 */

import { describe, expect, it } from "vitest";
import { CONFIGURACAO_PADRAO } from "../fisica-do-grafo";
import type { EntradaDeNota, NotaCompleta, RepositorioDeNotas } from "./tipos";

const USUARIO = { criadoPor: "usuario" } as const;

type Fabrica = () => RepositorioDeNotas | Promise<RepositorioDeNotas>;

async function criarOk(repo: RepositorioDeNotas, entrada: EntradaDeNota): Promise<NotaCompleta> {
  const resultado = await repo.criarNota(entrada, USUARIO);
  if (resultado.tipo !== "ok") throw new Error(`esperava criar "${entrada.titulo}", veio ${resultado.tipo}`);
  return resultado.nota;
}

export function executarContratoDoRepositorio(nome: string, fabrica: Fabrica): void {
  describe(`contrato do repositório de notas: ${nome}`, () => {
    it("declara que aceita escrita", async () => {
      const repo = await fabrica();

      expect(repo.capacidades.escrita).toBe(true);
    });

    describe("criarNota", () => {
      it("devolve a nota criada, com id opaco, revisão 1 e valores padrão", async () => {
        const repo = await fabrica();

        const nota = await criarOk(repo, { titulo: "Ler é uma conversa" });

        expect(typeof nota.id).toBe("string");
        expect(nota.id).not.toMatch(/:/);
        expect(nota).toMatchObject({ titulo: "Ler é uma conversa", pasta: null, tags: [], conteudo: "", revisao: 1 });
      });

      it("guarda pasta, conteúdo e tags", async () => {
        const repo = await fabrica();

        const nota = await criarOk(repo, {
          titulo: "TCP",
          pasta: "Faculdade/Redes",
          conteudo: "# TCP\ntexto",
          tags: ["redes"],
        });

        expect(await repo.obterNota(nota.id)).toEqual(nota);
        expect(nota).toMatchObject({ pasta: "Faculdade/Redes", conteudo: "# TCP\ntexto", tags: ["redes"] });
      });

      it("dá um id diferente a cada nota", async () => {
        const repo = await fabrica();

        const a = await criarOk(repo, { titulo: "A" });
        const b = await criarOk(repo, { titulo: "B" });

        expect(a.id).not.toBe(b.id);
      });

      it("recusa título repetido na mesma pasta, sem diferenciar maiúsculas, e diz qual nota já o usa", async () => {
        const repo = await fabrica();
        const existente = await criarOk(repo, { titulo: "Resumo", pasta: "Leituras" });

        const resultado = await repo.criarNota({ titulo: "RESUMO", pasta: "Leituras" }, USUARIO);

        expect(resultado).toEqual({ tipo: "titulo-em-uso", idExistente: existente.id });
      });

      it("aceita o mesmo título em pastas diferentes", async () => {
        const repo = await fabrica();
        await criarOk(repo, { titulo: "Resumo", pasta: "Leituras" });

        const resultado = await repo.criarNota({ titulo: "Resumo", pasta: "Faculdade" }, USUARIO);

        expect(resultado.tipo).toBe("ok");
      });

      it("adota a grafia de uma pasta que já existe com outra caixa", async () => {
        const repo = await fabrica();
        await criarOk(repo, { titulo: "A", pasta: "Projetos" });

        const nota = await criarOk(repo, { titulo: "B", pasta: "projetos" });

        expect(nota.pasta).toBe("Projetos");
      });
    });

    describe("leitura", () => {
      it("obterNota devolve null para um id que não existe", async () => {
        const repo = await fabrica();

        expect(await repo.obterNota("999999")).toBeNull();
      });

      it("listarResumos não traz o texto e listarComConteudo traz", async () => {
        const repo = await fabrica();
        await criarOk(repo, { titulo: "A", conteudo: "texto de A" });

        const [resumo] = await repo.listarResumos();
        const [completa] = await repo.listarComConteudo();

        expect(resumo).not.toHaveProperty("conteudo");
        expect(completa.conteudo).toBe("texto de A");
      });

      it("o banco de teste começa vazio", async () => {
        const repo = await fabrica();

        expect(await repo.listarResumos()).toEqual([]);
      });
    });

    describe("atualizarNota", () => {
      it("grava o novo conteúdo e sobe a revisão", async () => {
        const repo = await fabrica();
        const nota = await criarOk(repo, { titulo: "A", conteudo: "antes" });

        const resultado = await repo.atualizarNota(nota.id, { conteudo: "depois" }, { revisaoBase: nota.revisao, autor: USUARIO });

        expect(resultado.tipo).toBe("ok");
        if (resultado.tipo === "ok") {
          expect(resultado.nota).toMatchObject({ conteudo: "depois", revisao: nota.revisao + 1 });
          expect((await repo.obterNota(nota.id))?.conteudo).toBe("depois");
        }
      });

      it("devolve conflito, com o que está salvo, quando a revisão base ficou velha", async () => {
        const repo = await fabrica();
        const nota = await criarOk(repo, { titulo: "A", conteudo: "v1" });
        await repo.atualizarNota(nota.id, { conteudo: "v2" }, { revisaoBase: nota.revisao, autor: USUARIO });

        const resultado = await repo.atualizarNota(nota.id, { conteudo: "v3" }, { revisaoBase: nota.revisao, autor: USUARIO });

        expect(resultado.tipo).toBe("conflito");
        if (resultado.tipo === "conflito") expect(resultado.atual.conteudo).toBe("v2");
        expect((await repo.obterNota(nota.id))?.conteudo).toBe("v2");
      });

      it("devolve nao-encontrada para um id que não existe", async () => {
        const repo = await fabrica();

        const resultado = await repo.atualizarNota("999999", { conteudo: "x" }, { revisaoBase: 1, autor: USUARIO });

        expect(resultado).toEqual({ tipo: "nao-encontrada" });
      });

      it("muda pasta e tags", async () => {
        const repo = await fabrica();
        const nota = await criarOk(repo, { titulo: "A", pasta: "Origem" });

        const resultado = await repo.atualizarNota(
          nota.id,
          { pasta: "Destino/Sub", tags: ["x"] },
          { revisaoBase: nota.revisao, autor: USUARIO, checkpoint: true },
        );

        expect(resultado.tipo === "ok" && resultado.nota).toMatchObject({ pasta: "Destino/Sub", tags: ["x"] });
      });

      it("mover para uma pasta que já tem nota com o mesmo título é recusado", async () => {
        const repo = await fabrica();
        const existente = await criarOk(repo, { titulo: "Resumo", pasta: "Destino" });
        const nota = await criarOk(repo, { titulo: "Resumo", pasta: "Origem" });

        const resultado = await repo.atualizarNota(nota.id, { pasta: "Destino" }, { revisaoBase: nota.revisao, autor: USUARIO });

        expect(resultado).toEqual({ tipo: "titulo-em-uso", idExistente: existente.id });
      });

      it("mover de pasta reescreve as ligações com caminho que apontavam para a nota", async () => {
        const repo = await fabrica();
        const movida = await criarOk(repo, { titulo: "N", pasta: "A" });
        const outra = await criarOk(repo, { titulo: "Outra", conteudo: "veja [[A/N]]" });

        await repo.atualizarNota(movida.id, { pasta: "B" }, { revisaoBase: movida.revisao, autor: USUARIO, checkpoint: true });

        const depois = await repo.obterNota(outra.id);
        expect(depois?.conteudo).toBe("veja [[B/N]]");
        expect(depois?.revisao).toBe(outra.revisao + 1);
      });

      it("trocar só a caixa da pasta da única nota nela vale", async () => {
        const repo = await fabrica();
        const nota = await criarOk(repo, { titulo: "A", pasta: "Projetos" });

        const resultado = await repo.atualizarNota(nota.id, { pasta: "projetos" }, { revisaoBase: nota.revisao, autor: USUARIO });

        expect(resultado.tipo === "ok" && resultado.nota.pasta).toBe("projetos");
      });

      it("gravar o mesmo conteúdo não gasta revisão", async () => {
        const repo = await fabrica();
        const nota = await criarOk(repo, { titulo: "A", conteudo: "igual" });

        const resultado = await repo.atualizarNota(nota.id, { conteudo: "igual" }, { revisaoBase: nota.revisao, autor: USUARIO });

        expect(resultado.tipo === "ok" && resultado.nota.revisao).toBe(nota.revisao);
      });
    });

    describe("renomearNota", () => {
      it("muda o título e reescreve as ligações das outras notas", async () => {
        const repo = await fabrica();
        const alvo = await criarOk(repo, { titulo: "Antigo" });
        const outra = await criarOk(repo, { titulo: "Outra", conteudo: "veja [[Antigo]] e [[Antigo|apelido]]" });

        const resultado = await repo.renomearNota(alvo.id, "Novo", { revisaoBase: alvo.revisao, autor: USUARIO });

        expect(resultado.tipo === "ok" && resultado.notasReescritas).toBe(1);
        expect((await repo.obterNota(alvo.id))?.titulo).toBe("Novo");
        const depois = await repo.obterNota(outra.id);
        expect(depois?.conteudo).toBe("veja [[Novo]] e [[Novo|apelido]]");
        expect(depois?.revisao).toBe(outra.revisao + 1);
      });

      it("recusa um título que a pasta já usa", async () => {
        const repo = await fabrica();
        const alvo = await criarOk(repo, { titulo: "A" });
        const outra = await criarOk(repo, { titulo: "B" });

        const resultado = await repo.renomearNota(alvo.id, "b", { revisaoBase: alvo.revisao, autor: USUARIO });

        expect(resultado).toMatchObject({ tipo: "titulo-em-uso", idExistente: outra.id });
        expect((await repo.obterNota(alvo.id))?.titulo).toBe("A");
      });

      it("devolve conflito com revisão base velha e nao-encontrada para id desconhecido", async () => {
        const repo = await fabrica();
        const alvo = await criarOk(repo, { titulo: "A" });
        await repo.atualizarNota(alvo.id, { conteudo: "x" }, { revisaoBase: alvo.revisao, autor: USUARIO });

        expect((await repo.renomearNota(alvo.id, "Z", { revisaoBase: alvo.revisao, autor: USUARIO })).tipo).toBe("conflito");
        expect(await repo.renomearNota("999999", "Z", { revisaoBase: 1, autor: USUARIO })).toEqual({ tipo: "nao-encontrada" });
      });

      it("trocar só a caixa do título é permitido", async () => {
        const repo = await fabrica();
        const alvo = await criarOk(repo, { titulo: "tcp" });

        const resultado = await repo.renomearNota(alvo.id, "TCP", { revisaoBase: alvo.revisao, autor: USUARIO });

        expect(resultado.tipo === "ok" && resultado.nota.titulo).toBe("TCP");
      });
    });

    describe("marcaDeVersao", () => {
      it("muda quando uma nota muda e fica igual quando nada muda", async () => {
        const repo = await fabrica();
        const inicial = await repo.marcaDeVersao();
        expect(await repo.marcaDeVersao()).toBe(inicial);

        const nota = await criarOk(repo, { titulo: "A" });
        const aposCriar = await repo.marcaDeVersao();
        expect(aposCriar).not.toBe(inicial);

        await repo.atualizarNota(nota.id, { conteudo: "novo" }, { revisaoBase: nota.revisao, autor: USUARIO });
        expect(await repo.marcaDeVersao()).not.toBe(aposCriar);
      });
    });

    describe("buscarPorConteudo", () => {
      it("acha pelo texto e pelo título, sem diferenciar acento nem caixa", async () => {
        const repo = await fabrica();
        await criarOk(repo, { titulo: "Café", conteudo: "variáveis do preparo" });
        await criarOk(repo, { titulo: "Outra", conteudo: "nada a ver" });

        const porTexto = await repo.buscarPorConteudo("VARIAVEIS", 10);
        const porTitulo = await repo.buscarPorConteudo("cafe", 10);

        expect(porTexto.map((r) => r.titulo)).toEqual(["Café"]);
        expect(porTitulo.map((r) => r.titulo)).toEqual(["Café"]);
        expect(porTexto[0].trecho).toContain("variáveis");
      });

      it("respeita o limite e devolve vazio quando nada casa", async () => {
        const repo = await fabrica();
        await criarOk(repo, { titulo: "Nota 1", conteudo: "assunto comum" });
        await criarOk(repo, { titulo: "Nota 2", conteudo: "assunto comum" });

        expect(await repo.buscarPorConteudo("assunto", 1)).toHaveLength(1);
        expect(await repo.buscarPorConteudo("inexistente", 5)).toEqual([]);
      });
    });

    it("usa a configuração padrão do grafo", async () => {
      const repo = await fabrica();

      expect(await repo.obterConfiguracaoDoGrafo()).toEqual(CONFIGURACAO_PADRAO);
    });
  });
}
