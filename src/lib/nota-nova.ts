import type { NotaParaArvore } from "./arvore-de-notas";
import { adotarGrafiaDaPasta, normalizarPasta, normalizarTexto, validarTitulo } from "./caminho-da-nota";

export type PedidoDeCriacao =
  | { tipo: "criar"; titulo: string; pasta: string | null }
  | { tipo: "existente"; id: string; motivo: string }
  | { tipo: "invalido"; motivo: string };

export function proximoTituloLivre(pasta: string | null, notas: readonly NotaParaArvore[]): string {
  const usados = new Set(notas.filter((nota) => normalizarTexto(nota.pasta ?? "") === normalizarTexto(pasta ?? "")).map((nota) => normalizarTexto(nota.titulo)));
  let numero = 0;
  while (usados.has(normalizarTexto(numero ? `Sem título ${numero}` : "Sem título"))) numero++;
  return numero ? `Sem título ${numero}` : "Sem título";
}

export function pedidoDaLigacao(alvo: string, pastaDeOrigem: string | null) {
  const partes = alvo.split("/");
  const titulo = (partes.pop() ?? "").trim();
  return { titulo, pasta: alvo.includes("/") ? normalizarPasta(partes.join("/")) : pastaDeOrigem };
}

export function analisarPedidoDeCriacao(consulta: string, pastaAtual: string | null, notas: readonly NotaParaArvore[]): PedidoDeCriacao {
  const pedido = pedidoDaLigacao(consulta.trim(), pastaAtual);
  const validacao = validarTitulo(pedido.titulo);
  if (!validacao.ok) return { tipo: "invalido", motivo: validacao.motivo };
  const pasta = adotarGrafiaDaPasta(normalizarPasta(pedido.pasta), notas.map((nota) => nota.pasta));
  const existente = notas.find((nota) => normalizarTexto(nota.pasta ?? "") === normalizarTexto(pasta ?? "") && normalizarTexto(nota.titulo) === normalizarTexto(validacao.titulo));
  return existente ? { tipo: "existente", id: existente.id, motivo: "Já existe na pasta de destino. Abra a nota existente." } : { tipo: "criar", titulo: validacao.titulo, pasta };
}
