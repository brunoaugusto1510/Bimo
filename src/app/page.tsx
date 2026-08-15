import ConfiguracaoNecessaria from "@/components/ConfiguracaoNecessaria";
import PaginaPrincipal from "@/components/PaginaPrincipal";
import { obterGrafoDoVault, type Grafo } from "@/lib/grafo";
import { obterArvoreDoVault } from "@/lib/vault-real";
import type { ItemVault } from "@/lib/types";

type DadosDaPagina =
  | { tipo: "ok"; itens: ItemVault[]; grafo: Grafo; aviso?: string }
  | { tipo: "erro"; mensagem: string };

/**
 * Busca a árvore e o grafo do vault. Fica separado de `Pagina` porque o
 * React não deixa montar JSX dentro de um try/catch (o catch não pegaria
 * erros que acontecessem durante a renderização) — então o try/catch mora
 * aqui, devolvendo um resultado simples, e quem decide o que renderizar é a
 * função de baixo.
 */
async function carregarDadosDaPagina(): Promise<DadosDaPagina> {
  try {
    // As duas buscas não dependem uma da outra, então rodam ao mesmo tempo
    // em vez de uma esperar a outra terminar.
    const [{ itens, aviso }, grafo] = await Promise.all([
      obterArvoreDoVault(),
      obterGrafoDoVault(),
    ]);
    return { tipo: "ok", itens, grafo, aviso };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido.";
    return { tipo: "erro", mensagem };
  }
}

// Sem isto, o Next.js pode tentar "congelar" esta página como HTML estático
// no build de produção (ótimo para conteúdo que não muda, ruim aqui: o vault
// pode ganhar notas novas a qualquer momento). Isso força buscar de novo a
// cada visita — o cache de 5 minutos em vault-real.ts já evita bater na API
// do GitHub toda hora.
export const dynamic = "force-dynamic";

/**
 * Este arquivo não tem "use client": ele roda no servidor. É aqui que dá para
 * usar o GITHUB_TOKEN com segurança — ele nunca chega ao navegador, porque
 * este componente já devolve HTML pronto (com a árvore do vault dentro).
 *
 * Tudo que precisa de estado e clique (useState, onClick) fica em
 * PaginaPrincipal, que é "use client" e recebe os dados prontos por prop.
 */
export default async function Pagina() {
  const dados = await carregarDadosDaPagina();

  if (dados.tipo === "erro") {
    return <ConfiguracaoNecessaria mensagem={dados.mensagem} />;
  }
  return <PaginaPrincipal itens={dados.itens} grafo={dados.grafo} aviso={dados.aviso} />;
}
