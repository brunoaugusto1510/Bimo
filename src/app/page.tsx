import ConfiguracaoNecessaria from "@/components/ConfiguracaoNecessaria";
import PaginaPrincipal from "@/components/PaginaPrincipal";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { ErroDeConfiguracao } from "@/lib/repositorio-de-notas/config";
import { obterDadosDaPagina, type DadosDaPagina } from "@/lib/servico-de-notas";

type ResultadoDaPagina =
  | ({ tipo: "ok" } & DadosDaPagina)
  | { tipo: "erro"; mensagem: string; variaveis?: string[] };

/**
 * Busca a árvore e o grafo das notas. Fica separado de `Pagina` porque o
 * React não deixa montar JSX dentro de um try/catch (o catch não pegaria
 * erros que acontecessem durante a renderização) — então o try/catch mora
 * aqui, devolvendo um resultado simples, e quem decide o que renderizar é a
 * função de baixo.
 */
async function carregarDadosDaPagina(): Promise<ResultadoDaPagina> {
  try {
    const repositorio = await obterRepositorio();
    return { tipo: "ok", ...(await obterDadosDaPagina(repositorio)) };
  } catch (erro) {
    if (erro instanceof ErroDeConfiguracao) {
      return { tipo: "erro", mensagem: erro.message, variaveis: erro.variaveis };
    }
    return { tipo: "erro", mensagem: erro instanceof Error ? erro.message : "Erro desconhecido." };
  }
}

// Sem isto, o Next.js pode tentar "congelar" esta página como HTML estático
// no build de produção (ótimo para conteúdo que não muda, ruim aqui: as notas
// podem mudar a qualquer momento). Isso força buscar de novo a cada visita — o
// serviço de notas só refaz o trabalho quando a marca de versão das notas muda.
export const dynamic = "force-dynamic";

/**
 * Este arquivo não tem "use client": ele roda no servidor. É aqui que dá para
 * usar o GITHUB_TOKEN e a conexão com o banco com segurança — nada disso chega
 * ao navegador, porque este componente já devolve HTML pronto (com a árvore
 * das notas dentro).
 *
 * Tudo que precisa de estado e clique (useState, onClick) fica em
 * PaginaPrincipal, que é "use client" e recebe os dados prontos por prop.
 */
export default async function Pagina() {
  const dados = await carregarDadosDaPagina();

  if (dados.tipo === "erro") {
    return <ConfiguracaoNecessaria mensagem={dados.mensagem} variaveis={dados.variaveis} />;
  }
  return <PaginaPrincipal itens={dados.itens} grafo={dados.grafo} aviso={dados.aviso} capacidades={dados.capacidades} />;
}
