import { dividirCaminho, juntarCaminho, normalizarTexto } from "./caminho-da-nota";
import type { ResumoDeNota } from "./repositorio-de-notas/tipos";
import { ErroDeFerramenta } from "./erro-de-ferramenta";

export function caminhoDaNota(nota: Pick<ResumoDeNota, "pasta" | "titulo">): string {
  return `${juntarCaminho(nota.pasta, nota.titulo)}.md`;
}

/** O agente pode abreviar caminhos; uma ambiguidade nunca escolhe por ordem de listagem. */
export function resolverNotaDoAgente(entrada: string, notas: readonly ResumoDeNota[], uso: "leitura" | "escrita" = "leitura"): ResumoDeNota | null {
  const exato = entrada.replace(/\.md$/i, "");
  const limpa = entrada.replace(/\\/g, "/").split("/").map((segmento) => segmento.trim()).join("/");
  const { pasta, titulo } = dividirCaminho(limpa.replace(/^\/+/, ""));
  if (!titulo.trim()) return null;
  const alvo = normalizarTexto(juntarCaminho(pasta, titulo));
  const caminho = (nota: ResumoDeNota) => normalizarTexto(juntarCaminho(nota.pasta, nota.titulo));
  const etapas = [
    (nota: ResumoDeNota) => juntarCaminho(nota.pasta, nota.titulo) === exato,
    (nota: ResumoDeNota) => caminho(nota) === alvo,
    (nota: ResumoDeNota) => normalizarTexto(nota.titulo) === alvo,
    (nota: ResumoDeNota) => caminho(nota).endsWith(`/${alvo}`),
    ...(uso === "leitura" ? [(nota: ResumoDeNota) => normalizarTexto(nota.titulo).includes(alvo)] : []),
  ];
  for (const corresponde of etapas) {
    const candidatas = notas.filter(corresponde);
    if (candidatas.length > 1) {
      const caminhos = candidatas.map(caminhoDaNota).sort().slice(0, 10);
      const restantes = candidatas.length > 10 ? ` e mais ${candidatas.length - 10}` : "";
      throw new ErroDeFerramenta(`Há mais de uma nota correspondente. Informe o caminho completo: ${caminhos.join(", ")}${restantes}.`);
    }
    if (candidatas.length === 1) return candidatas[0];
  }
  return null;
}
