"use client";
import { useEffect, useRef, useState } from "react";
import { indexarNotas, type NotaParaArvore } from "../arvore-de-notas";
import { criarNota, semearNota } from "../cliente-de-notas";
import { analisarPedidoDeCriacao, proximoTituloLivre } from "../nota-nova";
import type { CapacidadesDoRepositorio } from "../repositorio-de-notas/tipos";

export const EVENTO_NOTA_CRIADA = "bimo:nota-criada";
export const AVISO_SOMENTE_LEITURA = "Criar notas não está disponível no modo somente leitura.";
export type FocoPedido = { id: string; alvo: "titulo" | "texto" | "nota" };
export type ResultadoDaAbertura = { tipo: "ok" } | { tipo: "erro"; mensagem: string };
type Pedido = { titulo?: string; pasta: string | null; novaAba?: boolean };
type Dependencias = {
  capacidades: CapacidadesDoRepositorio;
  notas: readonly NotaParaArvore[];
  registrar(nota: NotaParaArvore): void;
  abrir(id: string, opcoes: { novaAba: boolean; alvo: "titulo" | "texto"; criada: boolean }): void;
};

export function useCriacaoDeNota({ capacidades, notas, registrar, abrir }: Dependencias) {
  const emVoo = useRef(false);
  const [aviso, definirAviso] = useState({ id: 0, texto: "" });
  const anunciar = (texto: string) => definirAviso((a) => ({ id: a.id + 1, texto }));
  const [erro, definirErro] = useState("");
  const incerto = useRef<{ titulo: string; pasta: string | null } | null>(null);
  useEffect(() => {
    if (!aviso.texto && !erro) return;
    const timer = setTimeout(() => { definirAviso((a) => ({ ...a, texto: "" })); definirErro(""); }, erro ? 6000 : 2000);
    return () => clearTimeout(timer);
  }, [aviso, erro]);
  async function criar(pedido: Pedido): Promise<ResultadoDaAbertura> {
    const automatico = pedido.titulo === undefined;
    const falhar = (mensagem: string): ResultadoDaAbertura => { if (automatico) definirErro(mensagem); anunciar(""); return { tipo: "erro", mensagem }; };
    if (!capacidades.escrita) return falhar(AVISO_SOMENTE_LEITURA);
    if (emVoo.current) return { tipo: "erro", mensagem: "Uma nota já está sendo criada." };
    emVoo.current = true; definirErro(""); anunciar("");
    const demora = setTimeout(() => { if (automatico) anunciar("Criando nota…"); }, 800);
    const conhecidas = [...notas];
    let enviado: { titulo: string; pasta: string | null } | null = null;
    try {
      if (automatico && incerto.current) {
        // Uma resposta perdida não autoriza criar outro número. Primeiro confirma a lista.
        const resposta = await fetch("/api/grafo?comArvore=1", { cache: "no-store", signal: AbortSignal.timeout(20000) });
        if (!resposta.ok) return falhar("Não foi possível confirmar a criação anterior. Tente de novo.");
        const dados = await resposta.json();
        if (!Array.isArray(dados.itens)) return falhar("Não foi possível confirmar a criação anterior. Tente de novo.");
        const atualizadas = [...indexarNotas(dados.itens).values()];
        const anterior = incerto.current;
        const analise = analisarPedidoDeCriacao(anterior.titulo, anterior.pasta, atualizadas);
        if (analise.tipo === "existente") {
          incerto.current = null;
          abrir(analise.id, { novaAba: pedido.novaAba ?? false, alvo: "texto", criada: false });
          window.dispatchEvent(new Event(EVENTO_NOTA_CRIADA));
          anunciar("Já existia; abri a nota"); return { tipo: "ok" };
        }
        // Reenvia o mesmo título: uma colisão tardia abre a nota, sem criar uma órfã.
        enviado = anterior;
      }
      for (let tentativa = 0; tentativa < 20; tentativa++) {
        const titulo = enviado?.titulo ?? pedido.titulo ?? proximoTituloLivre(pedido.pasta, conhecidas);
        const analise = analisarPedidoDeCriacao(titulo, enviado ? enviado.pasta : pedido.pasta, conhecidas);
        if (analise.tipo === "invalido") return falhar(analise.motivo);
        if (analise.tipo === "existente") {
          abrir(analise.id, { novaAba: pedido.novaAba ?? false, alvo: "texto", criada: false });
          anunciar("Já existia; abri a nota"); return { tipo: "ok" };
        }
        const recuperando = incerto.current !== null && automatico;
        enviado = { titulo: analise.titulo, pasta: analise.pasta };
        const resultado = await criarNota(enviado);
        if (resultado.tipo === "ok") {
          semearNota({ nota: resultado.nota, capacidades });
          registrar({ id: resultado.nota.id, titulo: resultado.nota.titulo, pasta: resultado.nota.pasta });
          incerto.current = null;
          abrir(resultado.nota.id, { novaAba: pedido.novaAba ?? false, alvo: automatico ? "titulo" : "texto", criada: true });
          anunciar(`Nota «${resultado.nota.titulo}» criada. Edite o título.`);
          window.dispatchEvent(new Event(EVENTO_NOTA_CRIADA));
          return { tipo: "ok" };
        }
        if (resultado.tipo === "titulo-em-uso") {
          const resumo = { id: resultado.idExistente, titulo: analise.titulo, pasta: analise.pasta };
          if (automatico && !recuperando) { conhecidas.push(resumo); enviado = null; continue; }
          incerto.current = null;
          abrir(resultado.idExistente, { novaAba: pedido.novaAba ?? false, alvo: "texto", criada: false });
          window.dispatchEvent(new Event(EVENTO_NOTA_CRIADA));
          anunciar("Já existia; abri a nota"); return { tipo: "ok" };
        }
        return falhar(resultado.tipo === "erro" ? resultado.mensagem : resultado.tipo === "somente-leitura" ? AVISO_SOMENTE_LEITURA : "A nota excede o limite do servidor.");
      }
      return falhar("Não foi possível escolher um título livre. Tente de novo.");
    } catch (erro) { if (automatico && enviado) incerto.current = enviado; return falhar(erro instanceof Error ? erro.message : "Não foi possível criar a nota."); }
    finally { clearTimeout(demora); emVoo.current = false; }
  }
  return { criar, anuncio: aviso.texto, idAnuncio: aviso.id, erro };
}
