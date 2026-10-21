import type { Rastro } from "./rastro-do-agente";
import type { IdDeNota } from "./types";

/**
 * O que a lista de notas mostra de cada nota que o Bimo tocou na pergunta atual: uma bolinha
 * clara nas encontradas pela busca (só enquanto ele trabalha), uma azul nas lidas ou editadas
 * e a etiqueta "nova" nas criadas. `ativa` é a nota em que ele está agora.
 */
export type MarcaDoRastro = { tipo: "candidata" | "usada" | "nova"; ativa: boolean };

/** Quantas notas lidas o resumo cita antes de abreviar com "…". */
const MAXIMO_NO_RESUMO = 4;

export function marcasDoRastro(rastro: Rastro | null): ReadonlyMap<IdDeNota, MarcaDoRastro> {
  const marcas = new Map<IdDeNota, MarcaDoRastro>();
  if (!rastro) return marcas;
  const trabalhando = rastro.fim === null;
  let atual: IdDeNota | null = null;

  for (const passo of rastro.passos) {
    if (passo.tipo === "busca") {
      // A busca só sugere: depois da resposta, as que não foram usadas perdem a marca.
      if (!trabalhando) continue;
      for (const id of passo.ids) if (!marcas.has(id)) marcas.set(id, { tipo: "candidata", ativa: false });
      continue;
    }
    const criada = passo.tipo === "escrita" && passo.criada;
    const nova = criada || marcas.get(passo.id)?.tipo === "nova";
    marcas.set(passo.id, { tipo: nova ? "nova" : "usada", ativa: false });
    atual = passo.id;
  }

  const ativa = trabalhando && atual !== null ? marcas.get(atual) : undefined;
  if (atual !== null && ativa) marcas.set(atual, { ...ativa, ativa: true });
  return marcas;
}

/**
 * Uma frase sobre o que o Bimo fez na última pergunta, para a aba Notas: a nota criada, a
 * editada ou o caminho das lidas. Nada enquanto ele ainda trabalha ou se não tocou nenhuma.
 */
export function resumoDoRastro(rastro: Rastro | null, tituloDe: (id: IdDeNota) => string | undefined): string | null {
  if (!rastro || rastro.fim === null) return null;
  const criadas: IdDeNota[] = [];
  const editadas: IdDeNota[] = [];
  const lidas: IdDeNota[] = [];
  const incluir = (lista: IdDeNota[], id: IdDeNota) => { if (!lista.includes(id)) lista.push(id); };

  for (const passo of rastro.passos) {
    if (passo.tipo === "leitura") incluir(lidas, passo.id);
    else if (passo.tipo === "escrita") incluir(passo.criada ? criadas : editadas, passo.id);
  }

  const titulos = (ids: IdDeNota[]) => ids.flatMap((id) => tituloDe(id) ?? []);
  const novas = titulos(criadas);
  if (novas.length > 0) return `Nota nova do Bimo: ${novas.join(", ")}`;
  const editadasDeFato = titulos(editadas.filter((id) => !criadas.includes(id)));
  if (editadasDeFato.length > 0) return `O Bimo editou: ${editadasDeFato.join(", ")}`;
  const caminho = titulos(lidas);
  if (caminho.length === 0) return null;
  const citadas = caminho.slice(0, MAXIMO_NO_RESUMO).join(" → ");
  return `Último rastro do Bimo: ${citadas}${caminho.length > MAXIMO_NO_RESUMO ? " → …" : ""}`;
}
